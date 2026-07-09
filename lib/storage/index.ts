import * as local from "./local";
import * as blob from "./blob";

// `next dev` (including inside docker-compose) always runs with
// NODE_ENV=development, so local development stays on-disk and never
// touches Blob storage. Vercel builds set NODE_ENV=production for both
// the production and staging/preview deployments.
const backend = process.env.NODE_ENV === "production" ? blob : local;

export const saveBeerPhoto = backend.saveBeerPhoto;
export const removeBeerPhotoByUrl = backend.removeBeerPhotoByUrl;
