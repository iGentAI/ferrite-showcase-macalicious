#!/usr/bin/env node
// The rest of Home and Network Utility, Hey Siri, Dictation Command and a second keychain, with real input against `ferrite
// dev`. Each step names its row in features/home.md, network-utility.md, siri.md, automator.md or keychain-access.md.
//
// Stand-in: a headless browser has no microphone, so a stub replaces the browser's speech recognition and the journey hands it
// the words. Nothing was really heard: this proves what the desktop does with words a recognizer reports, and when it starts,
// stops and gives way to that recognizer, not recognition, a real microphone prompt or a real browser's speech service. Lookup
// asks the real resolvers, so the run needs the network.
//
//   node e2e/rows-batch17-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";
import { createAccount } from "./people-kit.mjs";

const { base, out } = options();
const tag = Date.now().toString(36);
const { step, run, expectRefusal } = journey("rows-batch17", { ignoreOtherOrigins: true });

async function row(id, label, body) {
  try {
    const result = await body();
    const [ok, detail] = Array.isArray(result) ? result : [result, ""];
    step(`${id}: ${label}`, Boolean(ok), detail);
  } catch (error) {
    const [first, , waiting] = String(error).split("\n");
    step(`${id}: ${label}`, false, `${first} ${waiting ?? ""}`.trim());
  }
}

const SPEECH_STUB = () => {
  const stub = { live: [], made: 0, results: [] };
  stub.heard = () => stub.live.filter((each) => each.running);
  stub.say = (words) => {
    const result = Object.assign([{ transcript: words }], { isFinal: true });
    for (const each of stub.heard()) each.onresult?.({ results: [result] });
  };
  stub.end = () => {
    for (const each of stub.heard()) each.finish();
  };
  stub.refuse = (error) => {
    for (const each of stub.heard()) {
      each.onerror?.({ error });
      each.finish();
    }
  };
  window.speechStub = stub;
  window.SpeechRecognition = class {
    running = false;
    ended = [];
    constructor() {
      stub.made += 1;
    }
    start() {
      this.running = true;
      stub.live.push(this);
    }
    stop() {
      if (this.running) this.finish();
    }
    finish() {
      this.running = false;
      stub.live = stub.live.filter((each) => each !== this);
      this.onend?.();
      for (const listener of this.ended) listener();
    }
    addEventListener(type, listener) {
      if (type === "end") this.ended.push(listener);
    }
  };
};

const say = (page, words) => page.evaluate((text) => window.speechStub.say(text), words);
const listening = (page) => page.evaluate(() => window.speechStub.heard().length);
const listeningContinuously = (page) =>
  page.evaluate(() => window.speechStub.heard().map((each) => each.continuous === true));

const homes = async (page) => (await api(page, "GET", "/api/home/homes")).json.homes;
const saved = (page, check) =>
  until(async () => {
    const now = await homes(page);
    return Boolean(now && check(now));
  }, 8_000);
const named = (all, name) => all[0].accessories.find((one) => one.name === name);

const dockButton = (page, name) =>
  page.locator(".mac-desktop-shell-dock, nav").getByRole("button", { name, exact: true }).first();

async function openFromDock(page, name, id) {
  await dockButton(page, name).click();
  const shell = page.locator(`[data-window-id="${id}"]`);
  await shell.waitFor({ timeout: 15_000 });
  return shell;
}

