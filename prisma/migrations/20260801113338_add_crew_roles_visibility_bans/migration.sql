-- CreateEnum
CREATE TYPE "public"."GroupVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "public"."GroupMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "public"."Group" ADD COLUMN     "visibility" "public"."GroupVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "public"."GroupMember" ADD COLUMN     "role" "public"."GroupMemberRole" NOT NULL DEFAULT 'MEMBER';

-- Backfill: every existing group's owner membership row must be OWNER, not
-- the column default MEMBER it would otherwise silently get on existing rows.
UPDATE "public"."GroupMember" gm
SET "role" = 'OWNER'
FROM "public"."Group" g
WHERE gm."groupId" = g."id" AND gm."userId" = g."ownerId";

-- CreateTable
CREATE TABLE "public"."GroupBan" (
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bannedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupBan_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateIndex
CREATE INDEX "GroupBan_userId_idx" ON "public"."GroupBan"("userId");

-- AddForeignKey
ALTER TABLE "public"."GroupBan" ADD CONSTRAINT "GroupBan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupBan" ADD CONSTRAINT "GroupBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
