// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * The keys in real IndexedDB, and two real tabs of one browser asking for one message's key in the
 * same moment: the one read-write transaction is what stops each from making a key of its own.
 */
const MESSAGE = { to: ["martin"], cc: [], subject: "Once", text: "only once", attachments: [] };
const root = path.join(import.meta.dirname, "../..");
const MODULE = `/@fs${path.join(root, "demos/mail/mail-send-keys.ts")}`;

requireEveryEngine("the Mail send key tests");

let server: ViteDevServer | undefined;
let origin = "";

const call = (page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(
    // A string, so that the test runner leaves this import to the browser.
    `import(${JSON.stringify(MODULE)}).then((keys) => keys.${name}(...${JSON.stringify(args)}))`,
  ) as Promise<string>;
const keyFor = (page: Page, me: string, content: object, fresh: string, now?: number) =>
  call(page, "sendKeyFor", me, content, fresh, ...(now === undefined ? [] : [now]));
const forget = (page: Page, me: string, content: object) =>
  call(page, "forgetSendKey", me, content);

beforeAll(async () => {
  server = await createServer({
    configFile: path.join(root, "visual/vite.config.ts"),
    server: { port: 0, host: "127.0.0.1", strictPort: false },
    logLevel: "silent",
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  origin = `http://127.0.0.1:${port}/`;
}, 60_000);

afterAll(async () => {
  await server?.close();
});

describe.each(Object.keys(ENGINES))("a message's send key in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  let browser: Browser | undefined;
  let first: Page;
  let second: Page;

  beforeAll(async () => {
    if (!installed(engine)) return;
    browser = await engine.launch();
    const context = await browser.newContext();
    first = await context.newPage();
    second = await context.newPage();
    await first.goto(origin);
    await second.goto(origin);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.runIf(installed(engine))("stays the same until the server has answered", async () => {
    expect(await keyFor(first, "chris", MESSAGE, "one")).toBe("one");
    expect(await keyFor(first, "chris", MESSAGE, "two")).toBe("one");
    await forget(first, "chris", MESSAGE);
    expect(await keyFor(first, "chris", MESSAGE, "three")).toBe("three");
    await forget(first, "chris", MESSAGE);
  });

  it.runIf(installed(engine))("is another for a changed message or another account", async () => {
    expect(await keyFor(first, "ana", MESSAGE, "one")).toBe("one");
    expect(await keyFor(first, "ana", { ...MESSAGE, text: "changed" }, "two")).toBe("two");
    expect(await keyFor(first, "bo", MESSAGE, "three")).toBe("three");
  });

  it.runIf(installed(engine))("lasts a day, as the server's record of it does", async () => {
    expect(await keyFor(first, "cy", MESSAGE, "one", 1_000)).toBe("one");
    expect(await keyFor(first, "cy", MESSAGE, "two", 1_000 + 86_399_000)).toBe("one");
    expect(await keyFor(first, "cy", MESSAGE, "three", 1_000 + 86_400_000)).toBe("three");
  });

  it.runIf(installed(engine))("is one key for two tabs asking in the same moment", async () => {
    for (let round = 0; round < 25; round += 1) {
      const content = { ...MESSAGE, text: `round ${round}` };
      const [a, b] = await Promise.all([
        keyFor(first, "dee", content, `first-${round}`),
        keyFor(second, "dee", content, `second-${round}`),
      ]);
      expect(a).toBe(b);
    }
  });
});
