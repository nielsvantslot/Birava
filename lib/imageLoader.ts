import type { ImageLoaderProps } from "next/image";

/**
 * Configured as next.config.ts's images.loaderFile. A `loader` prop can't be
 * passed directly to next/image from a Server Component (Next throws:
 * functions can't cross the server/client boundary as props) — the
 * supported way to use a custom loader is this app-wide config file.
 * Applies to every non-`unoptimized` <Image>; components that pass
 * `unoptimized` (checkin-grid.tsx) are untouched by this.
 */
export default function photoLoader({ src, width }: ImageLoaderProps): string {
  return `${src}?w=${width}`;
}
