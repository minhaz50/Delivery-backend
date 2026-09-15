import { PrismaClient } from "../../generated/prisma";
import { config } from "../config";

// Always import `prisma` from here — never `new PrismaClient()` elsewhere.
// A single shared instance manages the connection pool correctly and lets
// us attach logging/middleware in one place.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: config.env === "development" ? ["warn", "error"] : ["error"],
  });

if (config.env !== "production") {
  global.__prisma = prisma;
}
