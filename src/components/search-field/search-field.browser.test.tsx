// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { SearchField } from "./index";

/*
 * What only a browser can show: where the stylesheet lays out the store field's centred copy
 * of its glass and placeholder. The copy has to behave as the placeholder it stands in for:
 * cut off inside the field's padding when it is too long, and with its spaces kept. The
 * component is rendered by React and styled by the stylesheets it ships with; each engine
 * Playwright has installed is used (`npm run visual:install` installs Chromium), and an
 * engine that is not installed is skipped. Set REQUIRE_BROWSER_TESTS=1 where the engines must
 * be there: the run then fails and names each one that is missing (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the component's own two. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(path.join(here, "search-field.tokens.css"), path.join(here, "search-field.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const SPACES = 12;

function page() {
  const body = renderToStaticMarkup(
    <div style={{ display: "grid", justifyItems: "start", gap: 12 }}>
      <SearchField id="plain" variant="store" style={{ width: 180 }} />
      <SearchField
        id="long"
        variant="store"
        placeholder="Search the whole store for apps and stories"
        style={{ width: 80 }}
      />
      <SearchField id="one-space" variant="store" placeholder="a b" style={{ width: 180 }} />
      <SearchField
        id="spaces"
        variant="store"
        placeholder={`a${" ".repeat(SPACES)}b`}
        style={{ width: 180 }}
      />
      <SearchField
        id="broken"
        variant="store"
        placeholder={"Search\nthe\r\nstore"}
        style={{ width: 180 }}
      />
      <SearchField id="forced" variant="store" data-force="focus" style={{ width: 180 }} />
    </div>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

interface Reading {
  /** Whether the centred copy is shown. */
  shown: boolean;
  /** Points from the field's edges to the box the copy is clipped to. */
  clip: [number, number];
  /** Left and right edge of the copy's text, in points from the field's left edge. */
  text: [number, number];
  /** Width of the field. */
  width: number;
  /** Height of the copy's text: one line's, however the placeholder is written. */
  height: number;
  /** The copy's text. */
  copy: string;
  /** Whether the field's own glass is drawn (it is hidden while the copy is shown). */
  glass: boolean;
  /** Left edge of the field's own glass, in points from the field's left edge. */
  glassLeft: number;
}

requireEveryEngine("the SearchField tests");

describe.each(Object.keys(ENGINES))("The store SearchField in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Reads the centred copy of the field whose input has `id`. */
  async function read(id: string) {
    const context = await browser.newContext();
    try {
      const tab = await context.newPage();
      await tab.setContent(page());
      return await tab.evaluate((id): Reading => {
        const field = (document.getElementById(id) as HTMLElement).parentElement as HTMLElement;
        const copy = field.querySelector(".mac-search-field-rest") as HTMLElement;
        const style = getComputedStyle(copy);
        const box = field.getBoundingClientRect();
        // overflow: hidden clips to the padding box, which here has no border around it: the
        // copy's own box. Padding inside it would be painted over, so it does not count.
        const clip = copy.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(copy.lastChild as Text);
        const text = range.getBoundingClientRect();
        const glass = field.querySelector(":scope > .mac-search-field-glyph") as SVGElement;
        return {
          shown: style.display !== "none" && style.overflowX === "hidden",
          clip: [clip.left - box.left, box.right - clip.right],
          text: [text.left - box.left, text.right - box.left],
          width: box.width,
          height: text.height,
          copy: copy.textContent ?? "",
          glass: getComputedStyle(glass).visibility === "visible",
          glassLeft: glass.getBoundingClientRect().left - box.left,
        };
      }, id);
    } finally {
      await context.close();
    }
  }

  it.skipIf(!available)(
    "clips a placeholder that is too long inside the field's padding, not at its edge",
    async () => {
      const long = await read("long");
      expect(long.shown).toBe(true);
      // The text is wider than the 80 pt field: it runs past the field's far edge.
      expect(long.text[1]).toBeGreaterThan(long.width);
      // What is drawn of it ends 9.5 pt before that edge, where the field's text does, and
      // nothing is drawn in the 7 pt before the glass.
      expect(long.clip[0]).toBeCloseTo(7, 1);
      expect(long.clip[1]).toBeCloseTo(9.5, 1);
      expect(long.text[0]).toBeGreaterThan(7 + 14);
    },
    60_000,
  );

  it.skipIf(!available)(
    "keeps a short placeholder and its glass centred between the same edges",
    async () => {
      const plain = await read("plain");
      expect(plain.shown).toBe(true);
      expect(plain.clip[0]).toBeCloseTo(7, 1);
      expect(plain.clip[1]).toBeCloseTo(9.5, 1);
      // Glass (14 pt), gap (5.5 pt) and text together are centred in the clipped box: the
      // space before the glass equals the space after the text.
      const before = plain.text[0] - 14 - 5.5 - 7;
      const after = plain.width - 9.5 - plain.text[1];
      expect(before).toBeGreaterThan(20);
      expect(before).toBeCloseTo(after, 0);
    },
    60_000,
  );

  it.skipIf(!available)(
    "keeps the spaces of a placeholder, as the input's own placeholder does",
    async () => {
      const one = await read("one-space");
      const many = await read("spaces");
      const width = (reading: Reading) => reading.text[1] - reading.text[0];
      // Eleven more spaces, each at least 2 pt wide at 12 pt in any text font.
      expect(width(many) - width(one)).toBeGreaterThan((SPACES - 1) * 2);
    },
    60_000,
  );

  it.skipIf(!available)(
    "keeps a placeholder written on several lines on one line, as the input does",
    async () => {
      const plain = await read("plain");
      const broken = await read("broken");
      expect(broken.shown).toBe(true);
      // An input drops the line breaks of its placeholder and joins what is around them.
      expect(broken.copy).toBe("Searchthestore");
      expect(broken.height).toBeGreaterThan(0);
      expect(broken.height).toBeCloseTo(plain.height, 1);
    },
    60_000,
  );

  it.skipIf(!available)(
    "lays a forced focus preview out as real focus is: no centred copy, the glass at the edge",
    async () => {
      const plain = await read("plain");
      const forced = await read("forced");
      // At rest the copy is shown and the field's own glass is hidden.
      expect(plain.shown).toBe(true);
      expect(plain.glass).toBe(false);
      // With the preview the copy is gone and the glass is drawn 7 pt from the edge.
      expect(forced.shown).toBe(false);
      expect(forced.glass).toBe(true);
      expect(forced.glassLeft).toBeCloseTo(7, 1);
    },
    60_000,
  );
});
