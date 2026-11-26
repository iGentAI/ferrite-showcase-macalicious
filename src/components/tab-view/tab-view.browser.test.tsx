// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "./index";

/*
 * What only a browser can show: which rules of the stylesheet reach a tab view that sits in a
 * pane of another, and what a real press of the mouse on a tab selects, and when. For the
 * rules the component is rendered by React to static markup and styled by the stylesheets it
 * ships with; for the presses the fixture of the states is served by the visual harness's page
 * (visual/harness) and driven with real input. Each engine Playwright has installed is used
 * (`npm run visual:install` installs Chromium), and an engine that is not installed is
 * skipped. Set REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails and
 * names each one that is missing (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the component's own two. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(path.join(here, "tab-view.tokens.css"), path.join(here, "tab-view.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

type Options = Pick<ComponentProps<typeof TabView>, "border" | "tabPosition" | "size">;

/** A tab view with two tabs; `.inner` marks the one whose styles are read. */
function view(options: Options, className: string, pane: ReactNode = "Pane") {
  return (
    <TabView defaultValue="one" className={className} style={{ width: 300 }} {...options}>
      <TabViewList aria-label={className}>
        <TabViewTab value="one">One</TabViewTab>
        <TabViewTab value="two">Two</TabViewTab>
      </TabViewList>
      <TabViewPanel value="one">{pane}</TabViewPanel>
    </TabView>
  );
}

/** Each case: an inner tab view alone, and the same one in a pane of an outer tab view. */
const CASES: Record<string, { outer: Options; inner: Options }> = {
  "outer-none": { outer: { border: "none" }, inner: { border: "bezel" } },
  "outer-line": { outer: { border: "line" }, inner: { border: "bezel" } },
  "outer-no-tabs": { outer: { tabPosition: "none" }, inner: { border: "bezel" } },
  "outer-left": { outer: { tabPosition: "left" }, inner: { tabPosition: "top" } },
  "outer-right": { outer: { tabPosition: "right" }, inner: { tabPosition: "bottom" } },
  "outer-small": { outer: { size: "small" }, inner: { size: "regular" } },
  "inner-none": { outer: { border: "bezel" }, inner: { border: "none" } },
  "inner-line": { outer: { border: "bezel" }, inner: { border: "line" } },
  "inner-left": { outer: { tabPosition: "top" }, inner: { tabPosition: "left" } },
  "inner-right": { outer: { tabPosition: "top" }, inner: { tabPosition: "right" } },
};

/** Side tabs, directly in their list or together in a wrapper that has no box of its own. */
function strip(tabPosition: "left" | "right", wrapped: boolean) {
  const tabs = (
    <>
      <TabViewTab value="one">One</TabViewTab>
      <TabViewTab value="two">Two</TabViewTab>
    </>
  );
  return (
    <TabView defaultValue="one" tabPosition={tabPosition} style={{ width: 300 }}>
      <TabViewList aria-label="Side">
        {wrapped ? <span style={{ display: "contents" }}>{tabs}</span> : tabs}
      </TabViewList>
      <TabViewPanel value="one">Pane</TabViewPanel>
    </TabView>
  );
}

const STRIPS = ["left-plain", "left-wrapped", "right-plain", "right-wrapped"];

