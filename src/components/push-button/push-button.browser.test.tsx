// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { PushButton } from "./index";

/*
 * What only a browser can show: the colour the stylesheet gives an emphasised button's title in
 * the key window and in the two states of a window that is not key. Each engine Playwright has
 * installed is used, and one that is not installed is skipped unless REQUIRE_BROWSER_TESTS is
 * set (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the component's own two. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(path.join(here, "push-button.tokens.css"), path.join(here, "push-button.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const STATES = ["key", "main", "inactive"] as const;

function page(appearance: "light" | "dark") {
  const body = renderToStaticMarkup(
    <div>
      {STATES.map((state) => (
        <div key={state} id={state} data-window-state={state}>
          <PushButton className="emphasized" variant="emphasized">
            Done
          </PushButton>
          <PushButton className="disabled" variant="emphasized" disabled>
            Done
          </PushButton>
          <PushButton className="standard">Cancel</PushButton>
        </div>
      ))}
      <div id="blue" style={{ color: "var(--mac-push-button-emphasized-title)" }} />
    </div>,
  );
  return `<!doctype html><html data-appearance="${appearance}"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

interface Title {
  color: string;
  weight: string;
}

requireEveryEngine("the PushButton tests");

describe.each(Object.keys(ENGINES))("PushButton in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  async function read(appearance: "light" | "dark") {
    const context = await browser.newContext();
    try {
      const tab = await context.newPage();
      await tab.setContent(page(appearance));
      return await tab.evaluate((states) => {
        const title = (selector: string) => {
          const style = getComputedStyle(document.querySelector(selector) as HTMLElement);
          return { color: style.color, weight: style.fontWeight };
        };
        const result: Record<string, Title> = {
          blue: title("#blue"),
        };
        for (const state of states) {
          for (const kind of ["emphasized", "disabled", "standard"]) {
            result[`${state}-${kind}`] = title(`#${state} .${kind}`);
          }
        }
        return result;
      }, STATES);
    } finally {
      await context.close();
    }
  }

  for (const appearance of ["light", "dark"] as const) {
    it.skipIf(!available)(
      `keeps the emphasised title blue in key, main and inactive windows (${appearance})`,
      async () => {
        const titles = await read(appearance);
        const blue = titles.blue?.color;
        const standard = titles["key-standard"]?.color;
        expect(blue).not.toBe(standard);

        expect(titles["key-emphasized"]?.color).toBe(blue);
        for (const state of ["main", "inactive"]) {
          // The blue is the app's title colour, not the accent: it stays, and so does the weight.
          expect(titles[`${state}-emphasized`]?.color).toBe(blue);
          expect(titles[`${state}-emphasized`]?.weight).toBe(titles["key-emphasized"]?.weight);
          // Disabled still dims the title, whatever the window.
          expect(titles[`${state}-disabled`]?.color).toBe(titles["key-disabled"]?.color);
        }
        expect(Number(titles["key-emphasized"]?.weight)).toBeGreaterThan(
          Number(titles["key-standard"]?.weight),
        );
        expect(titles["key-disabled"]?.color).not.toBe(blue);
      },
      60_000,
    );
  }
});
