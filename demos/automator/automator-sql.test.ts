import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { runSql, type SqlEngine, takesValues } from "./automator-sql";

const vendor = `${process.cwd()}/demos/automator/vendor/`;
let engine: SqlEngine;

beforeAll(async () => {
  const module = { exports: {} as (config: { wasmBinary: Buffer }) => Promise<SqlEngine> };
  new Function("module", "exports", readFileSync(`${vendor}sql-wasm-browser.js`, "utf8"))(
    module,
    module.exports,
  );
  engine = await module.exports({ wasmBinary: readFileSync(`${vendor}sql-wasm-browser.wasm`) });
});

const empty = new Uint8Array();
const run = (bytes: Uint8Array, sql: string, input: string[] = [], asCsv = false) =>
  runSql(engine, bytes, { sql, input, asCsv });

function filled(): Uint8Array {
  const made = run(
    empty,
    "CREATE TABLE t(a, b); INSERT INTO t VALUES ('one', 1), ('t,w\"o', NULL)",
  );
  return made.changed as Uint8Array;
}

describe("Apply SQL", () => {
  it("passes rows on as text and leaves the bytes alone when nothing changed", () => {
    expect(run(filled(), "SELECT * FROM t")).toEqual({
      rows: ["one|1", 't,w"o|'],
      changed: null,
    });
    expect(run(filled(), "SELECT * FROM t", [], true).rows).toEqual(["one,1", '"t,w""o",']);
  });

  it("counts a file another SQLite wrote as unchanged after a read", () => {
    const other = filled();
    other.set([0, 0, 0, 7], 24);
    other.set([0, 0, 0, 7], 92);
    other.set([0, 46, 0, 1], 96);
    expect(run(other, "SELECT * FROM t").changed).toBeNull();
  });

  it("takes statements from the input when its SQL is empty", () => {
    const { changed } = run(filled(), "", ["INSERT INTO t VALUES ('three', 3)"]);
    expect(run(changed as Uint8Array, "SELECT count(*) FROM t").rows).toEqual(["3"]);
  });

  it("fills each ? from one item, once per item, an item's tabs parting several", () => {
    const { changed } = run(filled(), "INSERT INTO t VALUES (?, ?)", ["x\t8", "y\t9"]);
    expect(run(changed as Uint8Array, "SELECT a, b FROM t WHERE a IN ('x', 'y')").rows).toEqual([
      "x|8",
      "y|9",
    ]);
    expect(run(filled(), "SELECT b FROM t WHERE a = ?", ["one"]).rows).toEqual(["1"]);
  });

  it("reads a ? only outside strings and comments", () => {
    expect(takesValues("SELECT '?' -- ?\n/* ? */")).toBe(false);
    expect(takesValues("SELECT ? FROM t")).toBe(true);
  });

  it("refuses a file that is not a database, and SQL that fails, and changes nothing", () => {
    expect(() => run(new TextEncoder().encode("hello"), "SELECT 1")).toThrow("not a SQLite");
    expect(() => run(filled(), "INSERT INTO t VALUES (1, 2); NOT SQL")).toThrow("The SQL failed");
    expect(() => run(filled(), "")).toThrow("no SQL");
    expect(() => run(filled(), "SELECT ?")).toThrow("no input");
  });
});
