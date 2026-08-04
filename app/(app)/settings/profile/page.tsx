import { getCurrentUser } from "@/lib/auth/session";
import { avatarPhotoService } from "@/lib/avatarPhoto";
import { ProfileEditForm } from "@/components/drink/profile-edit-form";

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <ProfileEditForm
      userId={user.id}
      username={user.username}
      avatarUrl={user.avatarUrl}
      supportsDirectUpload={avatarPhotoService.supportsDirectUpload}
    />
  );
}
