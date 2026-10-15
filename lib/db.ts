import { PrismaClient } from "@prisma/client";
import { Env } from "@/lib/env/Env";

declare global {
  var prisma: PrismaClient | undefined;
}

export const db =
  globalThis.prisma ??
  new PrismaClient({
    log: Env.server.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (!Env.isProduction) globalThis.prisma = db;
