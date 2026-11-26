// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * The copy-in registry builder, run as `npm run build` runs it, on a small fixture package.
 * A registry item must list everything `macalicious add` has to copy; what the builder cannot
 * follow has to stop the build rather than be left out.
 */
const script = path.resolve(import.meta.dirname, "../scripts/build-registry.mjs");

let root: string;

function write(file: string, content: string) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function build() {
  return spawnSync(process.execPath, [script, "--root", root], { encoding: "utf8" });
}

function files(name: string): string[] {
  const item = JSON.parse(readFileSync(path.join(root, `dist/registry/${name}.json`), "utf8"));
  return item.files.map((file: { path: string }) => file.path);
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "macalicious-registry-"));
  write(
    "package.json",
    JSON.stringify({
      name: "macalicious",
      version: "0.0.0",
      dependencies: { "@base-ui/react": "^1.8.0" },
    }),
  );
  write("src/styles/index.css", ":root {}\n");
  write("src/lib/appearance.ts", "export {};\n");
  write("src/lib/window-activation.ts", "export {};\n");
  write("src/lib/cn.ts", 'export { helper } from "./helper";\n');
  write("src/lib/helper.ts", "export const helper = 1;\n");
  write("src/components/label/index.ts", 'export { Label } from "./label";\n');
  write("src/components/label/label.tsx", "export const Label = () => null;\n");
  write("src/components/toolbar/index.ts", 'export { Toolbar } from "./toolbar";\n');
  write(
    "src/components/toolbar/toolbar.tsx",
    [
      'import { Button } from "@base-ui/react/button"; // the primitive',
      'import { cn } from "../../lib/cn"; // a trailing comment must not hide this import',
      'import { Label } from "../label";',
      'import { part } from "./parts/part";',
      'import "./toolbar.css";',
      "export const Toolbar = () => [Button, cn, Label, part];",
      "",
    ].join("\n"),
  );
  write("src/components/toolbar/parts/part.ts", "export const part = 1;\n");
  write("src/components/toolbar/toolbar.css", ".mac-toolbar {}\n");
  write("src/components/toolbar/toolbar.test.tsx", "export {};\n");
  write("src/components/toolbar/examples/basic.tsx", "export default function Basic() {}\n");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("build-registry", () => {
  it("lists a component's files in subfolders, its helpers and their helpers", () => {
    const run = build();
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(files("toolbar")).toEqual([
      "components/toolbar/index.ts",
      "components/toolbar/parts/part.ts",
      "components/toolbar/toolbar.css",
      "components/toolbar/toolbar.tsx",
      "lib/cn.ts",
      "lib/helper.ts",
    ]);
    const item = JSON.parse(readFileSync(path.join(root, "dist/registry/toolbar.json"), "utf8"));
    expect(item.registryDependencies).toEqual(["label", "tokens"]);
    expect(item.dependencies).toEqual(["@base-ui/react@^1.8.0"]);
    expect(files("tokens")).toEqual([
      "styles/index.css",
      "lib/appearance.ts",
      "lib/window-activation.ts",
    ]);
  });

  it("stops at a stylesheet in a subfolder, which the package would not ship", () => {
    write("src/components/toolbar/parts/part.css", ".mac-toolbar-part {}\n");
    write("src/components/toolbar/parts/part.ts", 'import "./part.css";\nexport const part = 1;\n');
    const run = build();
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("src/components/toolbar/parts/part.css");
    expect(run.stderr).toContain("stylesheets live at the top level");
  });

  it("follows the imports of the theming helpers that travel with the tokens", () => {
    write(
      "src/lib/appearance.ts",
      'import { Button } from "@base-ui/react/button";\nexport { helper } from "./helper";\nexport const b = Button;\n',
    );
    expect(build().status).toBe(0);
    expect(files("tokens")).toEqual([
      "styles/index.css",
      "lib/appearance.ts",
      "lib/helper.ts",
      "lib/window-activation.ts",
    ]);
    const item = JSON.parse(readFileSync(path.join(root, "dist/registry/tokens.json"), "utf8"));
    expect(item.dependencies).toEqual(["@base-ui/react@^1.8.0"]);

    write("src/lib/appearance.ts", 'export { Label } from "../components/label";\n');
    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("leaves lib");
  });

  it("fails when source imports a file that is not copied", () => {
    write(
      "src/components/toolbar/toolbar.tsx",
      'import Basic from "./examples/basic";\nexport const Toolbar = Basic;\n',
    );
    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("is not copied with the component");
  });

  it("fails on an import that leaves the component", () => {
    write(
      "src/components/toolbar/toolbar.tsx",
      'import "../../styles/index.css";\nexport const Toolbar = 1;\n',
    );
    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("leaves the component");
  });

  it.each(["../label/label", "../label/index/missing"])(
    "fails on an import of %s, which is not another component's entry",
    (specifier) => {
      write(
        "src/components/toolbar/toolbar.tsx",
        `import { Label } from "${specifier}";\nexport const Toolbar = Label;\n`,
      );
      const run = build();
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("import another component through its folder");
    },
  );

  it("fails on a dynamic import it cannot follow, and follows a literal one", () => {
    // A path built at run time, written without a template literal in this file.
    write(
      "src/components/toolbar/toolbar.tsx",
      'export const Toolbar = (name: string) => import("./parts/" + name);\n',
    );
    expect(build().stderr).toContain("computed path");

    write(
      "src/components/toolbar/toolbar.tsx",
      'export const Toolbar = () => import("../../lib/cn");\n',
    );
    expect(build().status).toBe(0);
    expect(files("toolbar")).toContain("lib/cn.ts");
  });

  it("fails on a component whose name the registry reserves", () => {
    write("src/components/tokens/index.ts", "export const x = 1;\n");
    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("reserved");
  });
});
