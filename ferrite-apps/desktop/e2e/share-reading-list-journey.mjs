#!/usr/bin/env node
// Share > Add to Reading List from an application other than Safari: the link joins what Safari keeps, and stays after a
// reload.
//
//   node e2e/share-reading-list-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { randomBytes } from "node:crypto";
import path from "node:path";
import { api, journey, options, reloadDesktop, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("share-reading-list", { ignoreOtherOrigins: true });
const AAPL = "https://www.cnbc.com/quotes/AAPL";

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

await run(async (page) => {
  // A new account made at the login window, so the journey changes nobody's data.
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, {
    name: `rl${browserName.slice(0, 2)}${Date.now().toString(36)}`,
    fullName: "Reading List",
    password: randomBytes(12).toString("base64url"),
  });
  const library = await api(page, "GET", "/api/app-store/library");
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json?.installed ?? []), "stocks"])],
    rev: library.json?.rev ?? 0,
  });
  const current = await api(page, "GET", "/api/safari/reading-list");
  const seeded = await api(page, "PUT", "/api/safari/reading-list", {
    items: [{ title: "Earlier", url: "https://example.com/earlier", added: 1, read: false }],
    rev: current.json?.rev ?? 0,
  });
  step("An earlier page is on the Reading List", seeded.status === 200, String(seeded.status));
  await reloadDesktop(page);

  const kept = async () => (await api(page, "GET", "/api/safari/reading-list")).json?.items ?? [];
  const row = page.getByRole("menuitem", { name: "Add to Reading List", exact: true });

  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Stocks");
  await field.press("Enter");
  const stocks = page.getByRole("region", { name: "Stocks", exact: true }).first();
  await stocks.waitFor({ timeout: 15_000 });
  await stocks
    .getByRole("button", { name: /^AAPL\b/ })
    .first()
    .click();
  await stocks.getByText("P/E").first().waitFor({ timeout: 15_000 });
  await stocks.getByRole("button", { name: "Share" }).click();
  step("Stocks' Share menu has the row", await until(async () => (await row.count()) === 1));
  await row.click();

  const safari = page.getByRole("region", { name: "Safari", exact: true }).first();
  await safari.waitFor({ timeout: 15_000 });
  step("Safari opens", await safari.isVisible());
  const items = await until(async () => {
    const list = await kept();
    return list.some((item) => item.url === AAPL) ? list : null;
  });
  step("The link is on the Reading List on the server", Boolean(items), JSON.stringify(items));
  step(
    "beside what was already there",
    items?.some((item) => item.url === "https://example.com/earlier"),
  );
  await shot(page, path.join(out, `share-reading-list-${browserName}.png`));

  await reloadDesktop(page);
  step("It stays after a reload", (await kept()).filter((item) => item.url === AAPL).length === 1);
});
