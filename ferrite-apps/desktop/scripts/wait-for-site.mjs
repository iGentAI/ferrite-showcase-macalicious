import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const source = readFileSync(new URL("../src/site_assets.rs", import.meta.url), "utf8");
const expected = source.match(/build_id: "(sha256:[a-f0-9]{64})"/)?.[1];
if (!expected) throw new Error("Pack the desktop site before checking publication.");
const url = new URL("/ferrite-site.json", process.argv[2] ?? "https://macalicious.ferrite.run");
const deadline = Date.now() + 120_000;
let last = "no response";
while (Date.now() < deadline) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(10_000, deadline - Date.now())),
    });
    const marker = response.ok ? await response.json() : null;
    last = `HTTP ${response.status}, build ${marker?.build_id ?? "unpublished"}`;
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        status: response.status,
        build: marker?.build_id,
      }),
    );
    if (response.ok && marker?.build_id === expected) {
      console.log(`Public site is ready: ${expected}`);
      process.exit(0);
    }
  } catch (error) {
    last = error instanceof Error ? error.message : String(error);
  }
  await delay(Math.max(0, Math.min(5_000, deadline - Date.now())));
}
throw new Error(`Site did not publish ${expected} within 120 seconds: ${last}`);
