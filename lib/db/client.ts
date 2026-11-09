import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type AppDatabase = PgliteDatabase<typeof schema>;

const globalState = globalThis as unknown as {
  webuiltgovDb?: AppDatabase;
  opening?: Promise<AppDatabase>;
};

async function applySqlMigrations(exec: (sql: string) => Promise<unknown>) {
  const directory = path.join(process.cwd(), "migrations");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await exec(await readFile(path.join(directory, file), "utf8"));
  }
}

export async function createTestDb(): Promise<AppDatabase> {
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite();
  await applySqlMigrations((sqlText) => client.exec(sqlText));
  return drizzlePglite(client, { schema });
}

async function openDb(): Promise<AppDatabase> {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (databaseUrl !== "") {
    const pg = await import("pg");
    const pool = new pg.default.Pool({ connectionString: databaseUrl, max: 5 });
    return drizzlePg(pool, { schema }) as unknown as AppDatabase;
  }
  return createTestDb();
}

export function getDb(): Promise<AppDatabase> {
  if (globalState.webuiltgovDb) return Promise.resolve(globalState.webuiltgovDb);
  globalState.opening ??= openDb()
    .then((database) => {
      globalState.webuiltgovDb = database;
      return database;
    })
    .catch((error: unknown) => {
      globalState.opening = undefined;
      throw error;
    });
  return globalState.opening;
}
