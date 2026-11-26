// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import type { CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { Sidebar, SidebarItem, SidebarSection } from "./index";

/*
 * What only a browser can show: the distances the stylesheet lays a sidebar out with, by
 * default and with the spacing custom properties set. The component is rendered by React and
 * styled by the stylesheets it ships with; each engine Playwright has installed is used
 * (`npm run visual:install` installs Chromium), and an engine that is not installed is
 * skipped. Set REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails and
 * names each one that is missing (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the sidebar's and its parts'. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(
    path.join(here, "../scroll-view/scroll-view.tokens.css"),
    path.join(here, "../scroll-view/scroll-view.css"),
    path.join(here, "../disclosure-triangle/disclosure-triangle.css"),
    path.join(here, "sidebar.tokens.css"),
    path.join(here, "sidebar.css"),
  );
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const block = <span style={{ width: "100%", height: "100%" }} />;

/** Two sections; the second holds an outline row and a row with an accessory. */
function list(style?: CSSProperties) {
  return (
    <Sidebar aria-label="Library" material="opaque" style={{ width: 220, ...style }}>
      <SidebarSection title="Apple Music">
        <SidebarItem value="for-you" label="For You" icon={block} />
        <SidebarItem value="browse" label="Browse" icon={block} />
      </SidebarSection>
      <SidebarSection title="Library">
        <SidebarItem value="albums" label="Albums" icon={block} accessory={<span>12</span>} />
        <SidebarItem value="playlists" label="Playlists" icon={block} defaultExpanded>
          <SidebarItem value="recent" label="Recent" icon={block} />
        </SidebarItem>
      </SidebarSection>
    </Sidebar>
  );
}

/** Music's source list, as the docs page gives it. */
const music = {
  "--mac-sidebar-row-spacing": "0px",
  "--mac-sidebar-section-gap": "10px",
  "--mac-sidebar-label-gap": "5px",
} as CSSProperties;

function page() {
  const body = renderToStaticMarkup(
    <>
      <div id="default">{list()}</div>
      <div id="root">{list(music)}</div>
      <div id="ancestor" style={music}>
        {list()}
      </div>
    </>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

/** Distances in points, read from the laid-out boxes. */
interface Reading {
  /** From one row's top to the next row's. */
  pitch: number;
  /** From the last row's box in a section to the next section's header: the row spacing
   *  under that row, then the section gap. */
  sectionGap: number;
  /** From a header's top to its first row. */
  header: number;
  /** From the icon to the label. */
  labelGap: number;
  /** From the label's box to the accessory. */
  accessoryGap: number;
  /** From the disclosure triangle to the icon. */
  triangleGap: number;
  /** A row's height. */
  row: number;
}

requireEveryEngine("the Sidebar tests");

describe.each(Object.keys(ENGINES))("Sidebar spacing in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let readings: Record<string, Reading>;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext();
    const tab = await context.newPage();
    await tab.setContent(page());
    readings = await tab.evaluate(
      (ids) => {
        const read = (id: string): Reading => {
          const all = (selector: string) =>
            [...document.querySelectorAll(`#${id} ${selector}`)].map((element) =>
              element.getBoundingClientRect(),
            ) as [DOMRect, DOMRect, DOMRect, DOMRect, DOMRect];
          const rows = all(".mac-sidebar-item");
          const headers = all(".mac-sidebar-header");
          const icons = all(".mac-sidebar-icon");
          const labels = all(".mac-sidebar-label");
          const [accessory] = all(".mac-sidebar-accessory");
          const [triangle] = all(".mac-sidebar-triangle");
          return {
            pitch: rows[1].top - rows[0].top,
            sectionGap: headers[1].top - rows[1].bottom,
            header: rows[0].top - headers[0].top,
            labelGap: labels[0].left - icons[0].right,
            // The third row has the accessory, the fourth the triangle.
            accessoryGap: accessory.left - labels[2].right,
            triangleGap: icons[3].left - triangle.right,
            row: rows[0].height,
          };
        };
        return Object.fromEntries(ids.map((id) => [id, read(id)]));
      },
      ["default", "root", "ancestor"],
    );
    await context.close();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)("keeps the measured defaults when no property is set", () => {
    expect(readings.default).toEqual({
      pitch: 26,
      // 2 pt of row spacing and the 9 pt section gap.
      sectionGap: 11,
      header: 20,
      labelGap: 4,
      accessoryGap: 4,
      triangleGap: 7.5,
      row: 24,
    });
  });

  it.skipIf(!available)(
    "takes Music's row pitch, section gap and label gap from the custom properties",
    () => {
      // The rows keep their height, and the triangle and the accessory their distances.
      const music = {
        pitch: 24,
        sectionGap: 10,
        header: 20,
        labelGap: 5,
        accessoryGap: 4,
        triangleGap: 7.5,
        row: 24,
      };
      expect(readings.root).toEqual(music);
      // The properties inherit: an ancestor of the sidebar can set them as well.
      expect(readings.ancestor).toEqual(music);
    },
  );
});
