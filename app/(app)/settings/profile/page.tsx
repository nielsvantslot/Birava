import { getCurrentUser } from "@/modules/identity/server/session";
import { avatarPhotoService } from "@/modules/media/server/avatarPhoto";
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
