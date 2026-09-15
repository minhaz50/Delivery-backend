import type { Server } from "http";
import app from "./app";
import { config, assertRequiredEnv } from "./app/config";
import { prisma } from "./app/lib/prisma";

let server: Server;

async function main() {
  assertRequiredEnv();
  await prisma.$connect();
  console.log("[db] Connected to PostgreSQL via Prisma.");

  server = app.listen(config.port, () => {
    console.log(`[server] Courier & Logistics API listening on port ${config.port} (${config.env}).`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server?.close(async () => {
    await prisma.$disconnect();
    console.log("[server] Closed all connections. Bye.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  server?.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
