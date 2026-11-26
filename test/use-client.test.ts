// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isReexportOnly } from "../scripts/lib/built-sources.mjs";
import { packageEntries } from "../scripts/lib/package-entries.mjs";
import { clientDirectiveReport, hasUseClient, isClientModule } from "../scripts/lib/use-client.mjs";

/**
 * The library build writes "use client" back at the top of every built file that holds a
 * module marked with it, and the package check (run by `npm run build`) fails when one is
 * missing. The bundler dropped the directive once: four components shipped without it, and a
 * server component that rendered one of them stopped a Next.js build.
 */
describe("hasUseClient", () => {
  it.each([
    ['"use client";\nimport { useState } from "react";', true],
    ["'use client'\nimport { useState } from 'react';", true],
    ['// A comment.\n/* another */\n"use client";\n', true],
    ['\uFEFF"use client";', true],
    ['"use strict";\n"use client";\nexport {};', true],
    ['"use client"', true],
    // A comment between the string and the end of the statement.
    ['"use client" // the boundary\nexport function Meter() {}', true],
    ['"use client" /* the boundary */;\nexport {};', true],
    ['"use client" /* over\n two lines */\nexport {};', true],
    ['"use strict" // first\n"use client"\nconst x = <T,>(value: T) => value;', true],
    // Not in the prologue: an expression after a statement, a different string, a comment.
    ['import { useState } from "react";\n"use client";', false],
    ['"use server";\nexport {};', false],
    ['// "use client";\nexport {};', false],
    ['const directive = "use client";', false],
    ['"use client" + "";', false],
    // No semicolon is inserted before these: the string is part of a longer expression.
    ['"use client"\n(globalThis.setup)();', false],
    ['"use client"\n.length;', false],
    ['"use client"\n[0];', false],
    // An escape makes it another directive.
    ['"use\\x20client";', false],
    ["", false],
  ])("%j: %s", (code, expected) => {
    expect(hasUseClient(code)).toBe(expected);
  });
});

describe("isReexportOnly", () => {
  it.each([
    ['import { t as Box } from "../chunks/box-1.js";\nexport { Box };\n', true],
    ['export * from "./components/box.js";\nexport { cn } from "./lib/cn.js";\n', true],
    ["export {};\n", true],
    ["", true],
    ['import { cn } from "../lib/cn.js";\nfunction Meter() {}\nexport { Meter };\n', false],
    ["export const size = 1;\n", false],
  ])("%j: %s", (code, expected) => {
    expect(isReexportOnly(code)).toBe(expected);
  });
});

