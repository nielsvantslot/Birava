-- Removes the forgot/reset password feature (never sent emails; leaked reset tokens in the API response).
ALTER TABLE "User" DROP COLUMN "passwordResetExpires";
ALTER TABLE "User" DROP COLUMN "passwordResetToken";
