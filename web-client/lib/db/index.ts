import "server-only";
import { join } from "path";
import { pathToFileURL } from "url";
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql/node";

const tursoUrl = process.env.TURSO_DB_URL;
const tursoToken = process.env.TURSO_DB_AUTH_TOKEN;
const dbFileName = process.env.DB_FILE_NAME;

if (!tursoUrl && !dbFileName) {
  throw new Error("Set either TURSO_DB_URL (Turso cloud) or DB_FILE_NAME (local SQLite) in .env.local");
}

const client = tursoUrl
  ? createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
  : createClient({
      url: dbFileName!.startsWith("file:")
        ? dbFileName!
        : pathToFileURL(join(process.cwd(), dbFileName!)).href,
    });

export const db = drizzle({ client });

export { puzzlesTable, reportsTable } from "./schema";
