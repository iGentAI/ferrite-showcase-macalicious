#!/usr/bin/env node

// The overlays' census: Launchpad and Notification Center (app `desktop`), Spotlight (app `spotlight`) and Siri (app
// `siri`), real input on a served desktop, an account made at the login window.
//   node e2e/desktop-overlays-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit [--out dir]

import { until } from "./r2-app-census.mjs";
import {
  census,
  closeAll,
  closeMenus,
  createAccount,
  dockButton,
  managedOf,
  person,
} from "./r2-census-kit.mjs";

const V = "desktop-overlays-census-journey.mjs";
const R = (app, id, state, role, name, how, expected) => ({
  id: `${app}.${id}`,
  app,
  window_or_state: state,
  role,
  name,
  how_reached: how,
  expected_outcome: expected,
  verified_by: `${V} ${app}.${id}`,
  persists: "none",
  notes: "",
});
const SUGGESTIONS = [
  "“What’s on my calendar today?”",
  "“Remind me to call Mom at 5 PM tomorrow”",
  "“Make a note that says Buy flowers”",
  "“Turn on dark mode”",
  "“Open Calculator”",
];
const rows = [
  R(
    "desktop",
    "launchpad.close",
    "overlay:Launchpad",
    "button",
    "Close Launchpad",
    "Launchpad from the Dock; a click on its empty backdrop (the Close Launchpad area)",
    "Launchpad closes",
  ),
  R(
    "desktop",
    "launchpad.search",
    "overlay:Launchpad",
    "searchbox",
    "Search",
    "Launchpad from the Dock; Calculator typed",
    "Launchpad keeps only the apps whose name holds what is typed: Calculator stays, Safari and Chess go",
  ),
  R(
    "spotlight",
    "search",
    "overlay:Spotlight",
    "combobox",
    "Spotlight Search",
    "Spotlight from the menu bar; Calculator typed, then Return",
    "the top hit, Calculator, opens",
  ),
  R(
    "siri",
    "close",
    "overlay:Siri",
    "button",
    "Close",
    "Siri from the menu bar; its close button",
    "Siri closes",
  ),
  R(
    "siri",
    "type",
    "overlay:Siri",
    "textbox",
    "Type to Siri",
    "Siri from the menu bar; Open Calculator typed, then Return",
    "Siri answers and Calculator opens",
  ),
  ...SUGGESTIONS.map((s, i) =>
    R(
      "siri",
      `suggestion.${i + 1}`,
      "overlay:Siri",
      "button",
      s,
      `Siri from the menu bar; the suggestion clicked`,
      "Siri asks it (its prompt shows the request) and answers",
    ),
  ),
  R(
    "siri",
    "help",
    "overlay:Siri",
    "button",
    "Help",
    "Siri from the menu bar; Help clicked",
    "Siri says Some things you can ask me: over its example requests",
  ),
  R(
    "siri",
    "listen",
    "overlay:Siri",
    "button",
    "Listen",
    "Siri from the menu bar; Listen clicked",
    "Siri shows Listening… (the orb pressed), or says it cannot hear and to type instead",
  ),
  R(
    "desktop",
    "notification-center.today",
    "overlay:Notification Center",
    "tab",
    "Today",
    "Notification Center from the menu bar; Today clicked",
    "the Today view, its tab selected",
  ),
  R(
    "desktop",
    "notification-center.notifications",
    "overlay:Notification Center",
    "tab",
    "Notifications",
    "Notification Center from the menu bar; Notifications clicked",
    "the Notifications view, its tab selected",
  ),
  R(
    "desktop",
    "notification-center.do-not-disturb",
    "overlay:Notification Center > tab:Today",
    "switch",
    "Do Not Disturb",
    "Notification Center from the menu bar; the switch clicked, then again",
    "turns Do Not Disturb on, and off again",
  ),
];