async function inSheet(page, { name, choices = {}, press }) {
  const sheet = page.getByRole("dialog").last();
  await sheet.waitFor({ timeout: 5_000 });
  if (name !== undefined) await sheet.getByRole("textbox", { name: "Name:" }).fill(name);
  for (const [label, option] of Object.entries(choices)) {
    await sheet.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  if (press) {
    await sheet.getByRole("button", { name: press, exact: true }).click();
    await page
      .waitForTimeout(350)
      .then(() => sheet.waitFor({ state: "hidden", timeout: 4_000 }).catch(() => {}));
  }
  return sheet;
}

/** A step's words typed into Siri, whose answer is read back. */
async function askTyped(page, words) {
  const siri = page.locator(".mac-desktop-shell-siri");
  if (!(await siri.isVisible())) await dockButton(page, "Siri").click();
  const field = siri.getByRole("textbox", { name: "Type to Siri" });
  await field.fill(words);
  await field.press("Enter");
}

const closeSiri = async (page) => {
  await page.locator(".mac-desktop-shell-siri").getByRole("button", { name: /close/i }).click();
  await page.locator(".mac-desktop-shell-siri").waitFor({ state: "hidden", timeout: 4_000 });
};

async function homeRows(page) {
  const home = await openFromDock(page, "Home", "home");
  const tile = (name) => home.locator("[data-home-accessory]").filter({ hasText: name }).first();
  await home.getByText("No Accessories").waitFor({ timeout: 10_000 });
  const addAccessory = async (name, choices) => {
    await chooseMenu(page, "File", "Add Accessory…");
    await inSheet(page, { name, choices, press: "Add" });
    await saved(page, (all) => Boolean(named(all, name)));
  };
  await addAccessory("Lamp", {});
  await addAccessory("Desk", {});
  await addAccessory("Shade", { "Kind:": "Blinds" });
  await chooseMenu(page, "File", "New Room…");
  await inSheet(page, { name: "Study", press: "Add" });
  await saved(page, (all) => all[0].rooms.includes("Study"));
  await page.keyboard.press("ControlOrMeta+1");

  await row("home.38.color", "a light's colour, kept and tinting its tile while on", async () => {
    await tile("Lamp").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Accessory Settings…" }).click();
    const sheet = await inSheet(page, {});
    await sheet.locator('input[type="color"]').fill("#ff0000");
    await sheet.getByRole("button", { name: "Done", exact: true }).click();
    const kept = await saved(page, (all) => named(all, "Lamp").color === "#ff0000");
    await tile("Lamp").click();
    await saved(page, (all) => named(all, "Lamp").on === true);
    await shot(page, path.join(out, "home-color.png"));
    return [kept, "read back"];
  });
  await row("home.38.position", "blinds' position, kept and said on the tile", async () => {
    await tile("Shade").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Accessory Settings…" }).click();
    const sheet = await inSheet(page, {});
    await sheet.getByRole("slider").focus();
    for (let at = 0; at < 3; at += 1) await page.keyboard.press("ArrowRight");
    await sheet.getByRole("button", { name: "Done", exact: true }).click();
    const kept = await saved(
      page,
      (all) => named(all, "Shade").position === 3 && named(all, "Shade").on === true,
    );
    await tile("Shade").getByText("3% Open").waitFor({ timeout: 3_000 });
    return kept;
  });

  await row("home.58.select", "Command-click chooses tiles and switches none", async () => {
    await tile("Lamp").click();
    await saved(page, (all) => named(all, "Lamp").on === false);
    await tile("Lamp").click({ modifiers: ["ControlOrMeta"] });
    await tile("Desk").click({ modifiers: ["ControlOrMeta"] });
    const chosen = await home.locator("[data-home-selected]").count();
    await shot(page, path.join(out, "home-selected.png"));
    const all = await homes(page);
    return [chosen === 2 && !named(all, "Lamp").on && !named(all, "Desk").on, `${chosen} chosen`];
  });
  await row("home.58.switch", "the tile menu switches the selection together", async () => {
    await tile("Desk").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Turn On 2 Accessories" }).click();
    return saved(page, (all) => named(all, "Lamp").on && named(all, "Desk").on);
  });
  await row("home.58.move", "Move to Room moves the selection together", async () => {
    await tile("Desk").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Move to Room" }).click();
    await page.getByRole("menuitem", { name: "Study", exact: true }).click();
    return saved(
      page,
      (all) => named(all, "Lamp").room === "Study" && named(all, "Desk").room === "Study",
    );
  });
  await row(
    "home.58.clear",
    "a plain click on a tile ends the selection and switches it",
    async () => {
      await tile("Lamp").click();
      const kept = await home.locator("[data-home-selected]").count();
      return [
        kept === 0 && (await saved(page, (all) => named(all, "Lamp").on === false)),
        `${kept} left`,
      ];
    },
  );
  await row("home.58.drag", "dragging a chosen tile to a room takes the selection", async () => {
    await page.keyboard.press("ControlOrMeta+2");
    await home.getByRole("button", { name: "Study", exact: true }).click();
    await tile("Lamp").click({ modifiers: ["ControlOrMeta"] });
    await tile("Desk").click({ modifiers: ["ControlOrMeta"] });
    await tile("Lamp").dragTo(home.getByRole("button", { name: "Default Room", exact: true }));
    const ok = await saved(
      page,
      (all) =>
        named(all, "Lamp").room === "Default Room" && named(all, "Desk").room === "Default Room",
    );
    await page.keyboard.press("ControlOrMeta+1");
    return ok;
  });
  await row("home.58.remove", "Delete asks once and removes the selection", async () => {
    await addAccessory("Spare One", {});
    await addAccessory("Spare Two", {});
    await page.keyboard.press("ControlOrMeta+1");
    await tile("Spare One").click({ modifiers: ["ControlOrMeta"] });
    await tile("Spare Two").click({ modifiers: ["ControlOrMeta"] });
    await tile("Spare Two").focus();
    await page.keyboard.press("Delete");
    await inSheet(page, { press: "Remove" });
    return saved(page, (all) => !named(all, "Spare One") && !named(all, "Spare Two"));
  });

  await chooseMenu(page, "File", "Add Scene…");
  await inSheet(page, { name: `Evening ${tag}`, press: "Add" });
  await saved(page, (all) => all[0].scenes.length === 1);
  const SCENE = `Evening ${tag}`;

  await row("home.63.open", "Siri runs a scene while Home's window is open", async () => {
    await tile("Lamp").waitFor();
    await askTyped(page, `set the ${SCENE} scene`);
    const siri = page.locator(".mac-desktop-shell-siri");
    await siri.getByText("Its accessories are simulated").first().waitFor({ timeout: 8_000 });
    await shot(page, path.join(out, "home-siri.png"));
    const ok = await saved(page, (all) => named(all, "Lamp").on === true);
    await closeSiri(page);
    await tile("Lamp")
      .getByText(/On|\d+%/)
      .first()
      .waitFor({ timeout: 4_000 });
    return [ok, "on the server and on its tile"];
  });
  await row(
    "home.63.closed",
    "Siri runs a scene with Home's window closed, on its name alone",
    async () => {
      await tile("Lamp").click();
      await saved(page, (all) => named(all, "Lamp").on === false);
      await page.keyboard.press("ControlOrMeta+q");
      await home.waitFor({ state: "detached", timeout: 8_000 });
      await askTyped(page, SCENE);
      const ok = await saved(page, (all) => named(all, "Lamp").on === true);
      await closeSiri(page);
      return ok;
    },
  );
  await row("home.64", "Spotlight finds a scene, and Return shows it in Home", async () => {
    await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    const found = page.getByRole("option", { name: new RegExp(SCENE) }).first();
    for (let at = 0; at < 20 && !(await found.isVisible()); at += 1) {
      await field.fill("");
      await field.fill(SCENE);
      await page.waitForTimeout(500);
    }
    await shot(page, path.join(out, "home-spotlight.png"));
    await found.click();
    await field.press("Enter").catch(() => {});
    await page.locator('[data-window-id="home"]').waitFor({ timeout: 10_000 });
    const shown = await until(
      () => page.evaluate(() => Boolean(document.activeElement?.dataset?.homeScene)),
      6_000,
    );
    return [shown, "its tile has the keyboard"];
  });

  // The earlier run's report: Command-1 after the time automation did not change the tab. Each pass is a new time automation
  // that runs at once, its banner showing, with Command-1 pressed as soon as the window says it ran.
  await row(
    "home.53.after-time",
    "Command-1 changes the tab just after a time automation ran",
    async () => {
      const shell = page.locator('[data-window-id="home"]');
      for (let pass = 0; pass < 3; pass += 1) {
        // The sheet offers this minute, and a tick comes every 15 s: late in a minute it is missed.
        await until(async () => new Date().getSeconds() < 35, 30_000);
        await page.keyboard.press("ControlOrMeta+3");
        await shell.getByRole("button", { name: "Add", exact: true }).click();
        await page.getByRole("menuitem", { name: "Add Automation…" }).click();
        await inSheet(page, { name: `Now ${pass}`, press: "Done" });
        await saved(page, (all) => (all[0].automations ?? []).length === pass + 1);
        await shell
          .getByText(/Last ran/)
          .nth(pass)
          .waitFor({ timeout: 40_000 });
        await page.keyboard.press("ControlOrMeta+1");
        await shell.getByText("Favorite Accessories", { exact: true }).waitFor({ timeout: 1_500 });
      }
      return [true, "3 passes"];
    },
  );
  await page.keyboard.press("ControlOrMeta+q");
  await page.locator('[data-window-id="home"]').waitFor({ state: "detached", timeout: 8_000 });
}

async function networkRows(page) {
  const shell = await openFromDock(page, "Network Utility", "network-utility");
  await shell.getByRole("tab", { name: "Lookup", exact: true }).click();
  const field = shell.getByRole("tabpanel").getByRole("textbox").first();
  await row("net.server", "choosing the lookup server asks that server", async () => {
    await shell.getByRole("combobox", { name: "Server:" }).click();
    await page.getByRole("option", { name: "Google Public DNS" }).click();
    await field.fill("example.com");
    await field.press("Enter");
    await shell.getByText(/Server: dns\.google/).waitFor({ timeout: 25_000 });
    const google = await shell.getByRole("textbox", { name: "Lookup output" }).inputValue();
    await shot(page, path.join(out, "network-server.png"));
    await shell.getByRole("combobox", { name: "Server:" }).click();
    await page.getByRole("option", { name: "Cloudflare" }).click();
    await field.press("Enter");
    await shell.getByText(/Server: cloudflare-dns\.com/).waitFor({ timeout: 25_000 });
    return [
      /Server: dns\.google/.test(google) && /example\.com\.?\s+\d+\s+IN\s+A/.test(google),
      google.split("\n").slice(0, 8).join(" | ").slice(0, 180),
    ];
  });
  await row(
    "net.server.refused",
    "a server the application does not declare is refused",
    async () => {
      expectRefusal(400, "/api/network-utility/lookup");
      const reply = await api(
        page,
        "GET",
        "/api/network-utility/lookup?host=example.com&server=evil",
      );
      return [
        reply.status === 400 && /not a lookup server/.test(JSON.stringify(reply.json)),
        reply.status,
      ];
    },
  );
  await row(
    "net.hide",
    "Hide goes at once with no tile of its own, and its tile brings it back",
    async () => {
      await chooseMenu(page, "Network Utility", "Hide Network Utility");
      const gone = await until(
        () =>
          shell.evaluate(
            (each) =>
              each.hasAttribute("data-minimized") &&
              getComputedStyle(each.firstElementChild).visibility === "hidden",
          ),
        3_000,
      );
      const tiles = await page.getByRole("button", { name: /minimized window/ }).count();
      await dockButton(page, "Network Utility").click();
      const back = await until(
        () => shell.evaluate((each) => !each.hasAttribute("data-minimized")),
        4_000,
      );
      return [gone && tiles === 0 && back, `gone ${gone}, ${tiles} tiles, back ${back}`];
    },
  );
  await row("net.hide-others", "Hide Others hides Calculator and leaves this one", async () => {
    const other = await openFromDock(page, "Calculator", "calculator");
    await dockButton(page, "Network Utility").click();
    await page.waitForTimeout(400);
    await chooseMenu(page, "Network Utility", "Hide Others");
    const hid = await until(
      () => other.evaluate((each) => each.hasAttribute("data-minimized")),
      3_000,
    );
    const stays = await shell.evaluate((each) => !each.hasAttribute("data-minimized"));
    await chooseMenu(page, "Network Utility", "Show All");
    const again = await until(
      () => other.evaluate((each) => !each.hasAttribute("data-minimized")),
      3_000,
    );
    return [hid && stays && again, `hid ${hid}, stays ${stays}, shown ${again}`];
  });
  await row("net.help", "the Help menu's search field opens Help Viewer on the words", async () => {
    await dockButton(page, "Network Utility").click();
    await page.waitForTimeout(300);
    await page.getByRole("menubar").getByRole("menuitem", { name: "Help", exact: true }).click();
    const search = page.getByRole("menu").getByRole("searchbox", { name: "Search" });
    await search.fill("lookup");
    await search.press("Enter");
    const helper = page.locator('[data-window-id="help-viewer"]');
    await helper.waitFor({ timeout: 10_000 });
    const shown = await helper.isVisible();
    await page.keyboard.press("ControlOrMeta+q");
    await helper.waitFor({ state: "detached", timeout: 8_000 });
    await dockButton(page, "Network Utility").click();
    await page.waitForTimeout(300);
    await page.keyboard.press("ControlOrMeta+q");
    await shell.waitFor({ state: "detached", timeout: 8_000 });
    await dockButton(page, "Calculator").click();
    await page.waitForTimeout(300);
    await page.keyboard.press("ControlOrMeta+q");
    return shown;
  });
}

async function siriPane(page) {
  const opened = await page.locator('[data-window-id="system-preferences"]').count();
  if (!opened) await dockButton(page, "System Preferences").click();
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 10_000 });
  const siri = prefs.getByRole("button", { name: "Siri", exact: true }).first();
  if (await siri.isVisible().catch(() => false)) await siri.click();
  const box = prefs.getByRole("checkbox", { name: /Listen for .Hey Siri/ });
  await box.waitFor({ timeout: 8_000 });
  return box;
}

