#!/usr/bin/env node
// What Siri does on the desktop itself: a web search in Safari, the time in a city, a Preferences
// pane, Do Not Disturb, a file found and opened from its card, and a contact's row in the server's
// answer opening that card.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/siri-more-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("siri-more");
const tag = Date.now().toString(36);
const FILE = `Marigold ${tag}.txt`;
const PERSON = `Zinnia${tag}`;
const FIRST_CARD = `siri-first-${tag}`;
const FOUND_CARD = `siri-found-${tag}`;

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const fileId = await uploadFile(page, {
    parent: "documents",
    name: FILE,
    type: "text/plain",
    text: "petals",
  });
  const cards = await api(page, "GET", "/api/contacts/cards");
  await api(page, "PUT", "/api/contacts/cards", {
    cards: [
      ...(cards.json.cards ?? []),
      { id: FIRST_CARD, account: "icloud", first: "Aaron", last: "Aardvark" },
      {
        id: FOUND_CARD,
        account: "icloud",
        first: PERSON,
        last: "Journey",
        emails: [{ label: "work", value: "zinnia@example.com" }],
      },
    ],
    rev: cards.json.rev,
  });
  try {
    await page.reload();
    await openDesktop(page, base, step);

    const siriButton = page.getByRole("menuitem", { name: "Siri", exact: true }).first();
    const field = page.getByRole("textbox", { name: "Type to Siri" });
    const answer = page.locator(".mac-siri-demo-reply[data-answer]");
    const openSiri = async () => {
      if (await field.isVisible().catch(() => false)) return;
      await siriButton.click();
      await field.waitFor({ timeout: 5_000 });
    };
    const ask = async (text) => {
      await openSiri();
      await field.fill(text);
      await field.press("Enter");
      await answer.waitFor({ timeout: 10_000 });
      return answer.innerText();
    };

    const zoned = await ask("what time is it in Tokyo");
    step("The time in a city", /^It’s \d+:\d\d [AP]M in Tokyo\.$/.test(zoned), zoned);

    await ask("turn on do not disturb");
    const dnd = await until(async () => {
      const { json } = await api(page, "GET", "/api/notification-center/inbox");
      return json?.dnd === true || json?.do_not_disturb === true;
    });
    step("Do Not Disturb turns on, on the server", dnd);
    await ask("turn off do not disturb");

    const found = await ask(`find files called ${FILE}`);
    step("Files are found by name", found === "I found 1 file.", found);
    await shot(page, path.join(out, `siri-file-card-${browserName}.png`));
    await page.getByRole("button", { name: FILE, exact: true }).click();
    step(
      "and its row opens the file",
      await page
        .locator('[data-window-id="textedit"]')
        .getByText(FILE, { exact: false })
        .first()
        .waitFor({ timeout: 10_000 })
        .then(
          () => true,
          () => false,
        ),
    );

    await ask(`find ${PERSON} in my contacts`).catch(() => undefined);
    const person = page.getByRole("button", { name: new RegExp(PERSON) });
    if (await person.count()) {
      await person.first().click();
      step(
        "A contact's row shows that card",
        await page
          .locator('[data-window-id="contacts"]')
          .getByText("zinnia@example.com")
          .first()
          .waitFor({ timeout: 10_000 })
          .then(
            () => true,
            () => false,
          ),
      );
    } else {
      step("A contact's row shows that card", false, await answer.innerText());
    }
    await shot(page, path.join(out, `siri-contact-${browserName}.png`));

    const pane = await ask("open dock preferences");
    step("A Preferences pane opens", pane === "Here are the Dock preferences.", pane);
    step(
      "in System Preferences",
      await page
        .locator('[data-window-id="system-preferences"]')
        .getByText("Size:", { exact: false })
        .first()
        .waitFor({ timeout: 10_000 })
        .then(
          () => true,
          () => false,
        ),
    );

    const web = await ask(`search the web for ${tag}`);
    step("A web search is answered", web.startsWith("Searching the web"), web);
    step(
      "and opens in Safari",
      await until(async () => {
        const { json } = await api(page, "GET", "/api/safari/tabs");
        return (json?.tabs ?? []).some((each) => each.includes(tag));
      }),
    );
  } finally {
    const left = await api(page, "GET", "/api/contacts/cards");
    await api(page, "PUT", "/api/contacts/cards", {
      cards: (left.json.cards ?? []).filter(
        (card) => card.id !== FIRST_CARD && card.id !== FOUND_CARD,
      ),
      rev: left.json.rev,
    });
    await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: fileId }] });
  }
});
