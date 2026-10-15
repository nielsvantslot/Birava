import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/gateway/ApiError";
import { gateway } from "@/modules/identity/server/gateway";
import { storeAvatar } from "@/modules/identity";
import { PhotoUploadError } from "@/modules/photo-upload/Errors/PhotoUploadError";
import { UploadErrorMapper } from "@/modules/media/server/UploadErrorMapper";
import { uploadFileForm } from "@/modules/media/contract/uploadContract";

// sharp + storage need Node, not edge.
export const runtime = "nodejs";

export const POST = gateway.route.authed(
  { name: "uploads.avatar.create", form: uploadFileForm },
  ({ user, input }) =>
    UploadErrorMapper.run(async () => {
      const result = await storeAvatar(user.id, input.form.file).catch((error: unknown) => {
        if (error instanceof PhotoUploadError) throw error;
        throw new ApiError("INTERNAL", "Couldn't upload that image. Try another.");
      });
      if (result.error) throw new ApiError("INTERNAL", result.error);
      revalidatePath("/profile");
      return result;
    })
);