describe("the client directive in a built tree", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "macalicious-client-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  const built = (file: string, code: string, sources: string[]) => {
    write(file, code);
    write(`${file}.map`, JSON.stringify({ version: 3, sources, mappings: "" }));
  };

  it("names a built file that holds a client module and lost the directive", () => {
    write("src/components/meter/meter.tsx", '"use client";\nexport function Meter() {}\n');
    write("src/components/plain/plain.tsx", "export function Plain() {}\n");
    write("src/lib/cn.ts", "export const cn = () => '';\n");
    // As the bundler writes it: the directive gone, the modules merged.
    built("dist/chunks/meter-1.js", 'import { cn } from "../lib/cn.js";\nfunction Meter() {}\n', [
      "../../src/lib/cn.ts",
      "../../src/components/meter/meter.tsx",
    ]);
    built("dist/chunks/plain-1.js", "function Plain() {}\n", [
      "../../src/components/plain/plain.tsx",
    ]);
    // An entry that only passes its chunk on has no source map, and needs none.
    write("dist/components/meter.js", 'export { Meter } from "../chunks/meter-1.js";\n');

    const report = clientDirectiveReport(path.join(root, "dist"));
    expect(report.marked).toBe(0);
    expect(report.unreadable).toEqual([]);
    expect(report.missing).toEqual([
      {
        file: path.join(root, "dist/chunks/meter-1.js"),
        source: path.join(root, "src/components/meter/meter.tsx"),
      },
    ]);

    // With the directive written back, nothing is missing; the plain files stay as they are.
    built("dist/chunks/meter-1.js", '"use client";\nimport { cn } from "../lib/cn.js";\n', [
      "../../src/lib/cn.ts",
      "../../src/components/meter/meter.tsx",
    ]);
    expect(clientDirectiveReport(path.join(root, "dist"))).toEqual({
      missing: [],
      marked: 1,
      unreadable: [],
    });
  });

  it("does not pass a file that holds code and has no source map", () => {
    // The directive and the map both lost: nothing says what the file holds.
    write("src/components/meter/meter.tsx", '"use client";\nexport function Meter() {}\n');
    write("dist/chunks/meter-1.js", "function Meter() {}\nexport { Meter };\n");
    const report = clientDirectiveReport(path.join(root, "dist"));
    expect(report.missing).toEqual([]);
    expect(report.unreadable).toHaveLength(1);
    expect(report.unreadable[0]?.reason).toMatch(/meter-1\.js holds code and has no source map/);
  });

  it("does not pass a file whose source map names a source that does not exist", () => {
    // A stale map, or one in the wrong place: the source that would say "use client" is not
    // where the map points, so the file must not be taken for one without client code.
    write("src/components/meter/meter.tsx", '"use client";\nexport function Meter() {}\n');
    built("dist/chunks/meter-1.js", "function Meter() {}\nexport { Meter };\n", [
      "../../src/components/meter/renamed.tsx",
    ]);
    const report = clientDirectiveReport(path.join(root, "dist"));
    expect(report.missing).toEqual([]);
    expect(report.marked).toBe(0);
    expect(report.unreadable).toHaveLength(1);
    expect(report.unreadable[0]?.reason).toMatch(
      /meter-1\.js: its source map names 1 source file\(s\) that do not exist \(.*renamed\.tsx\)/,
    );
  });

  it("takes the bundler's own sources for what they are, and still reads the files beside them", () => {
    write("src/components/meter/meter.tsx", '"use client";\nexport function Meter() {}\n');
    built("dist/chunks/meter-1.js", "function Meter() {}\nexport { Meter };\n", [
      "\0rolldown/runtime.js",
      "rolldown:runtime",
      "../../src/components/meter/meter.tsx",
    ]);
    const report = clientDirectiveReport(path.join(root, "dist"));
    expect(report.unreadable).toEqual([]);
    expect(report.missing).toEqual([
      {
        file: path.join(root, "dist/chunks/meter-1.js"),
        source: path.join(root, "src/components/meter/meter.tsx"),
      },
    ]);
  });

  it("sees a directive that is added to a source or removed from it", () => {
    const file = path.join(root, "src/components/meter/meter.tsx");
    write("src/components/meter/meter.tsx", "export function Meter() {}\n");
    expect(isClientModule(file)).toBe(false);
    // A watching build asks again after the file has changed.
    write("src/components/meter/meter.tsx", '"use client";\nexport function Meter() {}\n');
    utimesSync(file, new Date(), new Date(Date.now() + 2000));
    expect(isClientModule(file)).toBe(true);
    write("src/components/meter/meter.tsx", "export function Meter() { return null; }\n");
    utimesSync(file, new Date(), new Date(Date.now() + 4000));
    expect(isClientModule(file)).toBe(false);
  });

  it("sees a directive replaced by one of the same length at the same file time", () => {
    const file = path.join(root, "src/components/meter/meter.tsx");
    const time = new Date("2026-01-01T00:00:00Z");
    write("src/components/meter/meter.tsx", '"use server";\nexport function Meter() {}\n');
    utimesSync(file, time, time);
    expect(isClientModule(file)).toBe(false);
    write("src/components/meter/meter.tsx", '"use client";\nexport function Meter() {}\n');
    utimesSync(file, time, time);
    expect(isClientModule(file)).toBe(true);
  });
});

describe("the JavaScript entries of the package", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "macalicious-entries-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const write = (file: string, content = "") => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  const pkg = {
    name: "macalicious",
    exports: {
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      "./styles.css": "./dist/styles.css",
      "./lib/*": { types: "./dist/lib/*.d.ts", import: "./dist/lib/*.js" },
      "./*.css": "./dist/components/*.css",
      "./*": { types: "./dist/components/*/index.d.ts", import: "./dist/components/*.js" },
      "./package.json": "./package.json",
    },
  };

  it("names the root entry, every component and every helper, from the source tree", () => {
    write("src/components/meter/index.ts");
    write("src/components/plain/index.ts");
    write("src/components/draft/draft.tsx"); // no index.ts: not a component
    write("src/lib/cn.ts");
    write("src/lib/cn.test.ts");
    for (const file of ["index", "components/meter", "components/plain", "lib/cn"]) {
      write(`dist/${file}.js`);
    }
    const { entries, missing } = packageEntries(root, pkg);
    expect(entries.map((entry) => entry.specifier)).toEqual([
      "macalicious",
      "macalicious/lib/cn",
      "macalicious/meter",
      "macalicious/plain",
    ]);
    expect(entries[2]?.file).toBe(path.join(root, "dist/components/meter.js"));
    expect(missing).toEqual([]);
  });

  it("reports an entry whose built file is missing instead of leaving it out", () => {
    write("src/components/meter/index.ts");
    write("src/lib/cn.ts");
    write("dist/index.js");
    write("dist/components/meter.js");
    const { entries, missing } = packageEntries(root, pkg);
    expect(entries).toHaveLength(3);
    expect(missing.map((entry) => entry.specifier)).toEqual(["macalicious/lib/cn"]);
  });
});
