import { config } from "dotenv";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { createClient } from "@libsql/client/node";
import { getCategoryAndLanguageFromPath } from "../lib/categories";

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

type TableInfoRow = {
  name?: string | null;
};

type PuzzleMetadataRow = {
  id?: number | null;
  file?: string | null;
  category?: string | null;
  language?: string | null;
};

function getAddColumnTarget(statement: string) {
  const match = statement.match(
    /^ALTER TABLE\s+[`"]?([A-Za-z0-9_]+)[`"]?\s+ADD\s+[`"]?([A-Za-z0-9_]+)[`"]?/i
  );
  if (!match) {
    return null;
  }
  return {
    tableName: match[1]!,
    columnName: match[2]!,
  };
}

async function getExistingColumns(tableName: string) {
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  return new Set(
    result.rows
      .map((row) => (row as TableInfoRow).name)
      .filter((name): name is string => typeof name === "string" && name.length > 0)
  );
}

async function backfillPuzzleMetadata() {
  const result = await client.execute(
    "SELECT id, file, category, language FROM puzzles WHERE category IS NULL OR language IS NULL"
  );

  let updated = 0;
  for (const row of result.rows) {
    const puzzle = row as PuzzleMetadataRow;
    if (typeof puzzle.id !== "number" || typeof puzzle.file !== "string") {
      continue;
    }
    let path = "";
    try {
      const file = JSON.parse(puzzle.file) as { path?: string };
      path = file.path ?? "";
    } catch {
      continue;
    }
    if (!path) {
      continue;
    }
    const { category, language } = getCategoryAndLanguageFromPath(path);
    await client.execute({
      sql: "UPDATE puzzles SET category = ?, language = ? WHERE id = ?",
      args: [category, language, puzzle.id],
    });
    updated++;
  }

  return updated;
}

async function main() {
  console.log("=== Migrate (db:migrate) ===");
  console.log("Applying schema: create tables if not exist, add columns if missing.\n");

  const drizzleDir = join(process.cwd(), "drizzle");
  const migrationPaths = readdirSync(drizzleDir)
    .map((entry) => join(drizzleDir, entry, "migration.sql"))
    .sort();

  for (const migrationPath of migrationPaths) {
    const sql = readFileSync(migrationPath, "utf-8");
    const statements = sql
      .split(/--> statement-breakpoint\n?/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((stmt) =>
        stmt
          .replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ")
          .replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
          .replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ")
      );

    for (const stmt of statements) {
      const addColumnTarget = getAddColumnTarget(stmt);
      if (addColumnTarget) {
        const existingColumns = await getExistingColumns(addColumnTarget.tableName);
        if (existingColumns.has(addColumnTarget.columnName)) {
          console.log(
            "  Skipped:",
            `${addColumnTarget.tableName}.${addColumnTarget.columnName} already exists`
          );
          continue;
        }
      }
      await client.execute(stmt);
      console.log("  Executed:", stmt.slice(0, 60) + "...");
    }
  }

  console.log("\n  Checking category/language columns...");
  const puzzleColumns = await getExistingColumns("puzzles");
  for (const col of ["category", "language"]) {
    if (!puzzleColumns.has(col)) {
      await client.execute(`ALTER TABLE puzzles ADD COLUMN ${col} TEXT`);
      console.log("  Added column:", col);
      puzzleColumns.add(col);
    } else {
      console.log("  Column already exists:", col, "(skipped)");
    }
  }

  console.log("\n  Checking auth/profile tables...");
  const extraStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id integer PRIMARY KEY AUTOINCREMENT,
      email text NOT NULL UNIQUE,
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      avatar_url text,
      created_at integer NOT NULL,
      stripe_customer_id text,
      stripe_subscription_id text,
      subscription_status text,
      subscription_current_period_end integer
    )`,
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id integer PRIMARY KEY AUTOINCREMENT,
      user_id integer NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at integer NOT NULL,
      created_at integer NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS admin_sessions (
      id integer PRIMARY KEY AUTOINCREMENT,
      token_hash text NOT NULL UNIQUE,
      expires_at integer NOT NULL,
      created_at integer NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS request_rate_limits (
      id integer PRIMARY KEY AUTOINCREMENT,
      bucket_key text NOT NULL UNIQUE,
      scope text NOT NULL,
      identifier_hash text NOT NULL,
      count integer NOT NULL,
      reset_at integer NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS puzzle_attempts (
      id integer PRIMARY KEY AUTOINCREMENT,
      user_id integer NOT NULL,
      puzzle_id text NOT NULL,
      question text NOT NULL,
      language text,
      category text,
      correct integer NOT NULL,
      attempted_at integer NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS guest_daily_usage (
      id integer PRIMARY KEY AUTOINCREMENT,
      guest_day_key text NOT NULL UNIQUE,
      guest_key text NOT NULL,
      day_key text NOT NULL,
      count integer NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )`,
  ];

  for (const stmt of extraStatements) {
    await client.execute(stmt);
    console.log("  Ensured:", stmt.slice(0, 60) + "...");
  }

  console.log("\n  Checking billing columns on users...");
  const userColumns = await getExistingColumns("users");
  for (const col of [
    "stripe_customer_id TEXT",
    "stripe_subscription_id TEXT",
    "subscription_status TEXT",
    "subscription_current_period_end INTEGER",
  ]) {
    const [name] = col.split(" ");
    if (!userColumns.has(name!)) {
      await client.execute(`ALTER TABLE users ADD COLUMN ${col}`);
      console.log("  Added column:", name);
      userColumns.add(name!);
    } else {
      console.log("  Column already exists:", name, "(skipped)");
    }
  }

  console.log("\n  Backfilling puzzle metadata...");
  const backfilled = await backfillPuzzleMetadata();
  console.log(`  Backfilled puzzle rows: ${backfilled}`);
  console.log("\n=== Migration complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
