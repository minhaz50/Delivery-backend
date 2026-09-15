import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema/schema.prisma", // <-- file, not folder
  migrations: {
    path: "prisma/schema/migrations", // <-- must match where migrations actually live
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
