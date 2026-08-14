"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileUsername } from "@/lib/controllers/profileController";
import { PhotoUploadPreparer, PhotoUploader, PhotoMetadataStripFailedError } from "@/modules/photo-upload/client";
import { AVATAR_MAX_DIMENSION, avatarUploadEndpoints } from "@/lib/avatarPhotoConfig";
import { avatarSrc } from "@/lib/utils";
import { showToast } from "@/components/ui/toast-pill";

// Canvas-encode quality (0-1) is a client-only concern — the server's WebP
// quality (0-100, lib/avatarPhoto.ts) is a different encoder/scale.
const AVATAR_COMPRESS_CONFIG = { maxDimension: AVATAR_MAX_DIMENSION, quality: 0.85 };

interface ProfileEditFormProps {
  userId: string;
  username: string;
  avatarUrl: string | null;
  supportsDirectUpload: boolean;
}

/**
 * Moved here from the old click-to-edit affordances directly on /profile
 * (components/drink/profile-client.tsx's ProfileHead) — /profile is now
 * read-only for your own account too, same rendering as viewing someone
 * else's, and this dedicated /settings/profile screen owns editing instead.
 */
export function ProfileEditForm({ userId, username, avatarUrl, supportsDirectUpload }: ProfileEditFormProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [usernameValue, setUsernameValue] = useState(username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after an error
    if (!file) return;

    setAvatarUploading(true);
    setError(null);
    try {
      const { file: prepared } = await PhotoUploadPreparer.prepare(file, AVATAR_COMPRESS_CONFIG, supportsDirectUpload);
      const result = await PhotoUploader.upload(prepared, avatarUploadEndpoints(userId, supportsDirectUpload));
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof PhotoMetadataStripFailedError ? err.message : "Couldn't upload that image.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const trimmed = usernameValue.trim();
  const unchanged = trimmed === username;

  const handleSave = async () => {
    if (unchanged) return;
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { error: updateError } = await updateProfileUsername({ username: trimmed });
      if (updateError) {
        setError(updateError === "unique constraint" ? "That username is taken." : updateError);
        return;
      }
      showToast("Profile updated.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section">
      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 22px" }}>
        <div style={{ position: "relative", flex: "none" }}>
          <div
            className="avatar"
            role="button"
            tabIndex={0}
            aria-label="Change profile picture"
            title="Change profile picture"
            onClick={() => !avatarUploading && avatarInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !avatarUploading) {
                e.preventDefault();
                avatarInputRef.current?.click();
              }
            }}
            style={{
              width: 88,
              height: 88,
              fontSize: 26,
              cursor: avatarUploading ? "default" : "pointer",
              opacity: avatarUploading ? 0.6 : 1,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc(userId)} alt={username} />
            ) : (
              username.slice(0, 2).toUpperCase()
            )}
          </div>
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "var(--accent-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--surface)",
              pointerEvents: "none",
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="3.2"></circle>
            </svg>
          </span>
          <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="profile-username">Username</label>
        <input
          id="profile-username"
          value={usernameValue}
          onChange={(e) => setUsernameValue(e.target.value)}
        />
      </div>
      {error && <p style={{ color: "var(--destructive)", fontSize: 13, margin: "-8px 0 14px" }}>{error}</p>}

      <button className="btn btn-primary" disabled={saving || unchanged} onClick={handleSave}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
