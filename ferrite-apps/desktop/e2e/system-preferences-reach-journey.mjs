#!/usr/bin/env node
// System Preferences, every pane's controls within reach of a real pointer: under `ferrite dev`, a fresh account opens
// System Preferences from the Dock and opens every pane of the grid and the account header with the mouse. In each, every
// visible control (buttons, tabs, pop-ups, checkboxes, radios, sliders, fields) must be the element a press at its centre
// lands on (`document.elementFromPoint`, read only), and the tabs of the panes with tab views (Sound, Keyboard,
// Language & Region, Spotlight, and any other pane's) are clicked with the real mouse and must become the selected tab.
// Before R2 01 a pane's form frame lay over its tab view and took every press there (Sound: all five controls).
//
//   node e2e/system-preferences-reach-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit

import { census, createAccount, person } from "./r2-census-kit.mjs";

const PANES = [
  "Apple ID",
  "Family Sharing",
  "General",
  "Desktop & Screen Saver",
  "Dock",
  "Mission Control",
  "Siri",
  "Spotlight",
  "Language & Region",
  "Notifications",
  "Internet Accounts",
  "Wallet & Apple Pay",
  "Touch ID",
  "Users & Groups",
  "Accessibility",
  "Screen Time",
  "Extensions",
  "Security & Privacy",
  "Software Update",
  "Network",
  "Bluetooth",
  "Sound",
  "Printers & Scanners",
  "Keyboard",
  "Trackpad",
  "Mouse",
  "Displays",
  "Sidecar",
  "Energy Saver",
  "Date & Time",
  "Sharing",
  "Time Machine",
  "Startup Disk",
];
const HEADER = new Set(["Apple ID", "Family Sharing"]);
const key = (pane) =>
  pane
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-");
const rows = PANES.flatMap((pane) => [
  {
    id: `system-preferences.${key(pane)}.reach`,
    pane,
    what: "every visible control is what a press at its centre hits",
  },
  {
    id: `system-preferences.${key(pane)}.tabs`,
    pane,
    what: "each tab is selected by a real click",
  },
]);

const CONTROLS =
  'button, [role="button"], [role="tab"], [role="combobox"], [role="checkbox"], [role="radio"], [role="switch"], ' +
  '[role="slider"], input:not([type="hidden"]), select, textarea, a[href], [role="option"], [role="spinbutton"]';

await census("system-preferences-reach", rows, async ({ base, run, newPage, check }) => {
  const page = await newPage("reach");
  await createAccount(page, base, person(run, "reach", "Reach"));
  await page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "System Preferences", exact: true })
    .click();
  const window = page
    .locator(".mac-managed-window")
    .filter({ has: page.getByRole("group", { name: "All preferences" }) });
  await window.first().waitFor({ timeout: 10_000 });
  const frame = page
    .locator(".mac-managed-window")
    .filter({ has: page.locator('[data-window-state="key"]') })
    .last();
  for (const pane of PANES) {
    const id = key(pane);
    const scope = HEADER.has(pane) ? frame : frame.getByRole("group", { name: "All preferences" });
    await scope.getByRole("button", { name: pane, exact: true }).first().click();
    await frame
      .getByRole("region", { name: pane === "Displays" ? /./ : pane })
      .first()
      .waitFor({ timeout: 8_000 })
      .catch(() => {});
    await page.waitForTimeout(500);
    // Read only: which visible controls a press at their centre would not reach.
    const covered = await frame.evaluate((root, selector) => {
      const pane = root.querySelector(".mac-system-preferences-pane") ?? root;
      const out = [];
      for (const element of pane.querySelectorAll(selector)) {
        const box = element.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) continue;
        const style = getComputedStyle(element);
        if (
          style.visibility === "hidden" ||
          style.display === "none" ||
          element.closest("[hidden], [inert]")
        )
          continue;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        // Visually hidden for assistive technology only (Base UI's range input): not a pointer target.
        if (
          /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)|inset\(50%\)/.test(
            `${style.clip} ${style.clipPath}`,
          )
        )
          continue;
        // Scrolled out of a scroll view: a person scrolls it into view first (the census suites scroll with the wheel).
        let clipped = false;
        for (let a = element.parentElement; a && a !== pane.parentElement; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (!/(hidden|auto|scroll|clip)/.test(`${s.overflowX} ${s.overflowY}`)) continue;
          const r = a.getBoundingClientRect();
          if (y < r.top || y > r.bottom || x < r.left || x > r.right) {
            clipped = true;
            break;
          }
        }
        if (clipped) continue;
        const hit = document.elementFromPoint(x, y);
        // Reached: the press lands on the control itself or inside it, or on a label that forwards to it. A hit on an
        // ancestor is not a reach: a control with pointer-events none passes the press to its parent, which does not
        // click the control.
        const label = hit?.closest("label");
        if (
          hit &&
          (hit === element ||
            element.contains(hit) ||
            (label && (label.control === element || label.contains(element))))
        )
          continue;
        // A slider takes the press on its own thumb and track (Base UI), which wrap its range input: the same widget.
        const slider = element.closest(".mac-slider");
        if (slider && hit && slider.contains(hit)) continue;
        out.push(
          `${element.getAttribute("aria-label") || element.textContent.trim().slice(0, 30) || element.tagName} <- ${hit ? hit.className || hit.tagName : "nothing"}`,
        );
      }
      return out;
    }, CONTROLS);
    check(
      `system-preferences.${id}.reach`,
      covered.length === 0,
      covered.length ? `${covered.length} covered: ${covered.slice(0, 4).join(" | ")}` : "",
    );
    const tabs = frame.locator(".mac-system-preferences-pane").getByRole("tab");
    const count = await tabs.count();
    const missed = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const tab = tabs.nth(i);
      const name = ((await tab.textContent()) ?? "").trim();
      await tab.click({ timeout: 4_000 }).catch(() => {});
      if ((await tab.getAttribute("aria-selected")) !== "true") missed.push(name);
    }
    check(
      `system-preferences.${id}.tabs`,
      missed.length === 0,
      count === 0
        ? "no tabs"
        : missed.length
          ? `not selected by a click: ${missed.join(", ")}`
          : `${count} tabs`,
    );
    await frame.getByRole("button", { name: "Show All" }).first().click();
    await frame.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 8_000 });
  }
});
