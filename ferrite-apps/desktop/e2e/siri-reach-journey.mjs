#!/usr/bin/env node
// More of what Siri reaches: the weather stated as unavailable, a place in Maps, a new message in Mail to a person in
// Contacts, Music's controls, a stock's quote, copying an answer, and earlier answers staying in the window.
//
//   node e2e/siri-reach-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("siri-reach");
const tag = Date.now().toString(36);
const ADDRESS = `zinnia-${tag}@example.com`;

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
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  const cards = await api(page, "GET", "/api/contacts/cards");
  await api(page, "PUT", "/api/contacts/cards", {
    cards: [
      ...(cards.json.cards ?? []),
      {
        id: `siri-${tag}`,
        account: "icloud",
        first: "Zinnia",
        last: `Elegans${tag}`,
        emails: [{ label: "work", value: ADDRESS }],
      },
    ],
    rev: cards.json.rev ?? 0,
  });

  const openSiri = async () => {
    if ((await page.getByRole("textbox", { name: "Type to Siri" }).count()) > 0) return;
    await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
    await page.getByRole("textbox", { name: "Type to Siri" }).waitFor({ timeout: 8_000 });
  };
  const ask = async (text) => {
    await openSiri();
    const field = page.getByRole("textbox", { name: "Type to Siri" });
    await field.fill(text);
    await field.press("Enter");
    await until(async () => {
      const reply = page.locator("[data-answer]");
      return (await reply.count()) > 0 && (await page.getByText(`“${text}”`).count()) > 0;
    });
    return (await page.locator("[data-answer]").innerText()).trim();
  };
  const windowOf = (app) => page.locator(`[data-window-id="${app}"]`);

  const weather = await ask("What's the weather in Paris?");
  step(
    "The weather is said from the server, for that place",
    /Right now in Paris it’s -?\d+°/.test(weather) || /isn’t available right now/.test(weather),
    weather,
  );

  const place = await ask("Where is Paris");
  step("A place is looked up in Maps", /Paris in Maps/.test(place), place);
  step("Maps opens on it", await until(async () => (await windowOf("maps").count()) === 1));

  await openSiri();
  const mail = await ask(`Email Zinnia Elegans${tag}`);
  step("Email finds the person in Contacts", /new message to Zinnia/.test(mail), mail);
  step(
    "and a new message opens addressed to them",
    await until(async () => (await page.getByText(ADDRESS).count()) > 0),
  );
  await shot(page, path.join(out, `siri-mail-${browserName}.png`));

  const nothing = await ask("pause the music");
  step("Music's controls say when it has nothing", /nothing to play/.test(nothing), nothing);
  step("and open it", await until(async () => (await windowOf("music").count()) === 1));

  const stock = await ask("How is AAPL stock doing?");
  step(
    "A stock answers with its quote, or says it could not get one",
    /AAPL is at \d|couldn’t get a quote for AAPL/.test(stock),
    stock,
  );

  await page.getByRole("button", { name: "Copy", exact: true }).click();
  step(
    "An answer can be copied",
    await until(async () => {
      const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
      return copied === stock;
    }),
  );

  await ask("weather");
  const earlier = await page.getByRole("list", { name: "Earlier answers" }).innerText();
  step(
    "Earlier answers stay in the window",
    /Where is Paris/.test(earlier) && /AAPL/.test(earlier),
    earlier.slice(0, 200),
  );
  await shot(page, path.join(out, `siri-earlier-${browserName}.png`));
});
