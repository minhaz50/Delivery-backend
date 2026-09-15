import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { config } from "../config";

declare global {
  var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
  max: config.env === "production" ? 1 : 10,
});

export const prisma =
  global.__prisma ||
  new PrismaClient({
    adapter,
    log: config.env === "development" ? ["warn", "error"] : ["error"],
  });

if (config.env !== "production") {
  global.__prisma = prisma;
}
