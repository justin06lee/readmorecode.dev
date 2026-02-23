import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { createClient } from "@libsql/client/node";

config({ path: join(process.cwd(), ".env.local") });

const tursoUrl = process.env.TURSO_DB_URL;
const tursoToken = process.env.TURSO_DB_AUTH_TOKEN;
const dbFileName = process.env.DB_FILE_NAME;

if (!tursoUrl && !dbFileName) {
  console.error("Set either TURSO_DB_URL (Turso cloud) or DB_FILE_NAME (local) in .env.local");
  process.exit(1);
}

const client = tursoUrl
  ? createClient({ url: tursoUrl, authToken: tursoToken })
  : createClient({
      url: dbFileName!.startsWith("file:")
        ? dbFileName!
        : pathToFileURL(join(process.cwd(), dbFileName!)).href,
    });

async function main() {
  console.log("=== Migrate (db:migrate) ===");
  console.log("Applying schema: create tables if not exist, add category/language if missing.\n");

  const migrationPath = join(process.cwd(), "drizzle", "20260220224259_init", "migration.sql");
  const sql = readFileSync(migrationPath, "utf-8");
  const statements = sql
    .split(/--> statement-breakpoint\n?/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((stmt) => stmt.replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS "));

  for (const stmt of statements) {
    await client.execute(stmt);
    console.log("  Executed:", stmt.slice(0, 60) + "...");
  }

  console.log("\n  Checking category/language columns...");
  for (const col of ["category", "language"]) {
    try {
      await client.execute(`ALTER TABLE puzzles ADD COLUMN ${col} TEXT`);
      console.log("  Added column:", col);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("duplicate") && !msg.includes("already exists")) throw e;
      console.log("  Column already exists:", col, "(skipped)");
    }
  }
  console.log("\n=== Migration complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
