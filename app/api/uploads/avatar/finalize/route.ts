import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/gateway/ApiError";
import { gateway } from "@/modules/identity/server/gateway";
import { finalizeAvatarUpload } from "@/modules/identity";
import { PhotoUploadError } from "@/modules/photo-upload/Errors/PhotoUploadError";
import { UploadErrorMapper } from "@/modules/media/server/UploadErrorMapper";
import { uploadUrlInput } from "@/modules/media/contract/uploadContract";

// sharp + storage need Node, not edge.
export const runtime = "nodejs";

// Hand-rolled rather than PhotoUploadRouteHandlers.finalize — that only knows
// the generic store/return-url contract, not this app's avatar-specific side
// effect of also pointing User.avatarUrl at the result. Mirrors ./route.ts's
// plain-upload path, which needs the exact same step.
export const POST = gateway.route.authed(
  { name: "uploads.avatar.finalize", body: uploadUrlInput },
  ({ request, user, input }) =>
    UploadErrorMapper.run(async () => {
      if (request.signal.aborted) throw new ApiError("CLIENT_CLOSED", "Upload cancelled.");

      const result = await finalizeAvatarUpload(user.id, input.body.url).catch((error: unknown) => {
        if (error instanceof PhotoUploadError) throw error;
        throw ApiError.validation("Failed to process photo.");
      });
      if (result.error) throw new ApiError("INTERNAL", result.error);
      revalidatePath("/profile");
      return result;
    })
);
