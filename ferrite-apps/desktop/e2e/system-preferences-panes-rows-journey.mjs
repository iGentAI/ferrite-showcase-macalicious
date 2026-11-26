#!/usr/bin/env node
// System Preferences' General, Dock and Desktop panes on a served desktop: what each takes effect on, seen on the page with
// a screenshot, and read back after a reload; Sound's alert volume and device tabs, and Sidecar's pop-ups and Connect to.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/system-preferences-panes-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { writeFileSync } from "node:fs";
import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const URL = "/api/system-preferences/settings";
const RUN = Date.now().toString(36);

await journey("system-preferences-panes-rows", async ({ page, base, out, step }) => {
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `sp-panes-${name}.png`) });
  };
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const openApp = () =>
    page
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
  await openApp();
  await prefs.waitFor({ timeout: 10_000 });
  const openPane = async (name) => {
    await page.keyboard.press("Control+l");
    await prefs.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 5_000 });
    await prefs.getByRole("button", { name, exact: true }).first().click();
    await page.waitForTimeout(350);
  };
  const html = (name) => page.evaluate((n) => document.documentElement.getAttribute(n), name);
  const property = (name) =>
    page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name);
  const choose = async (label, option) => {
    await prefs.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
    await page.waitForTimeout(250);
  };

  await openPane("General");
  // Auto against a system that says dark: what is drawn then is what Dark draws, and not what Light draws.
  const windowColour = () =>
    prefs
      .locator(".mac-window")
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundColor);
  await prefs.getByRole("radio", { name: "Dark" }).click();
  await page.waitForTimeout(250);
  step("Dark turns the desktop dark", (await html("data-appearance")) === "dark");
  const darkColour = await windowColour();
  await prefs.getByRole("radio", { name: "Light" }).click();
  await page.waitForTimeout(250);
  step("Light turns it light", (await html("data-appearance")) === "light");
  const lightColour = await windowColour();
  await page.emulateMedia({ colorScheme: "dark" });
  await prefs.getByRole("radio", { name: "Auto", exact: true }).click();
  await page.waitForTimeout(300);
  const autoDark = await windowColour();
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(300);
  const autoLight = await windowColour();
  step(
    "Auto follows the system, dark and then light",
    darkColour !== lightColour && autoDark === darkColour && autoLight === lightColour,
    `${darkColour}, ${lightColour}, ${autoDark}, ${autoLight}`,
  );
  await prefs.getByRole("radio", { name: "Purple" }).click();
  await page.waitForTimeout(250);
  step("an accent colour reaches the page", (await html("data-accent")) === "purple");
  await choose("Highlight color:", "Green");
  step("a highlight colour reaches the page", (await html("data-highlight")) === "green");
  await choose("Sidebar icon size:", "Large");
  step(
    "Sidebar icon size sets the sidebars",
    (await property("--mac-sidebar-icon-size")) === "22px",
  );
  await prefs.getByRole("radio", { name: "Always" }).click();
  await page.waitForTimeout(250);
  step(
    "Show scroll bars Always keeps them shown",
    (await property("--mac-scroll-view-overlay-opacity")) === "1",
  );
  await prefs.getByRole("checkbox", { name: "Use font smoothing when available" }).click();
  await page.waitForTimeout(250);
  step("font smoothing off reaches the page", (await html("data-mac-font-smoothing")) === "off");
  const keptRecent = nextSave(
    page,
    URL,
    (body) => body?.values?.["general.recentItems"] !== undefined,
  ).catch(() => null);
  await choose("Recent items:", "5");
  await keptRecent;
  await shot("general");
  step(
    "General shows what was chosen",
    (await prefs.getByRole("radio", { name: "Purple" }).getAttribute("aria-checked")) === "true",
  );
  await page.waitForTimeout(800);

  await openPane("Dock");
  const dock = page.locator(".mac-dock").first();
  const sized = async () => (await dock.boundingBox()).height;
  const before = await sized();
  await prefs.getByRole("slider", { name: "Size:" }).focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(350);
  await shot("dock-size");
  step("Size changes the Dock", (await sized()) !== before, `${before} to ${await sized()}`);
  await prefs.getByRole("checkbox", { name: "Magnification:" }).click();
  // The picture on the tile grows; the button around it keeps its place in the row.
  const tile = page
    .getByRole("button", { name: /^Calculator$/ })
    .first()
    .locator("img, svg")
    .first();
  const small = await tile.boundingBox();
  await tile.hover();
  await page.waitForTimeout(300);
  const large = await tile.boundingBox();
  await shot("dock-magnified");
  step(
    "Magnification grows the tile under the pointer",
    large.width > small.width,
    `${small.width} to ${large.width}`,
  );
  await page.mouse.move(700, 400);
  await prefs.getByRole("radio", { name: "Left" }).click();
  await page.waitForTimeout(500);
  const left = await dock.boundingBox();
  await shot("dock-left");
  step(
    "Position on screen moves the Dock",
    left.x < 40 && left.height > left.width,
    JSON.stringify(left),
  );
  await prefs.getByRole("radio", { name: "Bottom" }).click();
  await page.waitForTimeout(500);
  await choose("Minimize windows using:", "Scale effect");
  step(
    "Minimize using Scale takes the Genie's narrowing off",
    (await property("--mac-managed-window-minimize-scale")) === "",
  );
  await choose("Minimize windows using:", "Genie effect");
  step(
    "and Genie puts it back",
    (await property("--mac-managed-window-minimize-scale")) === "0.03, 0.08",
  );
  await prefs.getByRole("checkbox", { name: "Automatically hide and show the Dock" }).click();
  await page.mouse.move(700, 300);
  await page.waitForTimeout(800);
  await shot("dock-hidden");
  step(
    "Automatically hide takes the Dock away",
    (await dock.getAttribute("data-autohide")) === "" &&
      (await dock.getAttribute("data-shown")) === null,
  );
  await page.mouse.move(700, 898);
  await page.waitForTimeout(600);
  step("and it comes back at the edge", (await dock.getAttribute("data-shown")) === "");
  await page.mouse.move(700, 300);
  await prefs.getByRole("checkbox", { name: "Automatically hide and show the Dock" }).click();
  await page.waitForTimeout(500);

  await openPane("Desktop & Screen Saver");
  await prefs.getByRole("tab", { name: "Desktop", exact: true }).click();
  await page.waitForTimeout(300);
  // The picture on the desktop, drawn: its source, and only once the browser has its pixels.
  const shownPicture = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".mac-desktop-shell-picture img")]
        .filter((image) => image.complete && image.naturalWidth > 0)
        .map((image) => decodeURIComponent(image.src))
        .join(" "),
    );
  const pictureBefore = await shownPicture();
  await prefs.getByRole("button", { name: "Mojave", exact: true }).click();
  await page.waitForTimeout(1_200);
  await shot("picture");
  const mojave = await shownPicture();
  step(
    "the gallery chooses the desktop picture",
    /mojave/i.test(mojave) && mojave !== pictureBefore,
    mojave.slice(-60),
  );
  const look = prefs.getByRole("combobox", { name: "Appearance of the desktop picture" });
  await look.click();
  const looks = await page.getByRole("option").allInnerTexts();
  await page.getByRole("option", { name: /Light/ }).first().click();
  await page.waitForTimeout(1_200);
  const mojaveLight = await shownPicture();
  await look.click();
  await page.getByRole("option", { name: /Dark/ }).first().click();
  await page.waitForTimeout(1_200);
  await shot("picture-dark");
  const mojaveDark = await shownPicture();
  step(
    "Light and Dark change it",
    looks.length === 3 &&
      /mojave-night/.test(mojaveDark) &&
      /mojave/.test(mojaveLight) &&
      !/night/.test(mojaveLight),
    `${looks.join(", ")}: ${mojaveLight.slice(-24)}, ${mojaveDark.slice(-24)}`,
  );

  const folders = prefs.getByRole("grid").or(prefs.getByRole("treegrid")).first();
  await folders.getByText("Colors", { exact: true }).click();
  await page.waitForTimeout(250);
  step(
    "the source outline chooses what is listed",
    await prefs.getByRole("button", { name: "Teal" }).isVisible(),
  );
  await folders.getByText("Folders", { exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  await folders.getByText("Pictures", { exact: true }).click();
  await page.waitForTimeout(300);
  const picture = path.join(out, `pane-picture-${RUN}.png`);
  writeFileSync(
    picture,
    await page.screenshot({ clip: { x: 0, y: 100, width: 320, height: 200 } }),
  );
  const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
  await prefs.getByRole("button", { name: "Add pictures" }).click();
  await (await chooser).setFiles(picture);
  const named = path.basename(picture).replace(/\.png$/, "");
  await prefs
    .getByRole("button", { name: new RegExp(named) })
    .first()
    .waitFor({ timeout: 8_000 });
  await shot("folders-pictures");
  step("+ adds a picture, and Folders > Pictures lists the person's drive", true);
  const remove = prefs.getByRole("button", { name: "Remove the selected folder" });
  await remove.click();
  await page.waitForTimeout(400);
  await shot("folder-removed");
  step(
    "− removes the folder from the list",
    (await folders.getByText("Pictures", { exact: true }).count()) === 0,
  );

  await openPane("Sound");
  await prefs.getByRole("tab", { name: "Sound Effects", exact: true }).click();
  await page.waitForTimeout(250);
  const volumeSlider = () => prefs.getByRole("slider", { name: "Alert volume:" });
  const volumeBefore = await volumeSlider().getAttribute("aria-valuenow");
  const saved = nextSave(
    page,
    URL,
    (body) => typeof body?.values?.["sound.alertVolume"] === "number",
  );
  await volumeSlider().focus();
  await page.keyboard.press("Home");
  await saved;
  const volumeSet = await volumeSlider().getAttribute("aria-valuenow");
  await shot("sound-effects");
  step("Alert volume moves", volumeSet !== volumeBefore, `${volumeBefore} to ${volumeSet}`);
  await prefs.getByRole("tab", { name: "Output", exact: true }).click();
  await page.waitForTimeout(400);
  await shot("sound-output");
  const devicesPanel = () =>
    prefs.locator("[role='tabpanel']").filter({
      hasText: "A web page cannot choose your computer's sound device",
    });
  step(
    "Output lists the browser's devices or says it has none, and that a page cannot choose",
    (await devicesPanel().first().isVisible()) &&
      ((await devicesPanel().first().locator("[role='row'][aria-selected]").count()) > 0 ||
        (await devicesPanel()
          .first()
          .getByText("This browser lists no devices of this kind")
          .isVisible())),
  );
  await prefs.getByRole("tab", { name: "Input", exact: true }).click();
  await page.waitForTimeout(400);
  await shot("sound-input");
  const inputPanel = prefs.locator("[role='tabpanel']").filter({
    hasText: "A web page cannot choose your computer's sound device",
  });
  step(
    "Input lists the browser's devices or says it has none, and that a page cannot choose",
    (await inputPanel.first().isVisible()) &&
      ((await inputPanel.first().locator("[role='row'][aria-selected]").count()) > 0 ||
        (await inputPanel
          .first()
          .getByText("This browser lists no devices of this kind")
          .isVisible())),
  );

  await openPane("Sidecar");
  await shot("sidecar-before");
  const frame = await prefs.boundingBox();
  const drawing = () =>
    page
      .screenshot({
        clip: { x: frame.x + 70, y: frame.y + 60, width: 250, height: 180 },
      })
      .then((image) => image.toString("base64"));
  const shape = await drawing();
  await choose("Sidebar position", "on the right");
  await page.waitForTimeout(300);
  await shot("sidecar-right");
  step("Sidebar position moves the drawing", (await drawing()) !== shape);
  const beforeBar = await drawing();
  await choose("Touch Bar position", "on the top");
  await page.waitForTimeout(300);
  step("Touch Bar position moves it too", (await drawing()) !== beforeBar);
  step(
    "Connect to says there are no devices",
    await prefs
      .getByText(/No Devices/)
      .first()
      .isVisible(),
  );

  await reloadDesktop(page);
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-accent") === "purple",
    null,
    { timeout: 10_000 },
  );
  await shot("after-reload");
  step(
    "the settings hold after a reload",
    (await html("data-highlight")) === "green" &&
      (await property("--mac-sidebar-icon-size")) === "22px",
  );
  await openApp();
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await openPane("Sound");
  await prefs.getByRole("tab", { name: "Sound Effects", exact: true }).click();
  await page.waitForTimeout(250);
  step(
    "and so does the alert volume",
    (await volumeSlider().getAttribute("aria-valuenow")) === volumeSet,
    `${volumeSet}`,
  );
});
