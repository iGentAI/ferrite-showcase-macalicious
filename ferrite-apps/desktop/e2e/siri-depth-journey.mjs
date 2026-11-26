#!/usr/bin/env node
// The rest of what Siri understands: a song by name, a route in Maps, a mail's subject, a company's stock,
// files by kind and date, follow-ups, Add to Today and a card with its figure.
//
// Stand-ins: the place and company searches and the quote are answered by the journey (`page.route`),
// since those go to services outside the app; the desktop's own route to Maps and Stocks is the real one.
//
//   node e2e/siri-depth-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("siri-depth");
const tag = Date.now().toString(36);
const ADDRESS = `iris-${tag}@example.com`;

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
  const cards = await api(page, "GET", "/api/contacts/cards");
  await api(page, "PUT", "/api/contacts/cards", {
    cards: [
      ...(cards.json.cards ?? []),
      {
        id: `siri-${tag}`,
        account: "icloud",
        first: "Iris",
        last: `Germanica${tag}`,
        emails: [{ label: "work", value: ADDRESS }],
      },
    ],
    rev: cards.json.rev ?? 0,
  });
  const PDF = `Siri plan ${tag}.pdf`;
  const NOTES = `Siri notes ${tag}.txt`;
  await uploadFile(page, { parent: "documents", name: NOTES, type: "text/plain", text: "notes" });
  await uploadFile(page, {
    parent: "documents",
    name: PDF,
    type: "application/pdf",
    text: [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
      "trailer<</Root 1 0 R>>",
      "%%EOF",
    ].join("\n"),
  });
  await page.route("**/api/maps/search?*", (route) =>
    route.fulfill({
      json: {
        places: [
          {
            id: "tower",
            name: "Eiffel Tower",
            category: "tourism",
            lat: 48.858,
            lon: 2.294,
            address: [],
          },
        ],
      },
    }),
  );
  await page.route("**/api/stocks/search?*", (route) =>
    route.fulfill({ json: { results: [{ symbol: "AAPL", name: "Apple Inc." }] } }),
  );
  await page.route("**/api/stocks/quotes?*", (route) =>
    route.fulfill({
      json: {
        quotes: route.request().url().includes("AAPL")
          ? [{ symbol: "AAPL", price: 187.2, change: 1.5 }]
          : [],
        missing: [],
      },
    }),
  );

  const field = page.getByRole("textbox", { name: "Type to Siri" });
  const openSiri = async () => {
    if ((await field.count()) > 0) return;
    await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
    await field.waitFor({ timeout: 8_000 });
  };
  const ask = async (text) => {
    await openSiri();
    await field.fill(text);
    await field.press("Enter");
    await until(async () => {
      const reply = page.locator("[data-answer]");
      return (await reply.count()) > 0 && (await page.getByText(`“${text}”`).count()) > 0;
    });
    return (await page.locator("[data-answer]").innerText()).trim();
  };

  const stock = await ask("How is Apple stock doing");
  step("A company's name finds its symbol and quote", /AAPL is at 187\.20/.test(stock), stock);
  step(
    "and the card leads with the figure",
    (await page.locator(".mac-desktop-shell-siri-lead").innerText()) === "187.20",
  );
  await shot(page, path.join(out, `siri-rich-card-${browserName}.png`));

  await page.getByRole("button", { name: "Add to Today" }).click();
  step(
    "Add to Today keeps it, on the server",
    await until(async () => {
      const pins = (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[
        "today.siriPins"
      ];
      return pins?.[0]?.asked === "How is Apple stock doing";
    }),
  );

  const time = await ask("What time is it in Paris");
  const other = await ask("what about Tokyo");
  step("A follow-up takes the request before it", /in Tokyo/.test(other), `${time} / ${other}`);
  const third = await ask("what about London");
  step("and one after it, what that one meant", /in London/.test(third), third);
  const changing = await ask("change it to 5");
  step("One it cannot act on says so", /can’t change that/.test(changing), changing);

  const yesterday = await ask("show me my pdfs from yesterday");
  step(
    "Files of another day are not among them",
    (await page.getByRole("button", { name: PDF }).count()) === 0,
    yesterday,
  );
  const pdfs = await ask("show me my pdfs from today");
  step("Files by kind and date", /I found \d+ PDF/.test(pdfs), pdfs);
  step(
    "listing the file, and no file of another kind",
    await until(
      async () =>
        (await page.getByRole("button", { name: PDF }).count()) === 1 &&
        (await page.getByRole("button", { name: NOTES }).count()) === 0,
    ),
  );
  await shot(page, path.join(out, `siri-files-${browserName}.png`));
  await field.fill("open it");
  await field.press("Enter");
  step(
    "“Open it” opens what the answer before listed",
    await until(async () => (await page.locator('[data-window-id^="preview"]').count()) > 0),
  );
  await page.waitForTimeout(2_000);
  const refused = page.getByRole("alertdialog");
  if ((await refused.count()) > 0) await refused.getByRole("button").first().click();

  const route = await ask("Directions to the Eiffel Tower");
  step("A route is asked of Maps", /directions to Eiffel Tower/.test(route), route);
  step(
    "which shows its Directions",
    await until(async () =>
      page
        .locator('[data-window-id="maps"]')
        .getByRole("complementary", { name: "Directions" })
        .isVisible()
        .catch(() => false),
    ),
  );

  // Today.
  await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
  await field.waitFor({ state: "detached", timeout: 4_000 }).catch(() => {});
  await page.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
  const panel = page.getByRole("complementary", { name: "Notification Center" });
  await panel.waitFor({ timeout: 8_000 });
  await page.getByRole("tab", { name: "Today" }).click();
  step(
    "Today shows what was added",
    await until(async () => (await panel.getByText(/AAPL is at 187\.20/).count()) === 1),
  );
  await shot(page, path.join(out, `siri-pin-${browserName}.png`));
  await panel.getByRole("button", { name: "Remove How is Apple stock doing" }).click();
  step(
    "and it can be removed",
    await until(async () => (await panel.getByText(/AAPL is at 187\.20/).count()) === 0),
  );
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached", timeout: 4_000 });

  const mail = await ask(`Email Iris Germanica${tag} about the garden`);
  step("Email takes a subject", /about the garden/.test(mail), mail);
  step(
    "and the new message has it",
    await until(async () =>
      page
        .getByRole("textbox", { name: /Subject/ })
        .last()
        .inputValue()
        .then((value) => value === "The garden")
        .catch(() => false),
    ),
  );
  await shot(page, path.join(out, `siri-mail-subject-${browserName}.png`));

  // The page's clock a day on: what was made today is now yesterday's.
  await page.clock.setFixedTime(Date.now() + 24 * 60 * 60 * 1_000);
  const dayLater = await ask("show me my pdfs from yesterday");
  const inAnswer = page
    .getByRole("button", { name: PDF })
    .and(page.locator(":not(.mac-desktop-shell-siri-earlier *)"));
  step(
    "A day later the file is among yesterday's",
    await until(async () => (await inAnswer.count()) === 1),
    dayLater,
  );
  const nextToday = await ask("show me my pdfs from today");
  step("and not among that day's", (await inAnswer.count()) === 0, nextToday);
});
