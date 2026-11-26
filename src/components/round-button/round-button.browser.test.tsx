// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { RoundButton } from "./index";

/*
 * What only a browser can show: the edge forced-colours mode gives each kind of round button.
 * The destructive disc has no edge of its own, so the forced-colours rules give it one, and a
 * disabled destructive button must take the grey edge every disabled button takes. Each engine
 * Playwright has installed is used (test/browser-engines.ts); Playwright cannot emulate forced
 * colours in WebKit, so that engine is skipped.
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the component's own two. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(path.join(here, "round-button.tokens.css"), path.join(here, "round-button.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

function page() {
  const body = renderToStaticMarkup(
    <div>
      <RoundButton id="bezel" aria-label="Add" />
      <RoundButton id="bezel-disabled" aria-label="Add" disabled />
      <RoundButton id="destructive" variant="destructive" size="mini" aria-label="Remove" />
      <RoundButton
        id="destructive-disabled"
        variant="destructive"
        size="mini"
        aria-label="Remove"
        disabled
      />
      <div id="button-text" style={{ color: "ButtonText", forcedColorAdjust: "none" }} />
      <div id="gray-text" style={{ color: "GrayText", forcedColorAdjust: "none" }} />
    </div>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

interface Edge {
  width: string;
  style: string;
  color: string;
  opacity: string;
}

requireEveryEngine("the RoundButton tests");

describe.each(Object.keys(ENGINES))("RoundButton in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  async function read(forcedColors: "active" | "none") {
    const context = await browser.newContext({ forcedColors });
    try {
      const tab = await context.newPage();
      await tab.setContent(page());
      return await tab.evaluate(() => {
        const edge = (id: string): Edge => {
          const style = getComputedStyle(document.getElementById(id) as HTMLElement, "::before");
          return {
            width: style.borderTopWidth,
            style: style.borderTopStyle,
            color: style.borderTopColor,
            opacity: style.opacity,
          };
        };
        const color = (id: string) =>
          getComputedStyle(document.getElementById(id) as HTMLElement).color;
        return {
          bezel: edge("bezel"),
          bezelDisabled: edge("bezel-disabled"),
          destructive: edge("destructive"),
          destructiveDisabled: edge("destructive-disabled"),
          buttonText: color("button-text"),
          grayText: color("gray-text"),
        };
      });
    } finally {
      await context.close();
    }
  }

  it.skipIf(!available)(
    "draws the destructive disc without an edge outside forced colours",
    async () => {
      const edges = await read("none");
      expect(edges.destructive.style).toBe("none");
      expect(edges.destructiveDisabled.style).toBe("none");
      expect(edges.bezel.style).toBe("solid");
    },
    60_000,
  );

  it.skipIf(!available || name === "webkit")(
    "gives a disabled destructive button the grey edge of any disabled button in forced colours",
    async () => {
      const edges = await read("active");
      expect(edges.buttonText).not.toBe(edges.grayText);

      // Enabled: an edge in the button text colour, the destructive disc included.
      expect(edges.bezel.color).toBe(edges.buttonText);
      expect(edges.destructive.style).toBe("solid");
      expect(edges.destructive.width).toBe("1px");
      expect(edges.destructive.color).toBe(edges.buttonText);

      // Disabled: the grey edge at full opacity, the destructive disc included.
      for (const disabled of [edges.bezelDisabled, edges.destructiveDisabled]) {
        expect(disabled.color).toBe(edges.grayText);
        expect(disabled.opacity).toBe("1");
      }
      expect(edges.destructiveDisabled.style).toBe("solid");
      expect(edges.destructiveDisabled.width).toBe("1px");
    },
    60_000,
  );
});
