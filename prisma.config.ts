// Prisma CLI configuration
// Migrations need a session connection, so the CLI uses DIRECT_URL (Supabase session pooler, port 5432)
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
