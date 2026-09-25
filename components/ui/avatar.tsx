import { avatarSrc } from "@/lib/utils";

/**
 * The img-vs-initials content of an `.avatar`-classed element — callers keep
 * their own wrapping element (div/span/Link, whichever fits their layout,
 * already carrying the `.avatar` CSS class from app/globals.css) since that
 * varies by context; this centralizes the branch every avatar-having list/
 * header/card component used to hand-roll.
 */
export function Avatar({
  userId,
  username,
  avatarUrl,
  alt,
  lazy = false,
}: {
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** Defaults to `username` — only needed when the alt text should differ from the initials fallback's source name (e.g. a resolved display name vs. the raw username). */
  alt?: string;
  lazy?: boolean;
}) {
  if (!avatarUrl) return <>{username.slice(0, 2).toUpperCase()}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSrc(userId)}
      alt={alt ?? username}
      {...(lazy ? { loading: "lazy" as const, decoding: "async" as const } : {})}
    />
  );
}
