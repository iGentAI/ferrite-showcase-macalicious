#!/usr/bin/env node
// Messages' File and Buddies commands on a conversation on Ferrite, in a real browser against the
// running app: Save Transcript downloads who said what, Print hands the browser the same, and Start
// FaceTime Video opens FaceTime and rings the other person. A headless browser shows no print dialog,
// so the page it was given is what is checked. Exits 0 only when every step passed and no page logged
// a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/messages-transcript-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                            [--browser chromium|chrome|firefox|webkit]

import { readFile } from "node:fs/promises";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-transcript");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mtchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mtmartin-${id}`, fullName: `Martin ${id}`, password };
const SAID = `said ${id}`;

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
}

await run({}, {}, async ({ person: open }) => {
  const other = await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(page, "Messages");
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  await field(page).fill(SAID);
  await field(page).press("Enter");
  await within(15_000, () => messagesOf(page).getByRole("log").getByText(SAID).first().isVisible());

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    menu(page, "File", /^Save Transcript/),
  ]);
  const saved = await readFile(await download.path(), "utf8");
  step(
    "Save Transcript downloads who said what, under the person's name",
    saved.includes(`Me:\n${SAID}`) && download.suggestedFilename() === `${martin.fullName}.txt`,
    download.suggestedFilename(),
  );

  await page.evaluate(() => {
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await menu(page, "File", /^Print/);
  let html = "";
  await within(10_000, async () => {
    html = (await page.evaluate(() => window.printedPage)) ?? "";
    return html !== "";
  });
  step("Print hands the browser the same transcript", html.includes(SAID));
  const sheet = await page.context().newPage();
  await sheet.setContent(html);
  await sheet.setViewportSize({ width: 816, height: 300 });
  await shot(sheet, "messages-transcript-page");
  await sheet.close();

  await menu(page, "Buddies", /^Start FaceTime Video/);
  const facetime = page.getByRole("region", { name: "FaceTime" }).first();
  step(
    "Start FaceTime Video opens FaceTime, and the call rings for that person on the server",
    (await within(20_000, async () => {
      if (!(await facetime.isVisible())) return false;
      if ((await facetime.getAttribute("data-call-state")) !== "calling") return false;
      const reply = await other.request.get(new URL("/api/facetime/calls", other.url()).href);
      const { incoming } = await reply.json();
      return (
        incoming?.state?.kind === "video" &&
        incoming.state.members.some((member) => member.name === chris.name)
      );
    })) !== null,
  );
  await shot(page, "messages-to-facetime");
});
