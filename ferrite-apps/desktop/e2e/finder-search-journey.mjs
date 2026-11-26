#!/usr/bin/env node
// Finder's search on the signed-in person's drive: it finds a file by the words inside it as well as
// by its name, every one that matches, and in the folder it is scoped to.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-search-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { driveOps, uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-search");
const tag = Date.now().toString(36);
const WORD = `zephyr${tag}`;
const NAMED = `${WORD} by name.txt`;
const INSIDE = (n) => `Plain ${tag} ${n}.txt`;

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const ids = [
    await uploadFile(page, {
      parent: "documents",
      name: NAMED,
      type: "text/plain",
      text: "nothing",
    }),
  ];
  for (let n = 0; n < 12; n += 1) {
    ids.push(
      await uploadFile(page, {
        parent: n === 0 ? "downloads" : "documents",
        name: INSIDE(n),
        type: "text/plain",
        text: `Some lines, and the word ${WORD} among them.`,
      }),
    );
  }
  await page.reload();
  await openDesktop(page, base, step);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const bar = page.getByRole("menubar").first();
  await bar.getByRole("menuitem", { name: "Go", exact: true }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Documents", exact: true }).click();

  const results = win.getByRole("option").or(win.getByRole("button", { name: /\.txt$/ }));
  const named = (name) => win.getByText(name, { exact: true });
  const scopeBar = win
    .getByRole("radiogroup", { name: "Search" })
    .or(win.getByRole("group", { name: "Search" }));
  await win.getByRole("searchbox", { name: "Search" }).fill(WORD);
  await scopeBar.first().waitFor({ timeout: 5_000 });
  await scopeBar.first().getByText("This Mac").click();

  step(
    "A name holding the word is found",
    await until(async () => (await named(NAMED).count()) > 0),
  );
  step(
    "A file is found by the words inside it",
    await until(async () => (await named(INSIDE(1)).count()) > 0),
  );
  step(
    "Every one that matches is listed, past the ten Spotlight shows",
    (await until(async () => (await named(INSIDE(11)).count()) > 0)) &&
      (await named(INSIDE(0)).count()) > 0,
  );
  await shot(page, path.join(out, `finder-search-contents-${browserName}.png`));

  // A change of the drive while a file found by its words is selected leaves it selected.
  const found = win.getByRole("option", { name: INSIDE(1), exact: true }).first();
  await found.click();
  await win.getByRole("button", { name: "Edit Tags" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Red", exact: true }).click();
  await page.keyboard.press("Escape");
  step(
    "Tagging a file found by its words leaves it selected",
    (await until(async () => {
      const { json } = await api(page, "GET", "/api/files/");
      return json.entries.some((each) => each.name === INSIDE(1) && each.tags?.includes("Red"));
    })) && (await found.getAttribute("aria-selected")) === "true",
  );

  await scopeBar.first().getByText("“Documents”").click();
  step(
    "Scoped to Documents, the one in Downloads goes",
    (await until(async () => (await named(INSIDE(0)).count()) === 0)) &&
      (await named(INSIDE(1)).count()) > 0,
  );

  await win.getByRole("searchbox", { name: "Search" }).fill(`nosuch${tag}`);
  step(
    "Another word finds none of them",
    await until(async () => (await named(INSIDE(1)).count()) === 0),
  );
  await win.getByRole("searchbox", { name: "Search" }).fill("");
  await until(async () => (await results.count()) >= 0);

  await driveOps(
    page,
    ids.map((id) => ({ op: "trash", id })),
  );
});