function page() {
  const body = renderToStaticMarkup(
    <div style={{ width: 400 }}>
      {Object.entries(CASES).map(([name, { outer, inner }]) => (
        <div key={name}>
          <div id={`${name}-alone`}>{view(inner, "inner")}</div>
          <div id={`${name}-nested`}>{view(outer, "outer", view(inner, "inner"))}</div>
        </div>
      ))}
      {STRIPS.map((name) => (
        <div key={name} id={name}>
          {strip(name.startsWith("left") ? "left" : "right", name.endsWith("wrapped"))}
        </div>
      ))}
    </div>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

/** What the stylesheet decides from `data-border`, `data-tab-position` and `data-size`. */
interface Reading {
  body: string;
  wing: string;
  boxRadius: string;
  boxBorder: string;
  boxShadow: string;
  boxBackground: string;
  writingMode: string;
  rotate: string;
  tabEdges: string;
  tabHeight: number;
}

requireEveryEngine("the TabView tests");

describe.each(Object.keys(ENGINES))("TabView in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let readings: Record<string, Reading>;
  /** Per strip: the left and the right edge colour of its second tab, which is not selected. */
  let edges: Record<string, [left: string, right: string]>;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext();
    const tab = await context.newPage();
    await tab.setContent(page());
    const ids = Object.keys(CASES).flatMap((name) => [`${name}-alone`, `${name}-nested`]);
    readings = await tab.evaluate((ids) => {
      const read = (id: string): Reading => {
        const root = document.querySelector(`#${id} .inner`) as HTMLElement;
        const part = (selector: string) =>
          root.querySelector(`:scope > ${selector}`) as HTMLElement;
        const body = part('.mac-tab-view-box[data-part="body"]');
        const box = getComputedStyle(body, "::before");
        const first = part(".mac-tab-view-list > .mac-tab-view-tab");
        const label = first.querySelector(".mac-tab-view-tab-label") as HTMLElement;
        const edge = getComputedStyle(first, "::before");
        return {
          body: getComputedStyle(body).display,
          wing: getComputedStyle(part('.mac-tab-view-box[data-part="a"]')).display,
          boxRadius: box.borderTopLeftRadius,
          boxBorder: `${box.borderTopWidth} ${box.borderTopStyle} ${box.borderLeftColor}`,
          boxShadow: box.boxShadow,
          boxBackground: `${box.backgroundColor} ${box.backgroundImage}`,
          writingMode: getComputedStyle(part(".mac-tab-view-list")).writingMode,
          rotate: getComputedStyle(label).rotate,
          tabEdges: [
            edge.borderTopColor,
            edge.borderRightColor,
            edge.borderBottomColor,
            edge.borderLeftColor,
          ].join(" "),
          tabHeight: Math.min(first.offsetWidth, first.offsetHeight),
        };
      };
      return Object.fromEntries(ids.map((id) => [id, read(id)]));
    }, ids);
    edges = await tab.evaluate((names) => {
      const read = (name: string): [string, string] => {
        const second = document.querySelectorAll(`#${name} .mac-tab-view-tab`)[1] as HTMLElement;
        const edge = getComputedStyle(second, "::before");
        return [edge.borderLeftColor, edge.borderRightColor];
      };
      return Object.fromEntries(names.map((name) => [name, read(name)]));
    }, STRIPS);
    await context.close();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)("draws a tab view in a pane of another as it draws it alone", () => {
    for (const name of Object.keys(CASES)) {
      expect(readings[`${name}-nested`], name).toEqual(readings[`${name}-alone`]);
    }
  });

  it.skipIf(!available)("keeps an inner bezel when the outer tab view has no border", () => {
    const inner = readings["outer-none-nested"] as Reading;
    expect(inner.body).not.toBe("none");
    expect(inner.wing).not.toBe("none");
    // A bezel has the rounded corners of a box and its inner hairline; a line has neither.
    expect(inner.boxRadius).not.toBe("0px");
    expect(inner.boxShadow).not.toBe("none");
  });

  it.skipIf(!available)("keeps an inner bezel when the outer tab view has a line border", () => {
    const inner = readings["outer-line-nested"] as Reading;
    const line = readings["inner-line-alone"] as Reading;
    expect(line.boxRadius).toBe("0px");
    expect(line.boxShadow).toBe("none");
    expect(inner.boxRadius).not.toBe("0px");
    expect(inner.boxShadow).not.toBe("none");
  });

  it.skipIf(!available)("keeps the parts beside an inner strip when the outer has no tabs", () => {
    expect((readings["outer-no-tabs-nested"] as Reading).wing).not.toBe("none");
  });

  it.skipIf(!available)("keeps a top strip upright in a pane of a tab view with side tabs", () => {
    // The outer strip is on its side; the reading is of the inner one.
    for (const name of ["outer-left-nested", "outer-right-nested"]) {
      const inner = readings[name] as Reading;
      expect(inner.writingMode, name).toBe("horizontal-tb");
      expect(inner.rotate, name).toBe("none");
    }
    // And the other way round: a strip on its side in a pane of a tab view with top tabs. A
    // left strip is vertical-lr with its titles turned to read upwards, a right one vertical-rl.
    const left = readings["inner-left-nested"] as Reading;
    expect(left.writingMode).toBe("vertical-lr");
    expect(left.rotate).toBe("180deg");
    const right = readings["inner-right-nested"] as Reading;
    expect(right.writingMode).toBe("vertical-rl");
    expect(right.rotate).toBe("none");
  });

  it.skipIf(!available)("hides only its own box when the inner tab view has no border", () => {
    const inner = readings["inner-none-nested"] as Reading;
    expect(inner.body).toBe("none");
    expect(inner.wing).toBe("none");
  });

  it.skipIf(!available)("turns the edges of side tabs with the strip, in a wrapper too", () => {
    const [leftOuter, leftInner] = edges["left-plain"] as [string, string];
    const [rightInner, rightOuter] = edges["right-plain"] as [string, string];
    // The bezel's top edge is the strip's outer edge and its bottom edge the one that faces
    // the content, on either side; the two colours differ.
    expect(leftOuter).not.toBe(leftInner);
    expect(leftOuter).toBe(rightOuter);
    expect(leftInner).toBe(rightInner);
    // Tabs that share a wrapper inside the list are drawn as tabs directly in it.
    expect(edges["left-wrapped"]).toEqual(edges["left-plain"]);
    expect(edges["right-wrapped"]).toEqual(edges["right-plain"]);
  });
});

