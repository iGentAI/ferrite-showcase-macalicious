#!/usr/bin/env node
// TextEdit and Script Editor, batch 3: tabs across a reload, a further window's document across Quit,
// a frame kept with a file, a link's click, Spotlight on a saved document; Script Editor's tabs,
// Customize Toolbar, Services, and a file a script writes in the Open panel without a reload.
import { api, journey, launch, openDesktop, options, reloadDesktop } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-script-batch3");
const SETTINGS = "/api/system-preferences/settings";
const TEXTEDIT = '[data-window-id^="textedit"]';
const SCRIPTS = '[data-window-id^="script-editor"]:not([data-window-id*=":window-"])';
const stamp = Date.now();

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  const values = async () => (await api(page, "GET", SETTINGS)).json.values ?? {};
  /** A setting as the server holds it, once it says what `ok` looks for. */
  const stored = async (key, ok) => {
    for (let at = 0; at < 40; at += 1) {
      const value = (await values())[key];
      if (ok(value)) return value;
      await page.waitForTimeout(250);
    }
    return (await values())[key];
  };
  const menu = async (...path) => {
    const bar = page.getByRole("menubar").first();
    await bar.getByRole("menuitem", { name: path[0], exact: true }).click();
    for (const name of path.slice(1, -1)) {
      await page.getByRole("menuitem", { name, exact: true }).first().hover();
    }
    await page
      .getByRole("menuitem", { name: path.at(-1), exact: true })
      .first()
      .click();
    await page.waitForTimeout(300);
  };
  const shown = (selector) =>
    page
      .locator(selector)
      .evaluateAll((all) =>
        all
          .filter(
            (each) => getComputedStyle(each).visibility !== "hidden" && !each.dataset.minimized,
          )
          .map((each) => each.dataset.windowId),
      );
  const front = (selector) => page.locator(`${selector}:not([style*="visibility: hidden"])`).last();
  const doc = (id) => page.locator(`[data-window-id="${id}"] [aria-label="Document"]`);
  const tabsOf = (selector) => front(selector).getByRole("tab").allTextContents();
  const windowWith = (text) =>
    page.waitForFunction(
      ({ selector, wanted }) =>
        [...document.querySelectorAll(selector)].some((each) => each.textContent.includes(wanted)),
      { selector: TEXTEDIT, wanted: text },
    );

  await openDesktop(page, base, step);
  // A run on one account starts as the first did, and leaves it so.
  const reset = async () => {
    const { json: was } = await api(page, "GET", SETTINGS);
    await api(page, "PUT", SETTINGS, {
      values: Object.fromEntries(
        Object.entries(was.values ?? {}).filter(
          ([key]) =>
            !/^(textedit\.(tabs|windows?|reopen|frames)|scriptEditor\.(tabs|hiddenTools)|desktop\.(windows|quitWindows))/.test(
              key,
            ),
        ),
      ),
      rev: was.rev,
    });
    await reloadDesktop(page, base);
  };
  await reset();
  await launch(page, "TextEdit");
  await doc("textedit").waitFor();
  await page.waitForTimeout(600);
  await doc("textedit").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Tab one");
  await menu("File", "New");
  await doc("textedit:2").waitFor();
  await page.waitForTimeout(400);
  await doc("textedit:2").click();
  await page.keyboard.type("Tab two");
  await page.waitForTimeout(1_300);

  // Merge All Windows.
  await menu("Window", "Merge All Windows");
  const merged = await stored("textedit.tabs", (value) => value?.groups?.length === 1);
  step(
    "Merge All Windows: the server holds one group of both windows",
    merged?.groups?.[0]?.ids?.join() === "textedit,textedit:2" &&
      merged.groups[0].selected === "textedit:2",
    JSON.stringify(merged),
  );
  step(
    "only the selected tab shows",
    (await shown(TEXTEDIT)).join() === "textedit:2",
    (await shown(TEXTEDIT)).join(),
  );
  step("the bar has a tab for each", (await tabsOf(TEXTEDIT)).length === 2);
  await page.screenshot({ path: `${out}/textedit-tabs.png` });

  // Show Next Tab, and the keyboard goes with it.
  await menu("Window", "Show Next Tab");
  step("Show Next Tab shows the other", (await shown(TEXTEDIT)).join() === "textedit");
  await page.keyboard.press("End");
  await page.keyboard.type(" more");
  step(
    "typing goes into the tab in front",
    (await doc("textedit").textContent())?.includes("Tab one more"),
    await doc("textedit").textContent(),
  );
  await menu("Window", "Show Previous Tab");
  step("Show Previous Tab goes back", (await shown(TEXTEDIT)).join() === "textedit:2");

  // The frame is shared.
  const frames = () =>
    page.locator(TEXTEDIT).evaluateAll((all) =>
      all.map((each) => {
        const { left, top } = each.getBoundingClientRect();
        return `${Math.round(left)},${Math.round(top)}`;
      }),
    );
  const box = await front(TEXTEDIT).locator(".mac-title-bar").first().boundingBox();
  await page.mouse.move(box.x + 40, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await frames();
  step("a tab moved takes the others with it", new Set(after).size === 1, after.join(" "));

  // Across a reload.
  await menu("Window", "Show Next Tab");
  await stored("textedit.tabs", (value) => value?.groups?.[0]?.selected === "textedit");
  await page.waitForTimeout(1_300);
  await reloadDesktop(page, base);
  await doc("textedit").waitFor({ state: "attached" });
  await page.waitForTimeout(1_500);
  step(
    "after a reload the same tab is in front, of two",
    (await shown(TEXTEDIT)).join() === "textedit" && (await tabsOf(TEXTEDIT)).length === 2,
    (await shown(TEXTEDIT)).join(),
  );
  step(
    "each tab has its text after a reload",
    (await doc("textedit").textContent())?.includes("Tab one more") &&
      (await doc("textedit:2").textContent())?.includes("Tab two"),
  );

  // A click on a tab, Show All Tabs.
  await front(TEXTEDIT).getByRole("tab").nth(1).click();
  await page.waitForTimeout(300);
  step("a click on a tab selects it", (await shown(TEXTEDIT)).join() === "textedit:2");
  await menu("View", "Show All Tabs");
  const all = front(TEXTEDIT).getByRole("region", { name: "All Tabs" });
  await all.waitFor();
  const cards = all.getByRole("button");
  step(
    "Show All Tabs shows a picture of each tab with its text",
    (await cards.count()) === 2 &&
      (await all.locator(".mac-textedit-tabs-picture").first().textContent())?.includes("Tab one"),
  );
  await page.screenshot({ path: `${out}/textedit-all-tabs.png` });
  await cards.first().click();
  await page.waitForTimeout(300);
  step("choosing a picture selects that tab", (await shown(TEXTEDIT)).join() === "textedit");

  // The new-tab button, Move Tab to New Window.
  await front(TEXTEDIT)
    .getByRole("button", { name: /new tab/i })
    .click();
  await doc("textedit:3").waitFor({ state: "attached" });
  await page.waitForTimeout(400);
  step(
    "the + button makes a third tab, in front",
    (await shown(TEXTEDIT)).join() === "textedit:3" && (await tabsOf(TEXTEDIT)).length === 3,
    (await shown(TEXTEDIT)).join(),
  );
  await menu("Window", "Move Tab to New Window");
  const moved = await stored("textedit.tabs", (value) => value?.groups?.[0]?.ids?.length === 2);
  step(
    "Move Tab to New Window leaves it a window of its own beside the two tabs",
    !moved.groups[0].ids.includes("textedit:3") && (await shown(TEXTEDIT)).length === 2,
    (await shown(TEXTEDIT)).join(),
  );

  // A frame kept with a file.
  await doc("textedit:3").click();
  await page.keyboard.type("Framed");
  const name = `framed-${stamp}`;
  await menu("File", "Save…");
  const sheet = page.getByRole("dialog", { name: "Save" });
  const field = sheet.getByRole("textbox", { name: "Save As:" });
  await field.click({ clickCount: 3 });
  await page.keyboard.type(name);
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await sheet.waitFor({ state: "hidden" });
  await page.waitForTimeout(500);
  const barBox = await page
    .locator('[data-window-id="textedit:3"]')
    .locator(".mac-title-bar")
    .first()
    .boundingBox();
  await page.mouse.move(barBox.x + 100, barBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(barBox.x + 240, barBox.y + 120, { steps: 6 });
  await page.mouse.up();
  const keptFrames = await stored("textedit.frames", (value) => value?.length > 0);
  const kept = keptFrames?.at(-1);
  step("the server keeps the frame with the file", Number.isFinite(kept?.x), JSON.stringify(kept));
  await page.keyboard.press("Control+w");
  await page.waitForTimeout(500);

  // Spotlight opens the saved document, at its frame.
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  await page.getByRole("combobox", { name: "Spotlight Search" }).fill(name);
  await page
    .getByRole("option", { name: new RegExp(`${name}\\.rtf`) })
    .first()
    .click();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: `${out}/textedit-spotlight-open.png` });
  await windowWith("Framed");
  await page.waitForTimeout(600);
  const opened = await page.locator(TEXTEDIT).evaluateAll((list, text) => {
    const window = list.find((each) => each.textContent.includes(text));
    const { left, top } = window.getBoundingClientRect();
    return { left: Math.round(left), top: Math.round(top) };
  }, "Framed");
  step(
    "Spotlight opens the saved document where it was last shown",
    Math.abs(opened.left - kept.x) <= 1 && Math.abs(opened.top - kept.y) <= 30,
    `${JSON.stringify(opened)} kept ${kept.x},${kept.y}`,
  );

  // Quit: an untitled further window comes back with its text.
  await menu("File", "New");
  await page.waitForTimeout(600);
  const fresh = (await shown(TEXTEDIT)).at(-1);
  await doc(fresh).click();
  await page.keyboard.type("Kept across Quit");
  await page.waitForTimeout(1_300);
  await menu("TextEdit", "Quit TextEdit");
  await page.waitForFunction((selector) => !document.querySelector(selector), TEXTEDIT);
  const reopen = await stored("textedit.reopen", (value) => value?.length > 0);
  step(
    "Quit leaves the untitled document on the server",
    reopen?.length > 0,
    JSON.stringify(reopen),
  );
  await launch(page, "TextEdit");
  await windowWith("Kept across Quit");
  step("opening TextEdit again brings it back with its text", true);
  await page.waitForTimeout(1_300);
  await reloadDesktop(page, base);
  await windowWith("Kept across Quit");
  step("and it is there after a reload", true);
  await menu("TextEdit", "Quit TextEdit");
  await page.waitForFunction((selector) => !document.querySelector(selector), TEXTEDIT);

  // A link opens on a click.
  await launch(page, "TextEdit");
  await doc("textedit").waitFor();
  await page.waitForTimeout(800);
  // The further windows came back over it: a press raises the first.
  await page
    .locator('[data-window-id="textedit"]')
    .evaluate((shell) =>
      shell.firstElementChild.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
    );
  await page.waitForTimeout(300);
  await doc("textedit").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("linked");
  await page.keyboard.press("Control+A");
  await page.evaluate(
    (url) => document.execCommand("createLink", false, url),
    `${base}/ferrite-site.json`,
  );
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  await doc("textedit").locator("a").click();
  await page.locator('[data-window-id^="safari"]').first().waitFor();
  step("a click on a link opens it in Safari", true);
  await menu("Safari", "Quit Safari");

  // The ruler acts on the paragraph at the insertion point.
  await launch(page, "TextEdit");
  await doc("textedit").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second paragraph");
  await page.waitForTimeout(200);
  const head = page.locator('[data-window-id="textedit"]').getByRole("slider", { name: /head/i });
  await head.focus();
  for (let at = 0; at < 4; at += 1) await page.keyboard.press("ArrowRight");
  const margins = () =>
    doc("textedit").evaluate((node) =>
      [...node.children].map((each) => getComputedStyle(each).marginLeft),
    );
  const marginsMoved = await margins();
  step(
    "the ruler's head indent moves the selected paragraph, not the one before",
    marginsMoved.at(-1) !== "0px" && marginsMoved[0] === "0px",
    marginsMoved.join(),
  );
  await page.waitForTimeout(1_500);
  // The first window took a document of its own when others stayed, so it keeps it among the values.
  let holdsIndent = false;
  for (let at = 0; at < 24 && !holdsIndent; at += 1) {
    const ownDraft = await api(page, "GET", "/api/textedit/draft");
    // Chromium writes the two sides as the shorthand.
    holdsIndent = JSON.stringify([ownDraft.json, await values()]).includes("margin-inline");
    if (!holdsIndent) await page.waitForTimeout(500);
  }
  step("the server holds the paragraph's own indent", holdsIndent);
  await reloadDesktop(page, base);
  await doc("textedit").waitFor();
  await page.waitForTimeout(1_200);
  const reloaded = await margins();
  step(
    "the paragraph keeps it after a reload",
    reloaded.join() === marginsMoved.join(),
    reloaded.join(),
  );
  await page.screenshot({ path: `${out}/textedit-paragraph-ruler.png` });

  // Script Editor.
  const library = await api(page, "GET", "/api/app-store/library");
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json?.installed ?? []), "script-editor"])],
    rev: library.json?.rev ?? 0,
  });
  await reloadDesktop(page, base);
  await launch(page, "Script Editor");
  await page.getByRole("textbox", { name: "Script" }).first().waitFor();
  await page.waitForTimeout(800);

  await menu("View", "Customize Toolbar…");
  const customize = page.getByRole("dialog", { name: "Choose the items the toolbar shows" });
  await customize.getByRole("checkbox", { name: "Record" }).click();
  await customize.getByRole("button", { name: "Done" }).click();
  const hidden = await stored("scriptEditor.hiddenTools", (value) => value?.includes("record"));
  step("Customize Toolbar: the server holds what was taken out", hidden?.join() === "record");
  await reloadDesktop(page, base);
  await page.getByRole("textbox", { name: "Script" }).first().waitFor();
  await page.waitForTimeout(800);
  const toolbar = page.locator(SCRIPTS).first().getByRole("toolbar", { name: "Toolbar" });
  step(
    "the toolbar stays without it after a reload",
    (await toolbar.getByRole("button", { name: "Record" }).count()) === 0 &&
      (await toolbar.getByRole("button", { name: "Run" }).count()) === 1,
  );

  // Services on the script's selection.
  const script = page.locator(SCRIPTS).first().getByRole("textbox", { name: "Script" });
  await script.click();
  await page.keyboard.press("Control+A");
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Script Editor", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Services", exact: true }).hover();
  await page
    .getByRole("menuitem", { name: /New Note|Look Up/ })
    .first()
    .waitFor();
  step("Services offers its services on the script's selected text", true);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // A file a script writes is in the bundle's Open panel at once.
  const resource = `written-${stamp}.txt`;
  await script.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(
    `await Files.write({ path: "Documents/${resource}", text: "held" }); return "written";`,
  );
  await toolbar.getByRole("button", { name: "Run" }).click();
  await page.locator(SCRIPTS).first().getByText("written").last().waitFor();
  await toolbar.getByRole("button", { name: "Bundle contents" }).click();
  await page
    .locator(SCRIPTS)
    .first()
    .locator(".mac-script-editor-bundle-buttons")
    .first()
    .getByRole("button")
    .first()
    .click();
  await page.getByText(resource).first().waitFor();
  step("a file the script wrote is listed in the bundle's Open panel without a reload", true);
  await page.getByRole("button", { name: "Cancel" }).click();

  // Tabs.
  await menu("File", "New");
  await page.waitForTimeout(800);
  await menu("Window", "Merge All Windows");
  const scriptTabs = await stored("scriptEditor.tabs", (value) => value?.groups?.length === 1);
  step(
    "Script Editor's Merge All Windows: one group on the server, one window showing",
    scriptTabs?.groups?.[0]?.ids?.length === 2 && (await shown(SCRIPTS)).length === 1,
    JSON.stringify(scriptTabs),
  );
  await page.waitForTimeout(600);
  await reloadDesktop(page, base);
  await page.getByRole("tab").first().waitFor();
  await page.waitForTimeout(800);
  step(
    "Script Editor's tabs after a reload",
    (await shown(SCRIPTS)).length === 1 && (await tabsOf(SCRIPTS)).length === 2,
  );
  await menu("View", "Show All Tabs");
  await page.getByRole("region", { name: "All Tabs" }).waitFor();
  step("Script Editor's Show All Tabs", true);
  await page.keyboard.press("Escape");
  await reset();
});
