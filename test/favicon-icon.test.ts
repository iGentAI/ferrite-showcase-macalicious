// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The site's /favicon.ico (ferrite-apps/desktop/src/favicon.rs) answers the icon the desktop page declares inline
 * (docs/desktop/index.html): Chrome asks for /favicon.ico for every other document the site serves, and both must
 * show the same Finder icon. The Rust tests cannot read the page (the Ferrite code gate refuses file reads in an app's
 * tests), so the two are held to the same bytes here.
 */

const root = path.join(import.meta.dirname, "..");

/** The PNG the desktop page declares inline. */
function pageIcon(): Buffer {
  const html = readFileSync(path.join(root, "docs/desktop/index.html"), "utf8");
  const match = html.match(
    /<link rel="icon" type="image\/png" href="data:image\/png;base64,([A-Za-z0-9+/=]+)" \/>/,
  );
  if (!match?.[1]) throw new Error("the desktop page declares no inline PNG icon");
  return Buffer.from(match[1], "base64");
}

/** The bytes of `pub const PNG: &[u8] = &[...]` in the server's favicon module. */
function serverIcon(): Buffer {
  const rust = readFileSync(path.join(root, "ferrite-apps/desktop/src/favicon.rs"), "utf8");
  const match = rust.match(/pub const PNG: &\[u8\] = &\[([\s\d,]+)\];/);
  if (!match?.[1]) throw new Error("src/favicon.rs holds no PNG byte array");
  return Buffer.from(
    match[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number),
  );
}

describe("the site's icon", () => {
  it("is the same 32-pixel PNG on the page and at /favicon.ico", () => {
    const page = pageIcon();
    const server = serverIcon();
    expect(page.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect([page.readUInt32BE(16), page.readUInt32BE(20)]).toEqual([32, 32]);
    expect(server.length).toBe(page.length);
    expect(server.equals(page)).toBe(true);
  });
});