const heySiriOn = async (page) =>
  (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[
    "siri.listenForHeySiri"
  ];

async function heySiriRows(page) {
  await row("siri.29.off", "off by default: no recognizer is made as the page opens", async () => {
    const box = await siriPane(page);
    const made = await page.evaluate(() => window.speechStub.made);
    const off = !(await box.isChecked()) && (await box.isEnabled());
    return [off && made === 0, `${made} recognizers`];
  });
  await row("siri.29.on", "turned on in Siri's pane: the page listens, continuously", async () => {
    await (await siriPane(page)).click();
    const on = await until(async () => (await listening(page)) === 1, 4_000);
    const kept = await until(async () => (await heySiriOn(page)) === true, 6_000);
    await shot(page, path.join(out, "hey-siri-pane.png"));
    return [on && kept && (await listeningContinuously(page))[0], `listening ${on}, kept ${kept}`];
  });
  const siri = page.locator(".mac-desktop-shell-siri");
  await row("siri.29.other-words", "other words open nothing", async () => {
    await say(page, "what a lovely morning");
    await page.waitForTimeout(500);
    return !(await siri.isVisible());
  });
  await row("siri.29.phrase", "Hey Siri and a request opens Siri, which answers it", async () => {
    await say(page, "Hey Siri what is 6 times 7");
    await siri.waitFor({ timeout: 6_000 });
    await siri.getByText("42").first().waitFor({ timeout: 8_000 });
    await shot(page, path.join(out, "hey-siri-answer.png"));
    return true;
  });
  await row("siri.29.while-open", "said with Siri open, it goes to the same window", async () => {
    await say(page, "hey, Siri, what is 20 plus 3");
    await siri.getByText("23").first().waitFor({ timeout: 8_000 });
    return true;
  });
  await row(
    "siri.29.alone",
    "Hey Siri alone listens: the orb's recognizer takes over, then gives back",
    async () => {
      await closeSiri(page);
      await say(page, "Hey Siri");
      await siri.getByText("Listening…").waitFor({ timeout: 6_000 });
      const during = await listeningContinuously(page);
      await say(page, "what is 2 plus 40");
      await siri.getByText("42").first().waitFor({ timeout: 8_000 });
      await page.evaluate(() => window.speechStub.end());
      const back = await until(async () => {
        const now = await listeningContinuously(page);
        return now.length === 1 && now[0] === true;
      }, 4_000);
      await closeSiri(page);
      return [during.length === 1 && during[0] !== true && back, `during ${during}, back ${back}`];
    },
  );
  await row("siri.29.silence", "after silence ends the recognizer it starts again", async () => {
    await page.evaluate(() => window.speechStub.end());
    return until(async () => (await listening(page)) === 1, 3_000);
  });
  await row("siri.29.reload", "on after a reload, and listening without a press", async () => {
    await reloadDesktop(page);
    return until(async () => (await listening(page)) === 1, 15_000);
  });
  await row(
    "siri.29.refused",
    "refused by the browser: it goes off and the pane says why",
    async () => {
      await page.evaluate(() => window.speechStub.refuse("not-allowed"));
      const box = await siriPane(page);
      const off = await until(async () => (await heySiriOn(page)) === false, 6_000);
      const prefs = page.locator('[data-window-id="system-preferences"]');
      await prefs.getByText(/not allowed to use the microphone/).waitFor({ timeout: 4_000 });
      return [off && !(await box.isChecked()), `${await listening(page)} listening`];
    },
  );
  await row("siri.29.turned-off", "turned off in the pane: nothing listens", async () => {
    const box = await siriPane(page);
    await box.click();
    await until(async () => (await listening(page)) === 1, 3_000);
    await box.click();
    return until(async () => (await listening(page)) === 0, 3_000);
  });
  await page.keyboard.press("ControlOrMeta+q");
}

async function noRecognizer(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    });
    await page.goto(`${base}/`, { waitUntil: "load" });
    await createAccount(page, {
      name: `nosp${tag}`,
      fullName: "No Speech",
      password: `pw-${tag}-n`,
    });
    await reloadDesktop(page);
    await row(
      "siri.29.none",
      "where the browser has none the checkbox is dimmed with its reason",
      async () => {
        const box = await siriPane(page);
        const title = await box
          .locator("xpath=ancestor-or-self::*[@title][1]")
          .getAttribute("title");
        return [(await box.isDisabled()) && /no speech recognition/.test(title ?? ""), title];
      },
    );
  } finally {
    await context.close();
  }
}

