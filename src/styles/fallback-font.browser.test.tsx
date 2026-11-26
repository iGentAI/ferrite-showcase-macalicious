// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: that a page using the fallback font finishes loading its fonts.
 * document.fonts.ready is what every Playwright screenshot waits for, so a face that never
 * settles makes every capture in that engine time out (WebKit did, with local() sources on a
 * face that no text on the page needs). The stylesheet is the one the package ships, with its
 * package paths replaced by the font files themselves.
 */

const here = import.meta.dirname;
const modules = path.resolve(here, "../../node_modules");

function stylesheet() {
  return readFileSync(path.join(here, "fallback-font.css"), "utf8").replace(
    /url\("(@fontsource-variable\/inter\/files\/[^"]+)"\)/g,
    (_, file: string) => {
      const font = path.join(modules, file);
      if (!existsSync(font))
        throw new Error(`the stylesheet names ${file}, which is not installed`);
      return `url("data:font/woff2;base64,${readFileSync(font).toString("base64")}")`;
    },
  );
}

const page = (text: string) =>
  `<!doctype html><html><head><style>${stylesheet()}
body { font: 13px "Mac System Fallback", sans-serif; }</style></head><body><p>${text}</p></body></html>`;

interface Reading {
  /** Whether document.fonts.ready resolved within five seconds. */
  ready: boolean;
  /** document.fonts.status after the wait. */
  status: string;
  /** Each face's status, in the stylesheet's order: Latin, then Latin Extended. */
  faces: string[];
}

requireEveryEngine("the fallback font tests");

describe.each(Object.keys(ENGINES))("the fallback font in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  const readings: Record<string, Reading> = {};

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const tab = await browser.newPage();
    for (const [label, text] of [
      ["latin", "Cancel"],
      ["latin-ext", "Łódź"],
    ] as const) {
      await tab.setContent(page(text));
      readings[label] = await tab.evaluate(async () => {
        const ready = await Promise.race([
          document.fonts.ready.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
        ]);
        return {
          ready,
          status: document.fonts.status,
          faces: [...document.fonts].map((face) => face.status),
        };
      });
    }
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)("finishes loading for text that needs only the Latin face", () => {
    // The Latin face is loaded; the Latin Extended one may be fetched or left unloaded (WebKit
    // fetches it here, the others do not), but no face may be stuck loading or in error.
    const { ready, status, faces } = readings.latin as Reading;
    expect({ ready, status, latin: faces[0] }).toEqual({
      ready: true,
      status: "loaded",
      latin: "loaded",
    });
    expect(faces.filter((face) => face === "loading" || face === "error")).toEqual([]);
  });

  it.skipIf(!available)("finishes loading for text that needs both faces", () => {
    expect(readings["latin-ext"]).toEqual({
      ready: true,
      status: "loaded",
      faces: ["loaded", "loaded"],
    });
  });
});
