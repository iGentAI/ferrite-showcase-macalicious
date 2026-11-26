import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The account's menu bar title must be one the menu bar can leave out on a narrow screen. On
 * 15 November it set `display: block` inline, which beats the bar's `[data-overflow] { display:
 * none }`, so at 390 points the left-out cell was still drawn over the titles ("Window ·ephen").
 */
describe("the account's menu bar title", () => {
  const source = readFileSync(path.join(import.meta.dirname, "desktop-menus.tsx"), "utf8");
  const userCell = source.slice(
    source.indexOf("const userCell = {"),
    source.indexOf("} as const;", source.indexOf("const userCell = {")),
  );

  it("sets no display of its own inline", () => {
    expect(userCell).toContain("mac-desktop-shell-user-cell");
    expect(userCell).not.toMatch(/\bdisplay\s*:/);
  });

  it("takes its block display from the stylesheet only while it is drawn", () => {
    const css = readFileSync(path.join(import.meta.dirname, "desktop.css"), "utf8");
    expect(css).toMatch(
      /\.mac-desktop-shell-user-cell:not\(\[data-overflow\]\) \{\s*display: block;/,
    );
  });
});
