import { ApiError } from "@/lib/gateway/ApiError";
import { PhotoUploadError } from "@/modules/photo-upload/Errors/PhotoUploadError";
import { PhotoUploadRouteError } from "@/modules/photo-upload/Errors/PhotoUploadRouteError";

/** Turns the upload module's expected failures into the gateway's `ApiError`, so upload routes answer with the standard envelope. */
export class UploadErrorMapper {
  static async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof PhotoUploadRouteError) {
        throw error.status === 499 ? new ApiError("CLIENT_CLOSED", error.message) : ApiError.validation(error.message);
      }
      if (error instanceof PhotoUploadError) throw ApiError.validation(error.message);
      throw error;
    }
  }
}
