#!/usr/bin/env node
// Maps: the Places sidebar by hand. Favorites and guides reordered by a real drag, a Recent dragged
// into a guide, several rows chosen with Command-click and Shift-click and removed by the menu and the
// key, a row dragged out as its link, each read back from the server and over a reload. It runs as
// the guest of a new browser, whose places nobody else has.
//
//   node e2e/maps-sidebar-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("maps-sidebar", { ignoreOtherOrigins: true });
const PLACES = "/api/maps/places";
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

const place = (id, name) => ({ id, name, category: "park", lat: 37.8, lon: -122.4, address: [] });
const seed = {
  favorites: [
    place("fa", "Alpha"),
    place("fb", "Bravo"),
    place("fc", "Charlie"),
    place("fd", "Delta"),
    place("fe", "Echo"),
  ],
  recents: [place("ra", "Recent One")],
  guides: [
    { id: "g1", name: "Weekend", places: [place("pa", "Pier"), place("pb", "Bridge")] },
    { id: "g2", name: "Lunch", places: [] },
  ],
};

await run(async (page) => {
  await openDesktop(page, base, step);
  const held = (await api(page, "GET", PLACES)).json;
  await api(page, "PUT", PLACES, { ...seed, rev: held.rev });
  await reloadDesktop(page);

  const open = async () => {
    await launch(page, "Maps");
    const window = page.getByRole("region", { name: "Maps", exact: true }).first();
    await window.waitFor({ state: "visible", timeout: 15_000 });
    const places = window.getByRole("button", { name: "Places" }).first();
    if ((await places.getAttribute("aria-pressed")) !== "true") await places.click();
    return window;
  };
  let window = await open();
  const row = (name) =>
    window.locator(".mac-maps-sidebar [role='treeitem'][data-value]", { hasText: name }).first();
  await row("Alpha").waitFor({ timeout: 10_000 });
  const stored = async () => (await api(page, "GET", PLACES)).json;
  const ids = (list) => (list ?? []).map(({ id }) => id).join();

  const drag = async (from, to, where) => {
    const start = await from.boundingBox();
    const end = await to.boundingBox();
    const y =
      where === "top"
        ? end.y + 2
        : where === "bottom"
          ? end.y + end.height - 2
          : end.y + end.height / 2;
    await page.mouse.move(start.x + 40, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + 44, start.y + start.height / 2 + 6, { steps: 4 });
    await page.mouse.move(end.x + 40, y, { steps: 10 });
  };

  // ---- Reorder -----------------------------------------------------------------------------------
  await drag(row("Charlie"), row("Alpha"), "top");
  const line = await row("Alpha").getAttribute("data-drop");
  await shot(page, path.join(out, "maps-row-drag.png"));
  await page.mouse.up();
  step("a line shows where a row would land", line === "before", String(line));
  step(
    "dragging a Favorite to the top moves it there",
    await until(async () => ids((await stored()).favorites) === "fc,fa,fb,fd,fe", 5_000),
    ids((await stored()).favorites),
  );

  await drag(row("Lunch"), row("Weekend"), "top");
  await page.mouse.up();
  step(
    "dragging a guide above another moves it there",
    await until(async () => ids((await stored()).guides) === "g2,g1", 5_000),
    ids((await stored()).guides),
  );

  await drag(row("Bridge"), row("Pier"), "top");
  await page.mouse.up();
  step(
    "dragging a place within a guide moves it there",
    await until(
      async () =>
        ids((await stored()).guides.find((guide) => guide.id === "g1")?.places) === "pb,pa",
      5_000,
    ),
  );

  // ---- Into a guide ------------------------------------------------------------------------------
  await drag(row("Recent One"), row("Lunch"), "middle");
  const into = await row("Lunch").getAttribute("data-drop");
  await page.mouse.up();
  step(
    "a Recent dragged onto a guide joins it, and stays in Recents",
    into === "into" &&
      (await until(async () => {
        const now = await stored();
        return (
          ids(now.guides.find((guide) => guide.id === "g2")?.places) === "ra" &&
          ids(now.recents) === "ra"
        );
      }, 5_000)),
    String(into),
  );

  // ---- Dragged out -------------------------------------------------------------------------------
  const field = window.getByRole("searchbox").first();
  await drag(row("Alpha"), field, "middle");
  await page.mouse.up();
  const typed = await field.inputValue();
  step(
    "a row dragged to a text field drops its name and link",
    typed.startsWith("Alpha https://www.openstreetmap.org/"),
    typed,
  );
  await field.fill("");

  step(
    "a row dragged has not been shown or added to Recents",
    !ids((await stored()).recents).includes("fa") &&
      (await window.locator(".mac-maps-pin[data-selected]").count()) === 0,
    ids((await stored()).recents),
  );
  await row("Alpha").click();
  step(
    "a click on that same row then shows it, and adds it to Recents",
    await until(async () => ids((await stored()).recents).includes("fa"), 5_000),
    ids((await stored()).recents),
  );

  // ---- Several -----------------------------------------------------------------------------------
  await row("Charlie").click();
  await row("Bravo").click({ modifiers: [COMMAND] });
  const marked = () => window.locator(".mac-maps-sidebar [data-marked]").count();
  step("Command-click chooses a second row", (await marked()) === 2, String(await marked()));
  await shot(page, path.join(out, "maps-rows-chosen.png"));
  await row("Bravo").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove 2 Items" }).click();
  step(
    "the menu removes both and only them",
    await until(async () => ids((await stored()).favorites) === "fa,fd,fe", 5_000),
    ids((await stored()).favorites),
  );

  await row("Alpha").click();
  await row("Delta").click({ modifiers: [COMMAND] });
  await row("Alpha").click({ modifiers: [COMMAND] });
  await page.keyboard.press("Delete");
  step(
    "a row taken out of the choice leaves the other, which Delete removes",
    await until(async () => ids((await stored()).favorites) === "fa,fe", 5_000),
    ids((await stored()).favorites),
  );

  await row("Alpha").click();
  await row("Echo").click({ modifiers: [COMMAND] });
  await page.keyboard.press("ArrowDown");
  step("an arrow key moves on from the choice", (await marked()) === 0, String(await marked()));
  await page.keyboard.press("Delete");
  step(
    "Delete then removes the row the keys reached, and not the old choice",
    await until(async () => ids((await stored()).favorites) === "fa", 5_000),
    ids((await stored()).favorites),
  );

  await row("Lunch").click();
  await row("Pier").click({ modifiers: ["Shift"] });
  step("Shift-click chooses the rows between", (await marked()) >= 3, String(await marked()));
  await page.keyboard.press("Delete");
  step(
    "Delete removes the rows chosen",
    await until(
      async () => (await stored()).guides.some((guide) => guide.id === "g2") === false,
      5_000,
    ),
    ids((await stored()).guides),
  );

  await reloadDesktop(page);
  window = await open();
  await row("Alpha").waitFor({ timeout: 10_000 });
  const after = await stored();
  step(
    "over a reload the rows are as they were left",
    (await row("Lunch").count()) === 0 &&
      (await window.locator('[data-value="favorite:fc"]').count()) === 0 &&
      (await window.locator('[data-value="favorite:fa"]').count()) === 1,
    `${ids(after.favorites)}; ${ids(after.guides)}`,
  );
});
