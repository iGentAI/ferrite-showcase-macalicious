#!/usr/bin/env node
// Audio messages and a pasted picture in Messages on Ferrite, in a real browser against the running app: a recording
// from Chromium's fake microphone is stopped, can be thrown away or sent, and the other person plays it; a picture
// on the clipboard pasted into the field goes as an attachment. Exits 0 only when every step passed and no page logged
// a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/messages-audio-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-audio");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mauchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `maumartin-${id}`, fullName: `Martin ${id}`, password };

const seen = (check) => within(15_000, check).then((took) => took !== null);
const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const transcript = (page) => messagesOf(page).getByRole("log").first();
const rowOf = (page, name) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: name })
    .first();
const attachments = (page) => transcript(page).getByRole("list", { name: "Attachments" });
const record = async (page) => {
  await messagesOf(page).getByRole("button", { name: "Record audio" }).click();
  const stop = messagesOf(page).getByRole("button", { name: "Stop recording" });
  await stop.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  await stop.click();
  return messagesOf(page).getByRole("group", { name: "Audio message" });
};

await run(
  {
    chromium: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  {},
  async ({ person }) => {
    const b = await person("martin", martin);
    const a = await person("chris", chris);
    await openFromDock(b, "Messages");
    await openFromDock(a, "Messages");
    await messagesOf(a).getByRole("button", { name: "Compose new message" }).click();
    await messagesOf(a).getByRole("textbox", { name: "To" }).fill(martin.name);
    const field = messagesOf(a).getByRole("textbox", { name: "Message" });
    await field.fill(`hello ${id}`);
    await field.press("Enter");
    await within(20_000, () => rowOf(a, martin.fullName).isVisible());

    const first = await record(a);
    step("Stop holds the recording, to hear first", await seen(() => first.isVisible()));
    await first.getByRole("button", { name: "Cancel" }).click();
    step(
      "Cancel throws it away and nothing goes",
      (await messagesOf(a).getByRole("button", { name: "Record audio" }).isVisible()) &&
        (await attachments(a).count()) === 0,
    );

    const second = await record(a);
    await second.waitFor({ timeout: 10_000 });
    await shot(a, "messages-audio-held");
    await second.getByRole("button", { name: "Send" }).click();
    step(
      "Send puts the recording in the transcript",
      await seen(() =>
        attachments(a)
          .getByRole("listitem")
          .filter({ hasText: "Audio Message" })
          .first()
          .isVisible(),
      ),
    );

    await within(20_000, async () => {
      const row = rowOf(b, chris.fullName);
      if (await row.isVisible()) await row.click();
      return transcript(b).getByText(`hello ${id}`).first().isVisible();
    });
    const player = transcript(b).locator("audio").first();
    await player.waitFor({ timeout: 15_000 });
    step(
      "the other person can play it: it has a length",
      await seen(async () =>
        player.evaluate(
          (audio) =>
            new Promise((done) => {
              if (audio.readyState >= 1) done(true);
              else audio.addEventListener("loadedmetadata", () => done(true), { once: true });
              setTimeout(() => done(false), 5_000);
            }),
        ),
      ),
    );
    await player.evaluate((audio) => audio.play().then(() => audio.pause()));
    await shot(b, "messages-audio-received");

    // A picture on the clipboard.
    await a.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await a.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      canvas.getContext("2d").fillRect(0, 0, 32, 32);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    });
    await field.click();
    await a.keyboard.press("Control+v");
    step(
      "a picture pasted into the field goes as an attachment",
      await seen(async () => (await attachments(a).getByRole("img").count()) >= 1),
    );
    step("and leaves nothing in the field", (await field.inputValue()) === "");
    const pasted = () => attachments(b).getByRole("img").first();
    const loaded = () =>
      seen(async () =>
        pasted()
          .evaluate((img) => img.complete && img.naturalWidth === 32)
          .catch(() => false),
      );
    step("the other person gets the picture itself", await loaded());
    await b.reload({ waitUntil: "load" });
    await openFromDock(b, "Messages");
    await within(20_000, () => rowOf(b, chris.fullName).isVisible());
    await rowOf(b, chris.fullName).click();
    step("and still has it after a reload", await loaded());
  },
);
