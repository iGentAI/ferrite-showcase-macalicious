// @vitest-environment node
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Browser, BrowserType } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sameDownloadName } from "../ferrite-apps/desktop/e2e/journey-kit.mjs";
import { ENGINES, installed, requireEveryEngine } from "./browser-engines";

/*
 * The name a download with spaces in its name reaches the computer under, in each engine. The
 * journeys check Finder's Download, Photo Booth's Export… and Preview's Download as PNG by it,
 * through `sameDownloadName` (ferrite-apps/desktop/e2e/journey-kit.mjs): Playwright 1.64.1's
 * WebKit 27.2 reports such a name with every space turned into an underscore, however the page
 * names the file, where WebKit 26.6, Chromium and Firefox keep the spaces. The page here names a
 * download the two ways the desktop does: the `download` attribute on a blob URL (Photo Booth,
 * Preview) and on a same-origin URL the server sends as an attachment (Finder). An engine that
 * changes a name in any other way fails here before it fails a journey.
 */

const NAME = "Field notes 1.txt";
const TEXT = "field notes";
const PAGE = `<!doctype html>
<a id="blob">from a blob</a> <a id="file" href="/file">from the server</a>
<script>
  const name = ${JSON.stringify(NAME)};
  const blob = document.getElementById("blob");
  blob.href = URL.createObjectURL(new Blob([${JSON.stringify(TEXT)}], { type: "text/plain" }));
  blob.download = name;
  document.getElementById("file").download = name;
</script>`;

let server: Server | undefined;
let base = "";

beforeAll(async () => {
  if (!Object.values(ENGINES).some(installed)) return;
  const listening = createServer((request, response) => {
    if (request.url === "/file") {
      response.writeHead(200, {
        "content-type": "text/plain",
        "content-disposition": "attachment",
      });
      response.end(TEXT);
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(PAGE);
  });
  await new Promise<void>((resolve) => listening.listen(0, "127.0.0.1", resolve));
  server = listening;
  base = `http://127.0.0.1:${(listening.address() as AddressInfo).port}`;
});

afterAll(async () => {
  const closing = server;
  if (closing) await new Promise<void>((resolve) => closing.close(() => resolve()));
});

requireEveryEngine("the download-name tests");

describe.each(Object.keys(ENGINES))("a download named with spaces, in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 120_000);

  // Closing a browser can take longer than the default 10 s on a loaded machine.
  afterAll(async () => {
    await browser?.close();
  }, 60_000);

  for (const link of ["blob", "file"]) {
    it.skipIf(!available)(
      `reaches the computer byte for byte, under its name as the engine reports it (${link} link)`,
      async () => {
        if (!browser) throw new Error("No browser.");
        const context = await browser.newContext({ acceptDownloads: true });
        try {
          const page = await context.newPage();
          await page.goto(`${base}/`);
          const [download] = await Promise.all([
            page.waitForEvent("download"),
            page.click(`#${link}`),
          ]);
          expect(await readFile(await download.path(), "utf8")).toBe(TEXT);
          const reported = download.suggestedFilename();
          expect(sameDownloadName(reported, NAME, name), reported).toBe(true);
        } finally {
          await context.close();
        }
      },
      60_000,
    );
  }
});