await census("desktop-overlays", rows, async ({ base, run, newPage, check }) => {
  const page = await newPage("desktop-overlays");
  await createAccount(page, base, person(run, "overlays", "Overlay Census"));
  const extras = page.getByRole("menubar", { name: "Status menus" });
  const launchpadDialog = page.getByRole("dialog", { name: "Launchpad" });
  const siriDialog = page.getByRole("dialog", { name: "Siri" });
  const shown = async (locator) =>
    (await locator.count()) > 0 && (await locator.first().isVisible());
  const reset = async () => {
    await closeMenus(page);
    // Siri closes by its own close button (a second click on its menu extra would toggle it).
    if (await shown(siriDialog))
      await siriDialog.getByRole("button", { name: "Close", exact: true }).click();
    if (await shown(launchpadDialog)) await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await closeAll(page);
  };
  const run1 = async (id, fn) => {
    let ok = false;
    let detail = "";
    try {
      [ok, detail = ""] = await fn();
    } catch (error) {
      detail = String(error.message).split("\n")[0];
    }
    check(id, ok, detail);
    await reset();
  };
  const launchpad = async () => {
    await dockButton(page, "Launchpad").click();
    const search = page.getByRole("searchbox", { name: "Search" }).last();
    await search.waitFor({ timeout: 5_000 });
    return search;
  };
  await run1("desktop.launchpad.close", async () => {
    await launchpad();
    const close = page.getByRole("button", { name: "Close Launchpad" });
    // The dismiss area is Launchpad's backdrop, under its icons: a point of it no icon covers (read only), then the click.
    const at = await close.evaluate((area) => {
      const b = area.getBoundingClientRect();
      for (const fy of [0.04, 0.08, 0.5, 0.92, 0.96])
        for (const fx of [0.03, 0.1, 0.5, 0.9, 0.97]) {
          const x = b.x + b.width * fx;
          const y = b.y + b.height * fy;
          if (document.elementFromPoint(x, y) === area) return { x, y };
        }
      return null;
    });
    if (!at) return [false, "no point of the backdrop is free of icons"];
    await page.mouse.click(at.x, at.y);
    return [
      await until(page, async () => !(await shown(launchpadDialog))),
      `clicked at ${Math.round(at.x)},${Math.round(at.y)}`,
    ];
  });
  await run1("desktop.launchpad.search", async () => {
    const search = await launchpad();
    const before = await launchpadDialog.innerText();
    const all = ["Calculator", "Safari", "Chess"].every((name) => before.includes(name));
    await search.click();
    await page.keyboard.type("Calculator");
    const ok = await until(page, async () => {
      const now = await launchpadDialog.innerText();
      return now.includes("Calculator") && !now.includes("Safari") && !now.includes("Chess");
    });
    return [all && ok, `all shown first=${all}, narrowed to Calculator=${ok}`];
  });
  await run1("spotlight.search", async () => {
    await extras.getByRole("menuitem", { name: "Spotlight" }).click();
    const box = page.getByRole("combobox", { name: "Spotlight Search" });
    await box.click();
    await page.keyboard.type("Calculator");
    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");
    const ok = await managedOf(page, "calculator")
      .waitFor({ timeout: 8_000 })
      .then(
        () => true,
        () => false,
      );
    return [ok, ok ? "Calculator opened" : "no Calculator window"];
  });
  const siri = async () => {
    await extras.getByRole("menuitem", { name: "Siri" }).click();
    const box = page.getByRole("textbox", { name: "Type to Siri" });
    await box.waitFor({ timeout: 5_000 });
    return box;
  };
  await run1("siri.close", async () => {
    await siri();
    await siriDialog.getByRole("button", { name: "Close", exact: true }).click();
    return [await until(page, async () => !(await shown(siriDialog)))];
  });
  await run1("siri.type", async () => {
    const box = await siri();
    await box.click();
    await page.keyboard.type("Open Calculator");
    await page.keyboard.press("Enter");
    const ok = await managedOf(page, "calculator")
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
    return [ok, ok ? "Calculator opened" : "no Calculator window"];
  });
  // Siri's prompt (what it was asked, or what it says) and its answer, read from Siri's own elements.
  const prompt = () =>
    siriDialog
      .locator(".mac-siri-prompt")
      .innerText()
      .catch(() => "");
  const answer = () =>
    siriDialog
      .locator("[data-answer]")
      .innerText()
      .catch(() => "");
  for (const [i, s] of SUGGESTIONS.entries())
    await run1(`siri.suggestion.${i + 1}`, async () => {
      await siri();
      await siriDialog.getByRole("button", { name: s, exact: true }).click();
      const ok = await until(
        page,
        async () => (await prompt()) === s && (await answer()).trim().length > 0,
        10_000,
      );
      return [
        ok,
        ok ? `answered: ${(await answer()).slice(0, 60)}` : `prompt "${await prompt()}", no answer`,
      ];
    });
  await run1("siri.help", async () => {
    await siri();
    await siriDialog.getByRole("button", { name: "Help", exact: true }).click();
    const ok = await until(
      page,
      async () =>
        (await prompt()) === "Some things you can ask me:" &&
        (await siriDialog.getByRole("list", { name: "Example requests" }).isVisible()),
    );
    return [ok, `prompt "${await prompt()}"`];
  });
  await run1("siri.listen", async () => {
    await siri();
    const orb = siriDialog.getByRole("button", { name: "Listen", exact: true });
    await orb.click();
    const cannot = [
      "I can’t hear you right now; type your request instead.",
      "This browser can’t hear you; type your request instead.",
    ];
    let seen = "";
    const ok = await until(
      page,
      async () => {
        if (
          (await prompt()) === "Listening…" &&
          (await orb.getAttribute("aria-pressed")) === "true"
        )
          seen = "listening";
        else if (cannot.includes((await answer()).trim())) seen = (await answer()).trim();
        return seen !== "";
      },
      8_000,
    );
    // Listening: a second press stops it.
    if (seen === "listening") await orb.click();
    return [ok, seen || `prompt "${await prompt()}", answer "${await answer()}"`];
  });
  const nc = async () => {
    await extras.getByRole("menuitem", { name: "Notification Center" }).click();
    await page.getByRole("tab", { name: "Today" }).waitFor({ timeout: 5_000 });
  };
  for (const tab of ["Notifications", "Today"])
    await run1(`desktop.notification-center.${tab.toLowerCase()}`, async () => {
      await nc();
      const t = page.getByRole("tab", { name: tab });
      await t.click();
      return [await until(page, async () => (await t.getAttribute("aria-selected")) === "true")];
    });
  await run1("desktop.notification-center.do-not-disturb", async () => {
    await nc();
    const sw = page.getByRole("switch", { name: "Do Not Disturb" });
    const before = await sw.getAttribute("aria-checked");
    await sw.click();
    const flipped = await until(
      page,
      async () => (await sw.getAttribute("aria-checked")) !== before,
    );
    await sw.click();
    const back = await until(page, async () => (await sw.getAttribute("aria-checked")) === before);
    return [flipped && back, `on=${flipped}, off again=${back}`];
  });
});
