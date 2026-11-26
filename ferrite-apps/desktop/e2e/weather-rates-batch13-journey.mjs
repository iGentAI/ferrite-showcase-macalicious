#!/usr/bin/env node
// Weather and exchange rates, as a Mac has them, read through the server from their real sources and shown: the European
// Central Bank's daily file in Calculator's Convert menu and Spotlight; Open-Meteo in Today's Weather widget, Maps, Siri and
// Spotlight. Each number on screen is compared with the source read directly. The sources being down is a stand-in for
// the rates (the browser's route answers what the server answers: tests/weather_rates.rs holds the server to that);
// everything else is the running desktop under `ferrite dev --egress allow`.
//
//   node e2e/weather-rates-batch13-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("weather-rates-batch13");
const ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const FORECAST = "/api/weather/forecast";

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
const row = (page, item) =>
  page.getByRole("menu").last().getByRole("menuitem", { name: item }).first();
async function choose(page, title, ...items) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
  for (const [index, item] of items.entries()) {
    if (index < items.length - 1) {
      await row(page, item).hover();
      await page.waitForTimeout(350);
    } else await row(page, item).click();
  }
  await page.waitForTimeout(250);
}
async function pick(page, sheet, label, option) {
  await sheet.getByRole("combobox", { name: label }).click();
  await page.waitForTimeout(150);
  await page.getByRole("option", { name: option, exact: true }).click();
  await page.waitForTimeout(150);
}
const fahrenheit = (celsius) => `${Math.round((celsius * 9) / 5 + 32)}°`;
/** A source's hosts drop some connections from here: what is read directly is tried again. */
async function direct(url) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6_000) });
      if (response.ok) return response;
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 5) throw error;
    }
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);

  // The server's answers against the sources, read directly.
  const daily = await (await direct(ECB)).text();
  const bankDate = /time='([\d-]+)'/.exec(daily)?.[1];
  const bankUsd = Number(/currency='USD' rate='([\d.]+)'/.exec(daily)?.[1]);
  const rates = (await api(page, "GET", "/api/calculator/rates")).json;
  step(
    "The server reads the bank's own date and rate",
    rates.date === bankDate && rates.rates.USD === bankUsd && rates.rates.EUR === 1,
    `${rates.date} USD ${rates.rates.USD}, the bank's ${bankDate} ${bankUsd}`,
  );
  step(
    "and names its source",
    rates.source === "European Central Bank" && rates.source_url === ECB,
  );

  const paris = (await api(page, "GET", "/api/weather/places?q=Paris")).json.places[0];
  step(
    "The server finds a place by name",
    paris.name === "Paris" && paris.country === "France" && Math.round(paris.lat) === 49,
    JSON.stringify(paris),
  );
  const point = `?lat=${paris.lat}&lon=${paris.lon}`;
  const reachForecast = async () => (await api(page, "GET", FORECAST + point)).json;
  const first = await until(async () => {
    const read = await reachForecast();
    return read.temperature_c === undefined ? null : read;
  }, 40_000);
  const source = await (
    await direct(
      `https://api.open-meteo.com/v1/forecast?latitude=${first.lat}&longitude=${first.lon}&current=temperature_2m,weather_code&timezone=auto`,
    )
  ).json();
  step(
    "The server's reading is the source's",
    Math.abs(first.temperature_c - source.current.temperature_2m) <= 2 &&
      first.source === "Open-Meteo" &&
      first.timezone === "Europe/Paris" &&
      first.days.length === 5,
    `${first.temperature_c}°C ${first.condition} at ${first.observed}; the source's ${source.current.temperature_2m}°C`,
  );
  const second = (await api(page, "GET", FORECAST + point)).json;
  step(
    "A second read is the server's cache",
    second.cached === true && second.read_at === first.read_at,
    `read_at ${second.read_at}`,
  );
  const degrees = fahrenheit(first.temperature_c);

  // Calculator.
  await launch(page, "Calculator");
  const window = page.locator('.mac-calculator[aria-label="Calculator"]');
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const display = window.getByRole("status", { name: "Result" });
  const shown = async () => Number((await display.innerText()).trim().replaceAll(",", ""));
  const near = (value, wanted) => Math.abs(value - wanted) < 1e-6 * Math.abs(wanted);
  await window.click({ position: { x: 100, y: 30 } });
  await page.keyboard.type("100");
  await choose(page, "Convert", "Currency…");
  const sheet = page.getByRole("dialog");
  await sheet.waitFor({ timeout: 5_000 });
  const said = sheet.getByRole("status");
  step(
    "Currency's sheet says the rates' date and source",
    await until(async () => /Last updated: .*European Central Bank/.test(await said.innerText())),
    await said.innerText(),
  );
  await pick(page, sheet, "From", "US Dollar");
  await pick(page, sheet, "To", "Euro");
  await shot(page, path.join(out, "weather-rates-currency-sheet.png"));
  await sheet.getByRole("button", { name: "Convert", exact: true }).click();
  await page.waitForTimeout(300);
  step(
    "100 US Dollars convert at the bank's rate",
    near(await shown(), 100 / bankUsd),
    `${await shown()}, wanted ${100 / bankUsd}`,
  );
  await shot(page, path.join(out, "weather-rates-currency-result.png"));

  await page.keyboard.type("50");
  await choose(page, "Convert", "Recent Conversions", "Currency: US Dollar to Euro");
  step(
    "Recent Conversions repeats a currency without a sheet",
    await until(async () => near(await shown(), 50 / bankUsd)),
    String(await shown()),
  );

  await choose(page, "Convert", "Update Currency Exchange Rates…");
  const updated = page.getByRole("dialog");
  step(
    "Update Currency Exchange Rates says what came of it",
    (await until(async () => /up to date/.test(await updated.innerText()))) &&
      /European Central Bank/.test(await updated.innerText()),
    await updated.innerText(),
  );
  await shot(page, path.join(out, "weather-rates-update.png"));
  await updated.getByRole("button", { name: "OK", exact: true }).click();
  await updated.waitFor({ state: "hidden", timeout: 5_000 });
  await page.waitForTimeout(200);

  // The bank down, with no rates kept: the browser's route answers as the server does.
  await page.route("**/api/calculator/rates**", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "European Central Bank: the source did not answer in time" },
    }),
  );
  expectRefusal(502, "/api/calculator/rates");
  await choose(page, "Convert", "Currency…");
  await sheet.waitFor({ timeout: 5_000 });
  step(
    "With no rates the sheet says so and converts nothing",
    (await until(async () => /can’t be read/.test(await said.innerText()))) &&
      (await sheet.getByRole("button", { name: "Convert", exact: true }).isDisabled()),
    await said.innerText(),
  );
  await shot(page, path.join(out, "weather-rates-source-down.png"));
  await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
  await sheet.waitFor({ state: "hidden", timeout: 5_000 });
  await page.unroute("**/api/calculator/rates**");
  await page.waitForTimeout(200);

  // Siri, before any place is chosen and with no permission to know where this is.
  const field = page.getByRole("textbox", { name: "Type to Siri" });
  const ask = async (text) => {
    if ((await field.count()) === 0) {
      await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
      await field.waitFor({ timeout: 8_000 });
    }
    await field.fill(text);
    await field.press("Enter");
    await until(
      async () =>
        (await page.locator("[data-answer]").count()) > 0 &&
        (await page.getByText(`“${text}”`).count()) > 0,
    );
    return (await page.locator("[data-answer]").last().innerText()).trim();
  };
  const closeSiri = () =>
    page.locator(".mac-desktop-shell-siri").getByRole("button", { name: "Close" }).first().click();
  const nowhere = await ask("weather");
  step("Siri asks where rather than guess", /I don’t know where you are/.test(nowhere), nowhere);
  const inParis = await ask("What's the weather in Paris?");
  step(
    "Siri says the weather of a place named, from the server",
    inParis.includes(`Right now in Paris it’s ${degrees}`),
    inParis,
  );
  const detail = await page.locator(".mac-desktop-shell-siri-detail").last().innerText();
  step(
    "and its card says the source and the time",
    /Open-Meteo, as of .* local time/.test(detail),
    detail,
  );
  await shot(page, path.join(out, "weather-rates-siri.png"));
  await closeSiri();

  // Today's Weather widget.
  await page.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
  const panel = page.getByRole("complementary", { name: "Notification Center" });
  await panel.waitFor({ timeout: 8_000 });
  await page.getByRole("tab", { name: "Today" }).click();
  const button = (name) => panel.getByRole("button", { name, exact: true });
  step(
    "Today's Weather widget starts by asking for a place",
    await until(async () => /Choose a place to see its weather/.test(await panel.innerText())),
  );
  await button("Choose Places…").click();
  const find = panel.getByRole("textbox", { name: "Find a place" });
  await find.fill("Paris");
  await find.press("Enter");
  await panel.getByRole("button", { name: "Add Paris" }).first().waitFor({ timeout: 8_000 });
  await panel.getByRole("button", { name: "Add Paris" }).first().click();
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values ?? {};
  step(
    "The place chosen is kept on the server",
    await until(async () => (await stored())["weather.places"]?.[0]?.name === "Paris"),
  );
  const paint = panel.locator(".mac-desktop-shell-today-weather > li").first();
  const parisShown = await until(async () => {
    const text = await paint.innerText();
    return /Open-Meteo, as of/.test(text) ? text : "";
  });
  step(
    "The widget shows the server's reading with its source and time",
    parisShown.includes("Paris") &&
      parisShown.includes(degrees) &&
      parisShown.includes(first.condition),
    parisShown.replaceAll("\n", " | "),
  );

  const forecastsAsked = [];
  page.on("request", (request) => {
    if (request.url().includes(`${FORECAST}?`)) forecastsAsked.push(request.url());
  });
  await page.context().grantPermissions(["geolocation"]);
  await button("Use My Location").click();
  const noPosition = /Your location (is not available|could not be found)/;
  const refused = await until(async () => noPosition.exec(await panel.innerText())?.[0], 20_000);
  step(
    "With no position from the browser the widget says so",
    Boolean(refused) && (await button("Use My Location").isVisible()),
    refused,
  );
  step(
    "and asks the server for no forecast without a position",
    !forecastsAsked.some((url) => /lat=(NaN|undefined|null)|lon=(NaN|undefined|null)/.test(url)),
    `${forecastsAsked.length} forecast requests`,
  );

  // Playwright's WebKit answers from the NaN position it last gave for as long as maximumAge allows, across reloads too.
  await page.context().setGeolocation({ latitude: 59.91, longitude: 10.75 });
  await page.evaluate(() =>
    new Promise((done) =>
      navigator.geolocation.getCurrentPosition(done, done, { maximumAge: 0, timeout: 10_000 }),
    ).then(() => {}),
  );
  await button("Use My Location").click();
  const places = panel.locator(".mac-desktop-shell-today-weather > li");
  const here = await until(async () => {
    const text = await places.first().innerText();
    if (text.startsWith("My Location") && /isn’t available/.test(text)) {
      await places.first().getByRole("button", { name: "Try Again" }).click();
    }
    return text.startsWith("My Location") && /Open-Meteo, as of/.test(text) ? text : "";
  }, 30_000);
  step(
    "Once the browser may say where it is, the widget reads there",
    Boolean(here),
    here.replaceAll("\n", " | "),
  );
  await button("Done").click();
  await shot(page, path.join(out, "weather-rates-today.png"));

  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
  await panel.waitFor({ timeout: 8_000 });
  await page.getByRole("tab", { name: "Today" }).click();
  step(
    "Both are there after a reload",
    await until(async () => {
      const text = (await places.allInnerTexts()).join(" ");
      return text.includes("My Location") && text.includes("Paris") && text.includes(degrees);
    }),
  );
  await page.keyboard.press("Escape");

  const chosen = await ask("weather");
  step("Siri now answers for the person's place", chosen.includes("Right now in Paris"), chosen);
  await closeSiri();

  // Spotlight.
  await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  const search = page.getByRole("combobox", { name: "Spotlight Search" });
  await search.waitFor({ timeout: 8_000 });
  const group = (name) => page.getByRole("group", { name, exact: true });
  const preview = page.locator(".mac-desktop-shell-spotlight-preview");
  await search.fill("100 usd to eur");
  const wanted = `= ${(100 / bankUsd).toFixed(2)} Euros`;
  step(
    "Spotlight converts a currency at the bank's rate",
    await until(async () => (await group("Conversion").getByText(wanted).count()) === 1),
    wanted,
  );
  step(
    "with the rates' date and source in its preview",
    await until(async () =>
      /Last updated: .*European Central Bank/.test(await preview.innerText()),
    ),
    await preview.innerText(),
  );
  await shot(page, path.join(out, "weather-rates-spotlight-currency.png"));

  await search.fill("weather in Paris");
  await group("Weather").waitFor({ timeout: 8_000 });
  step(
    "Spotlight suggests the weather of a place",
    (await group("Weather").innerText()).includes(`Paris ${degrees}, ${first.condition}`),
    await group("Weather").innerText(),
  );
  const reading = await until(async () => {
    const text = (await preview.count()) > 0 ? await preview.innerText() : "";
    return /Open-Meteo, as of/.test(text) ? text : "";
  }, 6_000);
  step(
    "its preview says the source and the time",
    Boolean(reading),
    reading.replaceAll("\n", " | "),
  );
  await shot(page, path.join(out, "weather-rates-spotlight-weather.png"));
  const plateReads = [];
  page.on("response", async (response) => {
    if (response.url().includes(`${FORECAST}?`) && response.status() === 200) {
      plateReads.push(await response.json().catch(() => ({})));
    }
  });
  await search.press("Enter");

  // Maps: Return opened it on the place.
  const maps = page.locator('[data-window-id="maps"]');
  await maps.waitFor({ timeout: 10_000 });
  const plate = maps.getByRole("img", { name: /^Weather:/ });
  const atParis = await until(async () => {
    const read = plateReads.findLast((each) => Math.round(each.lat ?? 0) === 49);
    return read &&
      (await plate.count()) === 1 &&
      (await plate.innerText()).trim() === fahrenheit(read.temperature_c)
      ? await plate.getAttribute("title")
      : "";
  }, 25_000);
  step(
    "Return shows the place in Maps, and its plate reads the temperature there",
    Boolean(atParis),
    atParis,
  );
  const title = await plate.getAttribute("title");
  step(
    "with its condition, source and time in the tooltip",
    /^-?\d+°, .+\. Open-Meteo, as of .* local time\.$/.test(title ?? ""),
    title,
  );
  await shot(page, path.join(out, "weather-rates-maps.png"));

  // Language & Region's temperature.
  await launch(page, "System Preferences");
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await prefs.getByRole("button", { name: "Language & Region", exact: true }).first().click();
  await prefs.getByRole("combobox", { name: "Temperature:" }).click();
  await page.getByRole("option", { name: "°C — Celsius", exact: true }).click();
  await page.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
  await panel.waitFor({ timeout: 8_000 });
  await page.getByRole("tab", { name: "Today" }).click();
  const celsius = `${Math.round(first.temperature_c)}°`;
  step(
    "Choosing Celsius in Language & Region turns the widget to Celsius",
    await until(async () => (await places.allInnerTexts()).join(" ").includes(`Paris\n${celsius}`)),
    celsius,
  );
  await shot(page, path.join(out, "weather-rates-today-celsius.png"));
  await page.keyboard.press("Escape");
});
