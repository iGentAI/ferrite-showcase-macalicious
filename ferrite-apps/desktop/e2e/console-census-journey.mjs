#!/usr/bin/env node
// Console's census (app `console`), part 1: the menus the desktop builds for Console (the rows every application shares,
// `appMenuRows` in r2-census-kit.mjs), verified with the real mouse on a fresh account under `ferrite dev`. Console's own
// window controls and its Action menu are part 2 of this suite.
//
//   node e2e/console-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit [--out dir]

import {
  appMenuRows,
  census,
  createAccount,
  openFromDock,
  person,
  verifyAppMenus,
} from "./r2-census-kit.mjs";

const MENUS = ["Console", "File", "Edit", "Action", "View", "Window", "Help"];
const rows = appMenuRows("console", "Console", MENUS, { resizable: true, own: ["Action", "Edit"] });

await census("console", rows, async (kit) => {
  const { base, run, newPage } = kit;
  const page = await newPage("console");
  await createAccount(page, base, person(run, "cons", "Cons"));
  const reopen = () => openFromDock(page, "Console", "console");
  await reopen();
  await verifyAppMenus(page, kit, rows, {
    app: "console",
    name: "Console",
    windowId: "console",
    reopen,
  });
});
