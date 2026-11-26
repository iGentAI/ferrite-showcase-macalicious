#!/usr/bin/env node

// One developer's own copy of the desktop's front end, for a change to demos/ or docs/desktop/ that
// needs no new server: vite serves the source and forwards everything else to the shared desktop, so
// sessions, the drive and every API are the real ones and no restart is needed.
//
//   node scripts/dev-front-end.mjs [--port 3020] [--server http://127.0.0.1:8787]
//   node e2e/some-journey.mjs --url http://127.0.0.1:3020

import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createServer } from "vite";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "3020" },
    server: { type: "string", default: "http://127.0.0.1:8787" },
  },
});
process.env.VITE_MACALICIOUS_API = "1";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const server = await createServer({
  configFile: path.join(repo, "docs/desktop/vite.config.ts"),
  server: {
    host: "127.0.0.1",
    port: Number(values.port),
    strictPort: true,
    // Other workers edit the same tree: a pushed reload would restart a running journey. Each page
    // load reads the files as they are.
    hmr: false,
    // The project tree is a network mount here: its changes reach no file watcher.
    watch: {
      usePolling: true,
      interval: 500,
      ignored: [
        "**/node_modules/**",
        "**/target/**",
        "**/src/site_assets.rs",
        "**/src/site_assets/**",
      ],
    },
    proxy: {
      "^/(api|live|ferrite-site\\.json|__forge)": {
        target: values.server,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
await server.listen();
server.printUrls();
