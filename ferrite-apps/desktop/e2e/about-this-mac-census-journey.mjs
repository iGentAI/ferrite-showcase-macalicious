#!/usr/bin/env node
// About This Mac's census (app `about-this-mac`) on a served desktop, an account made at the login window, the real mouse:
// its five tabs; every button and link, each pressed on the window opened afresh from the Dock, with what it opens
// (System Information, Storage Management, System Preferences on Software Update or Displays, Help Viewer, or Apple's
// page in Safari: R2 bundle 07, before which every press did nothing); and the window's own chrome: close, minimize and
// back from the Dock, and the zoom button dimmed with its reason (a fixed-size window: R2 bundle 06). Its menus are
// Finder's, which desktop-census-journey.mjs verifies.
//
//   node e2e/about-this-mac-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit [--out dir]

import {
  census,
  closeAll,
  createAccount,
  dockButton,
  frameOf,
  managedOf,
  openFromDock,
  person,
  preferencesShow,
  slug,
} from "./r2-census-kit.mjs";

const V = "about-this-mac-census-journey.mjs";
const TABS = ["Overview", "Displays", "Storage", "Support", "Service"];
const SAFARI = "Safari opens, Apple's page in a new tab";
/** The Apple page each link opens in Safari (about-this-mac-desktop.tsx's ABOUT_LINKS). */
const ADDRESSES = {
  "License Agreement": "https://www.apple.com/legal/sla/",
  "macOS Support": "https://support.apple.com/macos",
  "User Manual": "https://support.apple.com/manuals/",
  Specifications: "https://support.apple.com/specs/",
  "Hardware Support": "https://support.apple.com/mac",
  "Important Information…": "https://www.apple.com/legal/",
  "Check my service and support coverage status…": "https://checkcoverage.apple.com/",
  "Check my repair options…": "https://support.apple.com/repair",
  "Learn more about service plans…": "https://www.apple.com/support/products/mac/",
};
/** [tab, role, name, what it opens: a window id, `pane:<id>` for System Preferences, or `safari`]. */
const CONTROLS = [
  ["Overview", "button", "System Report…", "system-information"],
  ["Overview", "button", "Software Update…", "pane:software-update"],
  ["Overview", "link", "License Agreement", "safari"],
  ["Displays", "button", "Displays Preferences…", "pane:displays"],
  ["Storage", "button", "Manage…", "storage-management"],
  ["Support", "button", "macOS Help", "help-viewer"],
  ["Support", "button", "macOS Support", "safari"],
  ["Support", "button", "User Manual", "safari"],
  ["Support", "button", "Specifications", "safari"],
  ["Support", "button", "Hardware Support", "safari"],
  ["Support", "button", "Important Information…", "safari"],
  ["Service", "button", "Check my service and support coverage status…", "safari"],
  ["Service", "button", "Check my repair options…", "safari"],
  ["Service", "button", "Learn more about service plans…", "safari"],
];
const OPENS = {
  "system-information": "System Information opens",
  "storage-management": "Storage Management opens",
  "help-viewer": "Help Viewer opens",
  "pane:software-update": "System Preferences opens on Software Update",
  "pane:displays": "System Preferences opens on Displays",
  safari: SAFARI,
};

const row = (id, state, role, name, how, expected, extra = {}) => ({
  id: `about-this-mac.${id}`,
  app: "about-this-mac",
  window_or_state: state,
  role,
  name,
  how_reached: how,
  expected_outcome: expected,
  verified_by: `${V} ${id}`,
  persists: "none",
  notes: "",
  ...extra,
});
const rows = [
  ...TABS.map((tab) =>
    row(
      `tab.${slug(tab)}`,
      "window:About This Mac",
      "tab",
      tab,
      `the ${tab} tab clicked`,
      "its pane shows, the tab selected",
    ),
  ),
  ...CONTROLS.map(([tab, role, name, opens]) =>
    row(
      `${slug(tab)}.${slug(name)}`,
      `window:About This Mac > tab:${tab}`,
      role,
      name,
      `About This Mac from the Dock, the ${tab} tab, then ${name} clicked`,
      opens === "safari" ? `${SAFARI}: ${ADDRESSES[name]}` : OPENS[opens],
    ),
  ),
  row(
    "chrome.close",
    "window:About This Mac",
    "button",
    "Close",
    "its close button",
    "the window closes",
  ),
  row(
    "chrome.minimize",
    "window:About This Mac",
    "button",
    "Minimize",
    "its minimize button; then its Dock tile",
    "the window goes to the Dock and its tile brings it back",
  ),
  row(
    "chrome.zoom",
    "window:About This Mac",
    "button",
    "Zoom",
    "its green button read",
    "unavailable:This window has a fixed size",
  ),
];