async function dictationRows(page) {
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  const COMMAND = `Tidy Up ${tag}`;
  const FILE = `tidied ${tag}.txt`;
  const runs = async () =>
    ((await api(page, "GET", "/api/automator/runs")).json.runs ?? []).filter(
      (entry) => entry.trigger === "dictation-command",
    );
  await row("automator.160", "a Dictation Command is saved, and listening starts", async () => {
    const before = await listening(page);
    await dockButton(page, "Automator").click();
    const actions = page.getByRole("grid", { name: "Actions" });
    await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForTimeout(500);
    await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
    await page.waitForTimeout(250);
    await page.getByRole("menuitem", { name: /^New/ }).first().click();
    const sheet = page.getByRole("dialog", { name: /Choose a type/ });
    await sheet.getByRole("radio", { name: "Dictation Command", exact: true }).click();
    await sheet.getByRole("button", { name: "Choose" }).click();
    await sheet.waitFor({ state: "detached" });
    await page.getByRole("textbox", { name: "Workflow name" }).fill(COMMAND);
    const search = page.getByPlaceholder("Name", { exact: true });
    await search.fill("New Text File");
    await actions.getByText("New Text File", { exact: true }).first().dblclick();
    const added = page.locator(".mac-automator-step").first();
    await added.waitFor({ timeout: 5_000 });
    await added.getByLabel("path", { exact: true }).fill(`Documents/${FILE}`);
    await added.getByRole("checkbox", { name: "replace", exact: true }).click();
    await shot(page, path.join(out, "dictation-command.png"));
    await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
    await page.waitForTimeout(250);
    await page.getByRole("menuitem", { name: /^Save/ }).first().click();
    const stored = await until(async () => {
      const list = (await api(page, "GET", "/api/automator/workflows")).json.library?.workflows;
      return list?.some((each) => each.name === COMMAND && each.kind === "dictation-command");
    }, 8_000);
    const on = await until(async () => (await listening(page)) === 1, 6_000);
    return [before === 0 && stored && on, `before ${before}, stored ${stored}, listening ${on}`];
  });
  await row("automator.160.other", "other words run nothing", async () => {
    await say(page, "tidy up the kitchen");
    await page.waitForTimeout(1_000);
    return (await runs()).length === 0;
  });
  await row(
    "automator.160.run",
    "saying its name runs it, read back from the drive and the run log",
    async () => {
      await say(page, `${COMMAND.toUpperCase()}.`);
      const ran = await until(async () => (await runs()).length === 1, 12_000);
      const entries = (await api(page, "GET", "/api/files/")).json.entries;
      return [ran && entries.some((entry) => entry.name === FILE), `${(await runs()).length} runs`];
    },
  );
  await row("automator.160.disabled", "with the workflow gone, nothing listens", async () => {
    const reply = await api(page, "GET", "/api/automator/workflows");
    const list = reply.json.library.workflows.filter((each) => each.name !== COMMAND);
    await api(page, "PUT", "/api/automator/workflows", {
      library: { ...reply.json.library, workflows: list },
      rev: reply.json.rev,
    });
    await reloadDesktop(page);
    await page.waitForTimeout(1_500);
    return [(await listening(page)) === 0, `${await listening(page)} listening`];
  });
}

