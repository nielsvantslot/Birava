# photo-upload

A copy-paste-portable photo upload feature: browser-side HEIC conversion +
compression, an optional direct-to-storage upload path (to route around
serverless request body limits), and server-side resize/strip-EXIF/re-encode
processing.

Built the way you'd structure this in C#: one interface per file (`I`-prefixed),
classes that implement them via constructor injection, and factory classes
that assemble the object graph. No standalone exported functions — every
operation is a static or instance method on a class. Nothing here does `new`
on a concrete dependency it should instead be handed — every collaborator is
injected.

Four distinct kinds of type, each with its own convention:

| Kind | Convention | Example |
|---|---|---|
| Behavioral contract | `I`-prefixed interface, own file, next to its implementation(s) | `adapters/IStorageAdapter.ts` |
| Constructor options | plain `XConfig` interface, own file, next to the one class it configures, properties `readonly` | `services/SharpImageProcessorConfig.ts` |
| Wire data (an HTTP request/response body) | `XDto` interface, in a `Dto/` folder, properties `readonly` | `Dto/UploadResultDto.ts` |
| Expected failure | subclass of `PhotoUploadError`, own file, in `Errors/` | `Errors/PhotoTooLargeError.ts` |

A DTO is specifically something that gets serialized across the network —
route request/response bodies. A `Config` is a constructor parameter object
that never leaves the process. Conflating the two (e.g. reusing a DTO as a
constructor's options type, or vice versa) is what this split avoids. DTOs
and Configs are marked `readonly` — they're constructed once (parsed off the
wire, or passed to a constructor) and never mutated afterward, the same
"record"/init-only-property idiom C# uses for both.

Every expected, catchable failure is a distinct `PhotoUploadError` subclass
(`PhotoTooLargeError`, `UnreadablePhotoError`, `PhotoNotFoundError`,
`InvalidUploadError`, `DirectUploadNotConfiguredError`) rather than one
generic exception type or a bare `Error` — callers can `catch` a specific
reason when it matters, or `instanceof PhotoUploadError` to handle any of
them uniformly (`PhotoUploadRouteFactory` does the latter, mapping any of
them to a 400 with `error.message`).

| Role | Interface (lives next to its implementation) | Default implementation |
|---|---|---|
| Where bytes live | `adapters/IStorageAdapter.ts` | `adapters/LocalDiskStorageAdapter.ts`, `adapters/VercelBlobStorageAdapter.ts` |
| How bytes get processed | `services/IImageProcessor.ts` | `services/SharpImageProcessor.ts` (sharp + heic-convert) |
| Browser-direct upload, server half | `adapters/IDirectUploadCoordinator.ts` | `adapters/VercelBlobDirectUploadCoordinator.ts` |
| Browser-direct upload, client half | `client/services/IDirectUploadTransport.ts` | `client/services/VercelBlobDirectUploadTransport.ts` |
| The feature itself | `services/IPhotoUploadService.ts` | `services/PhotoUploadService.ts`, built via `services/PhotoUploadServiceFactory.ts` |
| Caller identity | plain callback, no interface needed | whatever the project's auth already exposes |

Each interface lives in the same folder as the class(es) that implement it —
no separate top-level "contracts" folder to jump to. `Models.ts` /
`client/Models.ts` hold the remaining plain internal data shapes that are
neither a behavioral contract, a constructor's options, nor a DTO (e.g.
`StoredFile`, `ProcessedImage` — values that only ever exist in-process).

`PhotoUploadService` only ever talks to the interfaces above — it has no
import of sharp, heic-convert, `@vercel/blob`, or `fs`. Swapping any one
collaborator (a different image library, S3 instead of Blob, no HEIC support
at all) means writing a new class implementing that one interface; nothing
else in the module changes.

To reuse in another project: copy this whole `photo-upload/` folder, then do
the three steps below.

## Dependencies

```
npm install sharp heic-convert @vercel/blob
```

Drop `adapters/VercelBlobStorageAdapter.ts`, `adapters/VercelBlobDirectUploadCoordinator.ts`,
and `client/services/VercelBlobDirectUploadTransport.ts` (and the `@vercel/blob`
dependency) if the target project doesn't use Vercel Blob — implement
`IStorageAdapter`/`IDirectUploadCoordinator`/`IDirectUploadTransport` for
whatever it uses instead (S3, GCS, Supabase Storage, ...).
`LocalDiskStorageAdapter` has no direct-upload capability, so pair it with
the `"server"` mode client upload and leave `PhotoUploadServiceConfig.directUpload` unset.

## 1. Wire a service — the composition root (server)

Which concrete classes to use for a given environment is an *application*
decision, so it belongs in the project's own wiring code, not inside the
reusable factory. A small app-level factory class is the idiomatic place for
that decision:

