import { loadDrive, readFileEntry, uploadFile } from "../desktop/desktop-files";
import { sessionFetch } from "../desktop/desktop-server";
import { entryAtPath, PageFailure, type PageHost } from "./automator-page";
import loaderUrl from "./vendor/sql-wasm-browser.js?url";
import wasmUrl from "./vendor/sql-wasm-browser.wasm?url";

/*
 * Apply SQL: SQLite compiled to WebAssembly (sql.js 1.15.2, MIT; vendor/), which loads from the site's
 * own assets the first time the action runs. The database is read from the drive whole and changed in
 * memory, so a statement that fails leaves the file as it was.
 */

type SqlCell = string | number | Uint8Array | null;
interface SqlResult {
  columns: string[];
  values: SqlCell[][];
}
interface SqlDatabase {
  exec(sql: string, params?: readonly string[]): SqlResult[];
  export(): Uint8Array;
  close(): void;
}
export interface SqlEngine {
  Database: new (bytes?: Uint8Array) => SqlDatabase;
}

export interface SqlRequest {
  /** Empty when the input holds the statements. */
  sql: string;
  input: readonly string[];
  asCsv: boolean;
}

/** The rows as text, and the database's new bytes when the SQL changed them. */
export interface SqlOutcome {
  rows: string[];
  changed: Uint8Array | null;
}

const SQLITE_HEADER = "SQLite format 3\0";

/** Whether the SQL has a `?` that is not inside a string, a quoted name or a comment. */
export const takesValues = (sql: string) =>
  sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g, "").includes("?");

const cellText = (cell: SqlCell) =>
  cell === null ? "" : cell instanceof Uint8Array ? `<${cell.length} bytes>` : String(cell);
const csvCell = (text: string) => (/[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/**
 * Whether two copies of a database hold the same. SQLite stamps a file another version of it wrote
 * as it closes, even after only reading: the change counter, and the version beside it (bytes 24 to
 * 27 and 92 to 99 of the file format's header).
 */
const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length &&
  a.every((byte, at) => byte === b[at] || (at >= 24 && at < 28) || (at >= 92 && at < 100));

/** Runs the SQL on a copy of the database's bytes. `?` takes an item's text, split at tabs. */
export function runSql(engine: SqlEngine, bytes: Uint8Array, request: SqlRequest): SqlOutcome {
  const { sql, input, asCsv } = request;
  const header = String.fromCharCode(...bytes.subarray(0, SQLITE_HEADER.length));
  if (bytes.length > 0 && header !== SQLITE_HEADER) {
    throw new PageFailure("That file is not a SQLite database.");
  }
  const written = sql.trim() !== "";
  if (!written && input.length === 0) {
    throw new PageFailure("It was given no SQL: type some, or pass statements as its input.");
  }
  const values = written && takesValues(sql);
  if (values && input.length === 0) {
    throw new PageFailure("Its SQL has a ?, and it was given no input to fill it with.");
  }
  const database = new engine.Database(bytes);
  try {
    const results: SqlResult[] = [];
    if (!written) for (const statements of input) results.push(...database.exec(statements));
    else if (values)
      for (const item of input) results.push(...database.exec(sql, item.split("\t")));
    else results.push(...database.exec(sql));
    const rows = results.flatMap(({ values: found }) =>
      found.map((row) => {
        const cells = row.map(cellText);
        return asCsv ? cells.map(csvCell).join(",") : cells.join("|");
      }),
    );
    const after = database.export();
    return { rows, changed: sameBytes(after, bytes) ? null : after };
  } catch (error) {
    throw new PageFailure(`The SQL failed: ${error instanceof Error ? error.message : error}.`);
  } finally {
    database.close();
  }
}

declare global {
  var initSqlJs: ((config: { wasmBinary: ArrayBuffer }) => Promise<SqlEngine>) | undefined;
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("its script did not load"));
    document.head.append(script);
  });
}

let engine: Promise<SqlEngine> | null = null;

function loadEngine(): Promise<SqlEngine> {
  engine ??= (async () => {
    const wasm = await sessionFetch(wasmUrl, { credentials: "same-origin" });
    if (!wasm.ok) throw new Error(`its code answered ${wasm.status}`);
    const wasmBinary = await wasm.arrayBuffer();
    if (!globalThis.initSqlJs) await loadScript(loaderUrl);
    if (!globalThis.initSqlJs) throw new Error("its script did not start");
    return globalThis.initSqlJs({ wasmBinary });
  })().catch((error: unknown) => {
    engine = null;
    throw new PageFailure(
      `SQLite could not be loaded: ${error instanceof Error ? error.message : error}.`,
    );
  });
  return engine;
}

/** Runs the SQL on the drive's database at `path` and writes the file back if it changed. */
export async function applySql(
  path: string,
  request: SqlRequest,
  session: PageHost["session"],
): Promise<string[]> {
  if (path === "") throw new PageFailure("It needs the path of a database file on your drive.");
  const found = entryAtPath(await loadDrive(), path);
  if (found?.kind !== "file") throw new PageFailure(`Your drive has no file at “${path}”.`);
  const { blob, entry } = await readFileEntry(found.id);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { rows, changed } = runSql(await loadEngine(), bytes, request);
  if (changed) {
    await uploadFile(new Blob([changed.slice()], { type: entry.type }), entry.parent ?? "", {
      name: entry.name,
      existing: "overwrite",
      replaces: entry.id,
      base: entry.version ?? 0,
      session,
    });
  }
  return rows;
}
