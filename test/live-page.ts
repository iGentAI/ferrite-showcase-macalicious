import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { alias, fsAllow, repoRoot } from "../vite.shared.ts";

/*
 * A page that renders the desktop's live Messages, Chess or FaceTime window (`MessagesLive`,
 * `ChessLive`, `FaceTimeLive`) as the desktop's Ferrite application serves it, with `VITE_MACALICIOUS_API=1`,
 * for the browser tests of their server paths. The real component runs in a real browser; what
 * answers it is a stand-in for the application (`ferrite-apps/desktop`), in this process, that
 * each test drives: it sees every `/api/` request the page makes and answers it when and how the
 * test says, and it streams `/live/<app>/<id>` as server-sent events, with the frames the test
 * publishes. The application itself is exercised by `ferrite-apps/desktop/e2e/live-journey.mjs`
 * and its own Rust tests; this page proves what the window does with each kind of answer.
 *
 *   /live.html?app=messages&room=<id>   the Messages window, talking in room <id>
 *   /live.html?app=chess&game=<id>      the Chess window, playing game <id>
 *   /live.html?app=chess                the Chess window, playing the person's own games
 *   /live.html?app=facetime             the FaceTime window
 *
 * The page sets `<html data-ready>` once the window has rendered, and `window.__unmount()`
 * removes it, as closing it on the desktop does.
 */

/** One `/api/` request of the page, held until the test answers it. */
export interface ApiCall {
  method: string;
  /** The path without the query, such as `/api/messages/rooms/r1`. */
  path: string;
  /** The `idempotency-key` header, or null. */
  key: string | null;
  /** The JSON body, or null. */
  body: unknown;
  /** Answer with `status` and `body` as JSON. A second answer is ignored. */
  reply(status: number, body?: unknown): void;
  /** Whether the page gave up on the request (aborted it) before it was answered. */
  readonly abandoned: boolean;
}

export interface LivePage {
  origin: string;
  /** Every `/api/` request since the last `reset`, in the order they arrived. */
  calls: ApiCall[];
  /** Decides what each `/api/` request gets; a call it does not answer is held open. */
  handle: (call: ApiCall) => void;
  /**
   * Sends a `state` event, `{"version": …, "state": …}`, to every page listening to `feed`
   * (`/live/messages/<room>`), and to every page that opens it later.
   */
  publish(feed: string, version: number, state: unknown): void;
  /** Forgets the calls, ends the feeds and goes back to answering 404. */
  reset(): void;
  close(): Promise<void>;
}

const ENTRY = "/@live-entry.js";
const RESOLVED = "\0live-entry.js";

const entryCode = `
import "macalicious/tokens.css";
import "macalicious/fallback-font.css";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ChessLive } from "/demos/chess/chess-live.tsx";
import { FaceTimeLive } from "/demos/facetime/facetime-live.tsx";
import { MessagesLive } from "/demos/messages/messages-live.tsx";
const app = new URLSearchParams(location.search).get("app");
const windows = { chess: ChessLive, facetime: FaceTimeLive };
const root = createRoot(document.getElementById("root"));
root.render(createElement(windows[app] ?? MessagesLive));
window.__unmount = () => root.unmount();
requestAnimationFrame(() => document.documentElement.setAttribute("data-ready", ""));
`;

const HTML = `<!doctype html>
<html lang="en" data-appearance="light">
  <head><meta charset="utf-8" /><title>Live window</title></head>
  <body style="margin: 0; padding: 20px"><div id="root"></div><script type="module" src="${ENTRY}"></script></body>
</html>
`;

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      text += chunk;
    });
    request.on("end", () => resolve(text));
    request.on("error", reject);
  });
}

/** Starts the page's server on a free port of 127.0.0.1. */
export async function startLivePage(): Promise<LivePage> {
  const feeds = new Map<string, { last?: string; clients: Set<ServerResponse> }>();
  const feedOf = (name: string) => {
    let feed = feeds.get(name);
    if (!feed) {
      feed = { clients: new Set() };
      feeds.set(name, feed);
    }
    return feed;
  };
  const notFound = (call: ApiCall) => call.reply(404, { error: "not found" });

  const page: LivePage = {
    origin: "",
    calls: [],
    handle: notFound,
    publish(name, version, state) {
      const feed = feedOf(name);
      feed.last = `event: state\ndata: ${JSON.stringify({ version, state })}\n\n`;
      for (const client of feed.clients) client.write(feed.last);
    },
    reset() {
      page.calls = [];
      page.handle = notFound;
      for (const feed of feeds.values()) for (const client of feed.clients) client.end();
      feeds.clear();
    },
    close: async () => {
      page.reset();
      await server.close();
    },
  };

  const api = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const text = request.method === "POST" ? await readBody(request) : "";
    let answered = false;
    let abandoned = false;
    response.on("close", () => {
      if (!answered) abandoned = true;
    });
    const key = request.headers["idempotency-key"];
    const call: ApiCall = {
      method: request.method ?? "GET",
      path: url.pathname,
      key: typeof key === "string" ? key : null,
      body: text ? JSON.parse(text) : null,
      reply(status, body) {
        if (answered || abandoned) return;
        answered = true;
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(body ?? {}));
      },
      get abandoned() {
        return abandoned;
      },
    };
    page.calls.push(call);
    page.handle(call);
  };

  const live = (request: IncomingMessage, response: ServerResponse) => {
    const name = new URL(request.url ?? "/", "http://localhost").pathname;
    const feed = feedOf(name);
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.write("retry: 500\n\n");
    if (feed.last) response.write(feed.last);
    feed.clients.add(response);
    response.on("close", () => feed.clients.delete(response));
  };

  const plugin: Plugin = {
    name: "live-page",
    resolveId: (id) => (id === ENTRY ? RESOLVED : undefined),
    load: (id) => (id === RESOLVED ? entryCode : undefined),
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (url.pathname.startsWith("/api/")) {
          void api(request, response);
        } else if (url.pathname.startsWith("/live/")) {
          live(request, response);
        } else if (url.pathname === "/live.html") {
          vite
            .transformIndexHtml(request.url ?? "/live.html", HTML)
            .then((html) => {
              response.writeHead(200, { "content-type": "text/html" });
              response.end(html);
            })
            .catch(next);
        } else {
          next();
        }
      });
    },
  };

  // The demos read the flag from the environment Vite loads, as `pack-site.mjs` sets it.
  const before = process.env.VITE_MACALICIOUS_API;
  process.env.VITE_MACALICIOUS_API = "1";
  let server: ViteDevServer;
  try {
    server = await createServer({
      configFile: false,
      root: repoRoot,
      resolve: { alias },
      publicDir: false,
      clearScreen: false,
      logLevel: "silent",
      plugins: [plugin],
      server: { port: 0, host: "127.0.0.1", strictPort: false, fs: { allow: fsAllow } },
      optimizeDeps: {
        entries: [
          "demos/messages/messages-live.tsx",
          "demos/chess/chess-live.tsx",
          "demos/facetime/facetime-live.tsx",
        ],
        include: ["react", "react-dom/client", "react/jsx-dev-runtime"],
      },
      cacheDir: path.join(repoRoot, "node_modules/.vite-live-page"),
    });
    await server.listen();
  } finally {
    if (before === undefined) delete process.env.VITE_MACALICIOUS_API;
    else process.env.VITE_MACALICIOUS_API = before;
  }
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 0;
  page.origin = `http://127.0.0.1:${port}`;
  return page;
}
