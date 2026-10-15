import { db } from "@/lib/db";
import { PrismaSessionRepository } from "@/modules/identity/infrastructure/PrismaSessionRepository";

/** Composition root for session storage: the one place the Prisma implementation is chosen. */
export const sessionRepository = new PrismaSessionRepository(db);