```ts
// lib/photoUpload.ts
import path from "path";
import { PhotoUploadServiceFactory } from "@/modules/photo-upload/services/PhotoUploadServiceFactory";
import { SharpImageProcessor } from "@/modules/photo-upload/services/SharpImageProcessor";
import { LocalDiskStorageAdapter } from "@/modules/photo-upload/adapters/LocalDiskStorageAdapter";
import { VercelBlobStorageAdapter } from "@/modules/photo-upload/adapters/VercelBlobStorageAdapter";
import { VercelBlobDirectUploadCoordinator } from "@/modules/photo-upload/adapters/VercelBlobDirectUploadCoordinator";
import type { IDirectUploadCoordinator } from "@/modules/photo-upload/adapters/IDirectUploadCoordinator";
import type { IStorageAdapter } from "@/modules/photo-upload/adapters/IStorageAdapter";

const isProduction = process.env.NODE_ENV === "production";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

class PhotoStorageFactory {
  static createStorageAdapter(): IStorageAdapter {
    return isProduction
      ? new VercelBlobStorageAdapter({ access: "private" })
      : new LocalDiskStorageAdapter({ rootDir: path.join(process.cwd(), "public", "uploads"), publicPathPrefix: "/uploads" });
  }
  static createDirectUploadCoordinator(): IDirectUploadCoordinator | undefined {
    return isProduction ? new VercelBlobDirectUploadCoordinator() : undefined;
  }
}

export const photoUploadService = PhotoUploadServiceFactory.create({
  storage: PhotoStorageFactory.createStorageAdapter(),
  imageProcessor: new SharpImageProcessor({ maxDimension: 1600, quality: 80, format: "webp", lqip: { width: 16, quality: 40 }, maxInputBytes: MAX_UPLOAD_BYTES }),
  directUpload: PhotoStorageFactory.createDirectUploadCoordinator(),
  maxUploadBytes: MAX_UPLOAD_BYTES,
  keyPrefix: (ownerId) => `photos/${ownerId}`,
});
```

`PhotoUploadServiceFactory.create(...)` returns the type `IPhotoUploadService`
— depend on that interface at call sites, not the concrete `PhotoUploadService` class.

## 2. Mount routes (server)

`PhotoUploadRouteFactory` (`PhotoUploadRouteFactory.ts`) has one static method per route this
feature needs:

```ts
// app/api/photos/upload/route.ts — the plain multipart path (works regardless of directUpload)
import { PhotoUploadRouteFactory } from "@/modules/photo-upload/PhotoUploadRouteFactory";
import { photoUploadService } from "@/lib/photoUpload";
import { getCurrentUser } from "@/lib/auth/session"; // however this project resolves the caller

export const POST = PhotoUploadRouteFactory.createUploadRoute(photoUploadService, async () => getCurrentUser());
```

```ts
// app/api/photos/upload/token/route.ts + app/api/photos/upload/finalize/route.ts — direct-upload path
export const POST = PhotoUploadRouteFactory.createDirectUploadTokenRoute(photoUploadService, async () => getCurrentUser());
// ...and PhotoUploadRouteFactory.createFinalizeRoute(...) in the finalize route
```

`authenticate` is the DI seam for identity — it's just `(request, context) => Promise<{ id: string } | null>`,
so any auth system works as long as it can answer "who is this request from."

## 3. Upload from the browser (client)

```ts
import { PhotoUploadPreparer, PhotoUploader } from "@/modules/photo-upload/client";

const supportsDirectUpload = process.env.NODE_ENV === "production";

// mustStripMetadata=supportsDirectUpload: the direct-upload path writes
// whatever bytes it's given straight to storage before the server ever
// processes them, so EXIF (which can carry GPS) must already be gone before
// that PUT — even for a file too small to otherwise need compressing.
const { file, previewUrl } = await PhotoUploadPreparer.prepare(
  rawFile,
  { maxDimension: 1600, quality: 0.85 },
  supportsDirectUpload
);

const result = await PhotoUploader.upload(
  file,
  supportsDirectUpload
    ? { mode: "direct", tokenUrl: "/api/photos/upload/token", finalizeUrl: "/api/photos/upload/finalize", keyPrefix: `photos/${userId}` }
    : { mode: "server", uploadUrl: "/api/photos/upload" }
);
if ("error" in result) {
  // show result.error
} else {
  // result.url, result.lqip — result is a PhotoUploadResultDto
}
```

`{ mode: "direct" }` defaults its transport to `new VercelBlobDirectUploadTransport()`.
Pass a `transport` of your own (implementing `IDirectUploadTransport`) if the
server side was wired to a different provider's `IDirectUploadCoordinator`.

## Notes

- `PhotoUploader.upload(file, endpoints, signal?)` takes an optional
  `AbortSignal` — pass one if the caller might cancel (the user replaces or
  removes the photo before it finishes). It's honored end-to-end (the plain
  upload route, the direct-to-Blob PUT, and the token/finalize requests), and
  `createUploadRoute`/`createFinalizeRoute` both bail out early with a 499 if
  `request.signal.aborted` by the time they'd otherwise start processing —
  but this narrows, not eliminates, the chance of an orphaned stored file: a
  disconnect isn't always observable that early (a fast enough upload can
  finish writing before the platform notices the client is gone). Treat it as
  best-effort, not a guarantee — a caller that cares about zero orphans still
  needs a periodic cleanup sweep for anything unreferenced.
- `keyPrefix` must be identical wherever it's referenced (service config, and
  the client's `DirectUploadEndpoints.keyPrefix`) — it's both the storage
  layout and the ownership check on delete/finalize.
- The direct-upload path is two round trips (token, then finalize) by design:
  `onUploadCompleted` webhooks require a publicly reachable callback URL, so
  they don't work in local dev and can't hand the processed result back to
  the original request anyway. Finalize instead runs synchronously right
  after the browser's PUT resolves.
- Local dev typically has no direct-upload coordinator configured, so gate
  which `PhotoUploader.upload` mode you pass the same way the composition
  root decides whether to construct a `directUpload` coordinator (see step 1)
  — usually a single `NODE_ENV` check.