/*
 * A press selects nothing until the button is released: a release over the tab selects it,
 * and a release anywhere else, off the strip or over another tab, cancels. The press gives the
 * tab the focus in most engines, which is what Base UI selects on; the component leaves that
 * out while the tab is being pressed. The fixture has three tabs, the first selected.
 */
const AVAILABLE = Object.keys(ENGINES).filter((name) => installed(ENGINES[name] as BrowserType));
const root = path.join(here, "../../..");
const EXAMPLE = "src/components/tab-view/examples/visual-states.tsx";
const WAIT = { timeout: 10_000 };
/** Room for a slow machine: a test's own waits come to less than this. */
const TIMEOUT = 60_000;

describe("TabView presses", () => {
  /** One server for the engines: each loads the same page from it. */
  let server: ViteDevServer | undefined;
  let url: string;

  beforeAll(async () => {
    if (AVAILABLE.length === 0) return;
    server = await createServer({
      configFile: path.join(root, "visual/vite.config.ts"),
      // Its own cache: several servers that prepare dependencies in one folder disturb each other.
      cacheDir: path.join(root, "node_modules/.vite-browser-tab-view"),
      server: { port: 0, host: "127.0.0.1", strictPort: false },
      logLevel: "silent",
    });
    await server.listen();
    const address = server.httpServer?.address();
    const port = typeof address === "object" && address ? address.port : 5173;
    url = `http://127.0.0.1:${port}/?example=${EXAMPLE}&appearance=light`;
  }, 180_000);

  afterAll(async () => {
    await server?.close();
  });

  describe.each(Object.keys(ENGINES))("in %s", (name) => {
    const engine = ENGINES[name] as BrowserType;
    const available = installed(engine);
    let browser: Browser | undefined;
    let tab: Page;

    /** The ids of the selected tabs: there is always exactly one. */
    const selected = () =>
      tab.evaluate(() =>
        [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((item) => item.id),
      );
    /** The middle of the tab with this id, in page coordinates. */
    const middle = async (id: string) => {
      const box = await tab.locator(`#${id}`).boundingBox();
      if (!box) throw new Error(`no tab #${id}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    /** Press the mouse button on the middle of a tab, hold it, and let the page act on it. */
    const press = async (id: string) => {
      const { x, y } = await middle(id);
      await tab.mouse.move(x, y);
      await tab.mouse.down();
      await tab.waitForFunction((id) => document.getElementById(id)?.matches(":active"), id, WAIT);
      await settle();
    };
    /** Two frames: what an event started has been rendered. */
    const settle = () =>
      tab.evaluate(
        () =>
          new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          ),
      );

    beforeAll(async () => {
      if (!available) return;
      browser = await engine.launch();
      tab = await browser.newPage({ viewport: { width: 900, height: 700 } });
    }, 180_000);

    // Every test starts from a page that has just loaded, with the first tab selected.
    beforeEach(async () => {
      if (!available) return;
      await tab.goto(url);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      await expect.poll(selected, WAIT).toEqual(["one"]);
    }, 180_000);

    afterAll(async () => {
      await browser?.close();
    });

    it.skipIf(!available)(
      "selects a pressed tab when the button is released over it, and not before",
      async () => {
        await press("three");
        expect(await selected()).toEqual(["one"]);
        await tab.mouse.up();
        await expect.poll(selected, WAIT).toEqual(["three"]);
      },
      TIMEOUT,
    );

    it.skipIf(!available)(
      "cancels when the button is released off the strip",
      async () => {
        await press("three");
        const { x, y } = await middle("three");
        // Well below the 21 pt strip, in several steps as a hand moves.
        await tab.mouse.move(x, y + 200, { steps: 4 });
        await tab.mouse.up();
        await settle();
        expect(await selected()).toEqual(["one"]);
        // The strip still works: a whole click selects.
        await tab.click("#two");
        await expect.poll(selected, WAIT).toEqual(["two"]);
      },
      TIMEOUT,
    );

    it.skipIf(!available)(
      "cancels when the button is released over another tab",
      async () => {
        await press("three");
        const { x, y } = await middle("two");
        await tab.mouse.move(x, y, { steps: 4 });
        await tab.mouse.up();
        await settle();
        expect(await selected()).toEqual(["one"]);
      },
      TIMEOUT,
    );
  });
});