await census("about-this-mac", rows, async ({ base, run, newPage, check, skip, allowed }) => {
  // Each row opens About This Mac afresh, which closes the window a Safari row opened: Safari's request for the Apple
  // page still on its way is cut short by that close (net::ERR_ABORTED), the page's own doing. Safari's census verifies
  // its loading; here the row asserts the address Safari shows.
  allowed.aborts = true;
  const page = await newPage("about-this-mac");
  await createAccount(page, base, person(run, "atm", "About Census"));
  /** About This Mac opened afresh from the Dock, on `tab`. */
  const fresh = async (tab) => {
    await closeAll(page);
    const win = await openFromDock(page, "About This Mac", "about-this-mac");
    if (tab) {
      await win.getByRole("tab", { name: tab, exact: true }).click();
      await page.waitForTimeout(250);
    }
    return win;
  };
  for (const tab of TABS) {
    const win = await fresh(null);
    const t = win.getByRole("tab", { name: tab, exact: true });
    await t.click();
    await page.waitForTimeout(250);
    check(`about-this-mac.tab.${slug(tab)}`, (await t.getAttribute("aria-selected")) === "true");
  }
  for (const [tab, role, name, opens] of CONTROLS) {
    const id = `about-this-mac.${slug(tab)}.${slug(name)}`;
    let detail = "";
    let ok = false;
    try {
      const win = await fresh(tab);
      await win.getByRole(role, { name, exact: true }).first().click();
      if (opens.startsWith("pane:")) {
        ok = await preferencesShow(page, opens.slice(5), 8_000);
        detail = ok ? "" : "System Preferences not on the pane";
      } else {
        ok = await managedOf(page, opens)
          .waitFor({ state: "visible", timeout: 8_000 })
          .then(
            () => true,
            () => false,
          );
        detail = ok ? "" : `no ${opens} window`;
        // Safari: the link's own Apple address, in Safari's address field or its tab (read only).
        if (ok && opens === "safari") {
          const want = ADDRESSES[name].replace(/^https:\/\//, "").replace(/\/$/, "");
          const shows = async () => {
            const safari = managedOf(page, "safari");
            const values = await safari
              .locator("input")
              .evaluateAll((list) => list.map((e) => e.value));
            const text = await safari.innerText().catch(() => "");
            return [...values, text].some((v) => v.includes(want));
          };
          ok = false;
          for (let i = 0; i < 16 && !ok; i += 1) {
            ok = await shows();
            if (!ok) await page.waitForTimeout(250);
          }
          detail = ok ? `shows ${want}` : `Safari does not show ${want}`;
        }
      }
    } catch (error) {
      detail = String(error.message).split("\n")[0];
    }
    check(id, ok, detail);
  }
  {
    const win = await fresh(null);
    await win.getByRole("button", { name: "Close" }).first().click();
    await page.waitForTimeout(300);
    check("about-this-mac.chrome.close", (await managedOf(page, "about-this-mac").count()) === 0);
  }
  {
    const win = await fresh(null);
    await win.getByRole("button", { name: "Minimize" }).first().click();
    await page.waitForTimeout(500);
    const mini = (await frameOf(win)).minimized;
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: /minimized window$/ })
      .first()
      .click();
    await page.waitForTimeout(500);
    const back = !(await frameOf(win)).minimized;
    check("about-this-mac.chrome.minimize", mini && back, `minimized=${mini}, back=${back}`);
  }
  {
    const win = await fresh(null);
    const zoom = win.getByRole("button", { name: /^(Zoom|Enter Full Screen)$/ }).first();
    const reason = await zoom.getAttribute("title");
    skip(
      "about-this-mac.chrome.zoom",
      "unavailable:This window has a fixed size",
      (await zoom.isDisabled()) && reason === "This window has a fixed size",
    );
  }
  await closeAll(page);
  void dockButton;
});
