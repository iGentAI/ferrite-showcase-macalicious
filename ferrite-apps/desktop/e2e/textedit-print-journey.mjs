#!/usr/bin/env node
// Printing a rich TextEdit document on the desktop: the print frame lays the text out by the ruler,
// as the window does, and a tab stops where the ruler's marker stands.
//
//   node e2e/textedit-print-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { journey, launch, openDesktop, options } from "./app-journey.mjs";

const { base } = options();
const { step, run } = journey("textedit-print");
const stamp = Date.now().toString(36);

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await text.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(`Ruled ${stamp}`);

  const head = window.getByRole("slider", { name: "head indent" }).first();
  const first = window.getByRole("slider", { name: "first line indent" }).first();
  for (const slider of [head, first]) {
    await slider.focus();
    for (let at = 0; at < 4; at += 1) await page.keyboard.press("ArrowRight");
  }
  await page.waitForTimeout(300);
  const inWindow = await text.evaluate((node) => {
    const style = getComputedStyle(node.firstElementChild ?? node);
    return {
      margin: style.marginLeft,
      indent: style.textIndent,
      tab: getComputedStyle(node).tabSize,
    };
  });
  step("the ruler moved the window's text", inWindow.margin !== "0px", JSON.stringify(inWindow));

  const tabs = window.getByRole("slider", { name: /tab/i });
  const lefts = () =>
    tabs.evaluateAll((all) => all.map((each) => each.getBoundingClientRect().left));
  await text.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.evaluate(() => document.execCommand("insertText", false, "\n\tx\ty"));
  await page.waitForTimeout(200);
  /** Where the letters after the first two tabs stand against the first two tab markers. */
  const aligned = async () => {
    const [one, two] = await tabs.evaluateAll((all) =>
      all.slice(0, 2).map((each) => {
        const box = each.getBoundingClientRect();
        return box.left + box.width / 2;
      }),
    );
    const [x, y] = await text.evaluate((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const places = [];
      for (let at = walker.nextNode(); at; at = walker.nextNode()) {
        for (let offset = 0; offset < at.data.length; offset += 1) places.push([at, offset]);
      }
      const tab = places.findIndex(([at, offset]) => at.data[offset] === "\t");
      const left = (index) => {
        const [at, offset] = places[index];
        const range = document.createRange();
        range.setStart(at, offset);
        range.setEnd(at, offset + 1);
        return range.getBoundingClientRect().left;
      };
      return [left(tab + 1), left(tab + 3)];
    });
    return { off: [Math.abs(x - one), Math.abs(y - two)], one, two, x, y };
  };
  const near = ({ off }) => off.every((each) => each <= 3);
  let seen = await aligned();
  step("with a head indent, tabs stop under their markers", near(seen), JSON.stringify(seen));

  const before = await lefts();
  await tabs.nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  const markers = await lefts();
  step(
    "moving a tab marker moves that marker only",
    markers[1] > before[1] && markers[0] === before[0] && markers[2] === before[2],
    JSON.stringify([before.slice(0, 3), markers.slice(0, 3)]),
  );
  seen = await aligned();
  step("tabs still stop under their markers after moving one", near(seen), JSON.stringify(seen));

  for (const at of [1, 2, 4]) {
    for (const [key, more] of [
      ["ArrowRight", true],
      ["ArrowLeft", false],
    ]) {
      const was = (await lefts())[at];
      await tabs.nth(at).focus();
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
      const now = (await lefts())[at];
      step(
        `${key} on marker ${at + 1} moves it that way`,
        more ? now > was : now < was,
        `${was} to ${now}`,
      );
    }
  }
  seen = await aligned();
  const gap = seen.y - seen.x;

  const printed = page.evaluate(
    () =>
      new Promise((resolve) => {
        const real = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
        Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
          configurable: true,
          get() {
            const view = real.get.call(this);
            if (view && this.hasAttribute("data-textedit-print")) {
              view.print = () => {
                // The frame has no width until it is printed, and the letters need one to stand.
                this.style.width = "800px";
                const line = this.contentDocument.body.firstElementChild;
                const style = view.getComputedStyle(line);
                const walker = this.contentDocument.createTreeWalker(
                  this.contentDocument.body,
                  view.NodeFilter.SHOW_TEXT,
                );
                const places = [];
                for (let at = walker.nextNode(); at; at = walker.nextNode()) {
                  for (let offset = 0; offset < at.data.length; offset += 1) {
                    places.push([at, offset]);
                  }
                }
                const tab = places.findIndex(([at, offset]) => at.data[offset] === "\t");
                const left = (index) => {
                  const [at, offset] = places[index];
                  const range = this.contentDocument.createRange();
                  range.setStart(at, offset);
                  range.setEnd(at, offset + 1);
                  return range.getBoundingClientRect().left;
                };
                resolve({
                  text: line.textContent,
                  margin: style.marginLeft,
                  indent: style.textIndent,
                  gap: left(tab + 3) - left(tab + 1),
                });
              };
            }
            return view;
          },
        });
      }),
  );
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(300);
  await page
    .getByRole("menuitem", { name: /^Print/ })
    .last()
    .click();
  const sheet = page.getByRole("dialog", { name: /print/i });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Print", exact: true }).click();
  const frame = await printed;
  step("the print holds the text", frame.text.includes(stamp), frame.text);
  step(
    "the print has the window's indents",
    frame.margin === inWindow.margin && frame.indent === inWindow.indent,
    JSON.stringify(frame),
  );
  step(
    "the print keeps the stops as far apart as the window has them",
    Math.abs(frame.gap - gap) <= 3,
    `${frame.gap} and ${gap}`,
  );
});