async function keychainRows(page) {
  const LOGIN = `login-pass-${tag}`;
  const WORK = `work-pass-${tag}`;
  const ITEM = `Bank ${tag}`;
  const SECRET = `hunter2-${tag}`;
  const NOTE = `Plan ${tag}`;
  const NOTE_TEXT = `meet-at-noon-${tag}`;
  const sent = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/keychain-access/") && request.postData())
      sent.push(request.postData());
  });
  await dockButton(page, "Keychain Access").click();
  const window = page.locator("[data-keychain-state]").first();
  await window.waitFor({ timeout: 10_000 });
  const list = window.getByRole("grid", { name: "Keychains" });
  const items = window.getByRole("grid", { name: "Items" });
  const row_ = (name) => items.getByRole("row").filter({ hasText: name }).first();
  const addItem = async (name, secret) => {
    await window.getByRole("button", { name: "New Keychain Item" }).click();
    const dialog = page.getByRole("dialog", { name: "New Password Item" });
    await dialog.getByLabel("Keychain Item Name:").fill(name);
    await dialog.getByLabel("Password:", { exact: true }).fill(secret);
    await dialog.getByRole("button", { name: "Add" }).click();
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });
    await row_(name).waitFor({ timeout: 5_000 });
  };
  const stored = async () => (await api(page, "GET", "/api/keychain-access/keychains")).json;
  const notice = page.getByRole("dialog", { name: "Keychain Access" });

  let dialog = page.getByRole("dialog", { name: "New Keychain Password" });
  await dialog.getByLabel("New Password:").fill(LOGIN);
  await dialog.getByLabel("Verify:").fill(LOGIN);
  await dialog.getByRole("button", { name: "Create" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  await addItem(ITEM, SECRET);

  await row(
    "keychain.140.new",
    "File > New Keychain makes one, with a password of its own",
    async () => {
      await chooseMenu(page, "File", "New Keychain…");
      dialog = page.getByRole("dialog", { name: "New Keychain" });
      await dialog.getByLabel("Name:").fill("login");
      const refused = await dialog.getByText(/already called/).isVisible();
      await dialog.getByLabel("Name:").fill("Work");
      await dialog.getByLabel("New Password:").fill(WORK);
      await dialog.getByLabel("Verify Password:").fill(WORK);
      await shot(page, path.join(out, "keychain-new.png"));
      await dialog.getByRole("button", { name: "Create" }).click();
      await dialog.waitFor({ state: "hidden", timeout: 20_000 });
      await list.getByRole("row", { name: "Work" }).waitFor({ timeout: 4_000 });
      const body = await stored();
      return [
        refused && body.keychains?.[0]?.name === "Work",
        JSON.stringify(Object.keys(body.keychains?.[0] ?? {})),
      ];
    },
  );
  await row("keychain.140.sidebar", "it shows in the sidebar and takes its own items", async () => {
    const selected = await list.getByRole("row", { name: "Work" }).getAttribute("aria-selected");
    await addItem(NOTE, NOTE_TEXT);
    await shot(page, path.join(out, "keychain-work.png"));
    const count = await items.getByRole("row").filter({ hasText: ITEM }).count();
    return [selected === "true" && count === 0, `selected ${selected}, ${count} of login's rows`];
  });
  await row(
    "keychain.140.sealed",
    "nothing but the name and the envelope reaches the server",
    async () => {
      const all = JSON.stringify(sent) + JSON.stringify(await stored());
      const leaks = [ITEM, SECRET, NOTE, NOTE_TEXT, LOGIN, WORK].filter((word) =>
        all.includes(word),
      );
      const salts = (await stored()).keychains[0].vault.kdf.salt;
      const login = (await api(page, "GET", "/api/keychain-access/vault")).json.vault.kdf.salt;
      return [leaks.length === 0 && salts !== login, `${sent.length} writes, leaks: ${leaks}`];
    },
  );
  await row(
    "keychain.140.lock",
    "each locks apart, and unlocks only with its own password",
    async () => {
      await window.getByRole("button", { name: /^Lock the .Work. keychain$/ }).click();
      await row_(NOTE).waitFor({ state: "detached", timeout: 4_000 });
      await list.getByRole("row", { name: "login" }).click();
      const loginOpen = await row_(ITEM).isVisible();
      await list.getByRole("row", { name: "Work" }).click();
      await window.getByRole("button", { name: /^Unlock the .Work. keychain$/ }).click();
      dialog = page.getByRole("dialog", { name: /Unlock the .Work. Keychain/ });
      await dialog.getByLabel("Password:").fill(LOGIN);
      await dialog.getByRole("button", { name: "Unlock" }).click();
      await dialog.getByText(/not correct/).waitFor({ timeout: 15_000 });
      await dialog.getByLabel("Password:").fill(WORK);
      await dialog.getByRole("button", { name: "Unlock" }).click();
      await dialog.waitFor({ state: "hidden", timeout: 15_000 });
      await row_(NOTE).waitFor({ timeout: 4_000 });
      return [loginOpen, "login stayed open"];
    },
  );
  await row(
    "keychain.140.drag",
    "dragging an item to another keychain moves it, stored in both",
    async () => {
      await list.getByRole("row", { name: "login" }).click();
      await row_(ITEM).waitFor();
      const before = (await stored()).keychains[0].vault.ciphertext;
      const loginBefore = (await api(page, "GET", "/api/keychain-access/vault")).json.vault
        .ciphertext;
      await row_(ITEM).dragTo(list.getByRole("row", { name: "Work" }));
      await until(
        async () => (await items.getByRole("row").filter({ hasText: ITEM }).count()) === 0,
        8_000,
      );
      await list.getByRole("row", { name: "Work" }).click();
      await row_(ITEM).waitFor({ timeout: 4_000 });
      await shot(page, path.join(out, "keychain-moved.png"));
      const changed = await until(async () => {
        const now = (await api(page, "GET", "/api/keychain-access/vault")).json.vault.ciphertext;
        return now !== loginBefore && (await stored()).keychains[0].vault.ciphertext !== before;
      }, 8_000);
      return [changed, "both envelopes changed"];
    },
  );
  await row(
    "keychain.140.reload",
    "after a reload each holds what it should, and its secret opens",
    async () => {
      await page.waitForTimeout(1_000);
      await reloadDesktop(page);
      const again = page.locator("[data-keychain-state]").first();
      if (!(await again.count())) await dockButton(page, "Keychain Access").click();
      await again.waitFor({ timeout: 10_000 });
      dialog = page.getByRole("dialog", { name: /Unlock the .login. Keychain/ });
      await dialog.getByLabel("Password:").fill(LOGIN);
      await dialog.getByRole("button", { name: "Unlock" }).click();
      await dialog.waitFor({ state: "hidden", timeout: 15_000 });
      await list.getByRole("row", { name: "login" }).click();
      await page.waitForTimeout(300);
      const leftInLogin = await items.getByRole("row").filter({ hasText: ITEM }).count();
      await list.getByRole("row", { name: "Work" }).click();
      await again.getByRole("button", { name: /^Unlock the .Work. keychain$/ }).click();
      dialog = page.getByRole("dialog", { name: /Unlock the .Work. Keychain/ });
      await dialog.getByLabel("Password:").fill(WORK);
      await dialog.getByRole("button", { name: "Unlock" }).click();
      await dialog.waitFor({ state: "hidden", timeout: 15_000 });
      await row_(ITEM).waitFor({ timeout: 4_000 });
      await row_(ITEM).dblclick();
      const info = page.getByRole("dialog", { name: ITEM });
      await info.waitFor({ timeout: 4_000 });
      await info.getByRole("button", { name: "Show Password" }).click();
      const values = await info.locator("input").evaluateAll((all) => all.map((one) => one.value));
      const shown = values.includes(SECRET) ? 1 : 0;
      await page.keyboard.press("Escape");
      await info.waitFor({ state: "hidden", timeout: 4_000 }).catch(() => {});
      return [
        leftInLogin === 0 && shown === 1,
        `${leftInLogin} left in login, secret shown ${shown}`,
      ];
    },
  );
  await row(
    "keychain.140.locked-target",
    "into a locked keychain it is refused with the reason, and stays",
    async () => {
      await list.getByRole("row", { name: "login" }).click();
      await window
        .getByRole("button", { name: /^Lock the .login. keychain$/ })
        .click()
        .catch(() => {});
      await list.getByRole("row", { name: "Work" }).click();
      await row_(ITEM).waitFor({ timeout: 4_000 });
      await row_(ITEM).dragTo(list.getByRole("row", { name: "login" }));
      await notice.getByText(/Unlock .login. first/).waitFor({ timeout: 4_000 });
      await notice.getByRole("button", { name: "OK" }).click();
      return row_(ITEM).isVisible();
    },
  );
  await row(
    "keychain.140.menu",
    "a row's menu moves it back to login, once login is open",
    async () => {
      await list.getByRole("row", { name: "login" }).click();
      await window.getByRole("button", { name: /^Unlock the .login. keychain$/ }).click();
      dialog = page.getByRole("dialog", { name: /Unlock the .login. Keychain/ });
      await dialog.getByLabel("Password:").fill(LOGIN);
      await dialog.getByRole("button", { name: "Unlock" }).click();
      await dialog.waitFor({ state: "hidden", timeout: 15_000 });
      await list.getByRole("row", { name: "Work" }).click();
      await row_(ITEM).click();
      await row_(ITEM).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Move to Keychain" }).click();
      await page.getByRole("menuitem", { name: "login", exact: true }).click();
      await until(
        async () => (await items.getByRole("row").filter({ hasText: ITEM }).count()) === 0,
        10_000,
      );
      await list.getByRole("row", { name: "login" }).click();
      await row_(ITEM).waitFor({ timeout: 4_000 });
      return true;
    },
  );
  await row(
    "keychain.140.delete",
    "File > Delete Keychain asks, then the server holds it no more",
    async () => {
      await list.getByRole("row", { name: "Work" }).click();
      await chooseMenu(page, "File", "Delete Keychain “Work”…");
      dialog = page.getByRole("dialog", { name: /Delete Keychain .Work./ });
      await dialog.getByText(/“Work” keychain and its item/).waitFor({ timeout: 4_000 });
      await dialog.getByRole("button", { name: "Delete" }).click();
      await dialog.waitFor({ state: "hidden", timeout: 8_000 });
      await list.getByRole("row", { name: "Work" }).waitFor({ state: "detached", timeout: 4_000 });
      const left = (await stored()).keychains;
      await row_(ITEM).waitFor({ timeout: 4_000 });
      return [left.length === 0, "login shows again, with its item"];
    },
  );
}

await run(async (page) => {
  await page.addInitScript(SPEECH_STUB);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, {
    name: `row17${tag}`,
    fullName: `Row Seventeen ${tag}`,
    password: `pw-${tag}-a`,
  });
  await reloadDesktop(page);
  await homeRows(page);
  await networkRows(page);
  await heySiriRows(page);
  await noRecognizer(page.context().browser());
  await dictationRows(page);
  await keychainRows(page);
});
