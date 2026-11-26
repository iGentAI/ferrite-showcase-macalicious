#!/usr/bin/env node
// Home and Network Utility back on the served desktop, with real input against `ferrite dev`. Each step is one row of
// features/home.md or features/network-utility.md (census ids home.* and net.*). Home: an empty home that says no accessory
// exists, what it offers, and the person's homes, rooms, scenes and automations read back from the server. Network Utility:
// Lookup and Whois against the real resolver and registries (no stand-in: the run needs the network), Ping's labelled round
// trips, what each other pane cannot be, its menus and what comes back after a reload. The browser's print() is a stand-in
// in net.print: Firefox's print preview would hold the page until a person closes it.
//
//   node e2e/home-network-batch13-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { readFileSync } from "node:fs";
import path from "node:path";
import { api, journey, options, reloadDesktop, shot } from "./app-journey.mjs";
import { sameDownloadName } from "./journey-kit.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";
import { createAccount } from "./people-kit.mjs";

const { base, out, browserName } = options();
const tag = Date.now().toString(36);
const { step, run, expectRefusal } = journey("home-network-batch13", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

/** Runs a row: a throw fails that row alone, so one broken control leaves the census readable. */
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

const homes = async (page) => (await api(page, "GET", "/api/home/homes")).json.homes;
const saved = (page, check) =>
  until(async () => {
    const now = await homes(page);
    return Boolean(now && check(now));
  }, 8_000);

async function openFromDock(page, name, id) {
  await page
    .locator(".mac-desktop-shell-dock, [aria-label='Dock'], nav")
    .getByRole("button", { name: new RegExp(`^${name}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${name}$`) }))
    .first()
    .click();
  const shell = page.locator(`[data-window-id="${id}"]`);
  await shell.waitFor({ timeout: 15_000 });
  return shell;
}

/** The sheet shown: fills its name, chooses in its pop-up buttons, then presses a button. */
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

const context = async (page, target, item) => {
  await target.click({ button: "right" });
  await page.getByRole("menuitem", { name: item, exact: true }).click();
};

async function homeRows(page) {
  const home = await openFromDock(page, "Home", "home");
  const tile = (name) => home.getByRole("button", { name, exact: true });
  const anyTile = (text) => home.getByRole("button", { name: new RegExp(text) }).first();

  await row("home.empty", "a new home is empty and says no accessories exist", async () => {
    await home.getByText("No Accessories").waitFor({ timeout: 10_000 });
    const text = await home.innerText();
    return [
      text.includes("My Home") && text.includes("No real accessories: this desktop has no HomeKit"),
      text.slice(0, 120).replace(/\n/g, " "),
    ];
  });
  await shot(page, path.join(out, "home-empty.png"));
  await row("home.59.first", "nothing is on the server until a change", async () => {
    return (await homes(page)) === null;
  });
  await row(
    "home.11",
    "File > Add Accessory says none is found, adds a simulated one",
    async () => {
      await chooseMenu(page, "File", "Add Accessory…");
      const sheet = await inSheet(page, {});
      const said = (await sheet.innerText()).includes("Home found no accessories");
      await inSheet(page, { name: "Lamp", press: "Add" });
      await tile("Default Room Lamp Off").waitFor({ timeout: 4_000 });
      return [
        said && (await saved(page, (all) => all[0].accessories[0]?.name === "Lamp")),
        "read back",
      ];
    },
  );
  await row("home.10", "File > New Room adds a room, on the server", async () => {
    await chooseMenu(page, "File", "New Room…");
    await inSheet(page, { name: "Study", press: "Add" });
    return saved(page, (all) => all[0].rooms.includes("Study"));
  });
  await row("home.40", "Add Accessory: an outlet in a chosen room", async () => {
    await home.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("menuitem", { name: "Add Accessory…" }).click();
    await inSheet(page, {
      name: "Fan",
      choices: { "Room:": "Study", "Kind:": "Outlet" },
      press: "Add",
    });
    return saved(page, (all) =>
      all[0].accessories.some((a) => a.name === "Fan" && a.kind === "outlet" && a.room === "Study"),
    );
  });
  await row("home.32", "a click switches a tile, and the status line follows", async () => {
    await tile("Default Room Lamp Off").click();
    await tile("Default Room Lamp On").waitFor({ timeout: 3_000 });
    return [
      (await home.innerText()).includes("1 light on.") &&
        (await saved(page, (all) => all[0].accessories[0].on === true)),
    ];
  });
  await row("home.53", "Command-2, Command-3 and Command-1 change the tab", async () => {
    const seen = [];
    for (const [key, words] of [
      ["2", "Accessories"],
      ["3", "Automation"],
      ["1", "Favorite Accessories"],
    ]) {
      await page.keyboard.press(`ControlOrMeta+${key}`);
      await home.getByText(words, { exact: true }).first().waitFor({ timeout: 3_000 });
      seen.push(key);
    }
    return [seen.length === 3, seen.join()];
  });
  await row("home.20", "View > Rooms, Automation, Home", async () => {
    await chooseMenu(page, "View", "Rooms");
    await home.getByRole("complementary").or(home.getByLabel("Rooms")).first().waitFor();
    await chooseMenu(page, "View", "Automation");
    await home.getByText("No Automations").waitFor({ timeout: 3_000 });
    await chooseMenu(page, "View", "Home");
    return home.getByText("Favorite Accessories").isVisible();
  });
  await row(
    "home.38",
    "accessory settings: rename, favorite, brightness, from the tile's menu",
    async () => {
      await context(page, tile("Default Room Lamp On"), "Accessory Settings…");
      const sheet = await inSheet(page, { name: "Reading Lamp" });
      const slider = sheet.getByRole("slider");
      await slider.focus();
      await page.keyboard.press("ArrowLeft");
      await sheet.getByRole("button", { name: "Done", exact: true }).click();
      return saved(
        page,
        (all) =>
          all[0].accessories[0].name === "Reading Lamp" && all[0].accessories[0].brightness === 99,
      );
    },
  );
  await row("home.48", "accessory tile menu: Turn Off, and Remove from Favorites", async () => {
    await context(page, anyTile("Reading Lamp"), "Turn Off");
    await saved(page, (all) => all[0].accessories[0].on === false);
    await context(page, anyTile("Fan"), "Remove from Favorites");
    return saved(page, (all) => all[0].accessories[1].favorite === false);
  });
  await row("home.12", "File > Add Scene makes a scene for a room's lights", async () => {
    await chooseMenu(page, "File", "Add Scene…");
    await inSheet(page, { name: "Evening", press: "Add" });
    return saved(page, (all) => all[0].scenes[0]?.name === "Evening");
  });
  await row("home.31", "a scene's tile runs it", async () => {
    await tile("Evening").click();
    return saved(page, (all) => all[0].accessories[0].on === true);
  });
  await row("home.42", "the scene editor sets another accessory, saved", async () => {
    await context(page, tile("Evening"), "Edit Scene…");
    await inSheet(page, { choices: { "Study Fan:": "On" }, press: "Done" });
    return saved(page, (all) => Object.values(all[0].scenes[0].sets).length === 2);
  });
  await row("home.66", "the Dock menu runs a scene", async () => {
    await context(page, tile("Reading Lamp").or(anyTile("Reading Lamp")), "Turn Off");
    await saved(page, (all) => all[0].accessories[0].on === false);
    await page
      .getByRole("button", { name: /^Home$/ })
      .last()
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Evening", exact: true }).click();
    return saved(page, (all) => all[0].accessories[0].on === true);
  });
  await row(
    "home.43.accessory",
    "an automation runs a scene when an accessory is switched, and tells Notification Center",
    async () => {
      await context(page, anyTile("Reading Lamp"), "Turn Off");
      await chooseMenu(page, "File", "New Room…").catch(() => {});
      await inSheet(page, { name: "Hall", press: "Add" });
      await home.getByRole("button", { name: "Add", exact: true }).click();
      await page.getByRole("menuitem", { name: "Add Accessory…" }).click();
      await inSheet(page, {
        name: "Sensor Pad",
        choices: { "Room:": "Default Room", "Kind:": "Outlet" },
        press: "Add",
      });
      await saved(page, (all) => all[0].accessories.length === 3);
      await page.keyboard.press("ControlOrMeta+3");
      await home.getByRole("button", { name: "Add Automation…" }).click();
      await inSheet(page, {
        name: "Pad Lights",
        choices: {
          "When:": "An Accessory Is Controlled",
          "Accessory:": "Default Room Sensor Pad",
          "Turns:": "On",
        },
        press: "Done",
      });
      await saved(page, (all) => all[0].automations?.[0]?.trigger.kind === "accessory");
      await page.keyboard.press("ControlOrMeta+1");
      await tile("Default Room Sensor Pad Off").click();
      const ran = await saved(
        page,
        (all) => all[0].accessories[0].on === true && all[0].automations[0].lastRun > 0,
      );
      const told = await until(async () => {
        const { json } = await api(page, "GET", "/api/notification-center/inbox");
        return (json.items ?? []).some((item) => JSON.stringify(item).includes("Pad Lights"));
      }, 8_000);
      return [ran && told, `ran ${ran}, told ${told}`];
    },
  );
  await row("home.43.time", "a time-of-day automation runs while the window is open", async () => {
    await until(async () => new Date().getSeconds() < 40, 25_000);
    await tile("Default Room Sensor Pad On").click();
    await context(page, anyTile("Reading Lamp"), "Turn Off");
    await saved(page, (all) => all[0].accessories[0].on === false);
    await page.keyboard.press("ControlOrMeta+3");
    await home.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("menuitem", { name: "Add Automation…" }).click();
    await inSheet(page, { name: "Now", press: "Done" });
    const ran = await until(async () => {
      const now = await homes(page);
      return now?.[0]?.accessories[0].on === true && now[0].automations[1]?.lastRun > 0;
    }, 18_000);
    await home
      .getByText(/Last ran/)
      .first()
      .waitFor({ timeout: 4_000 });
    await shot(page, path.join(out, "home-automation.png"));
    return ran;
  });
  await row("home.51", "arrow keys go between tiles", async () => {
    await page.keyboard.press("ControlOrMeta+1");
    const first = home.locator("[data-home-scene], [data-home-accessory]").first();
    await first.focus();
    await page.keyboard.press("ArrowRight");
    const moved = await page.evaluate(() => document.activeElement?.dataset?.homeAccessory ?? "");
    return [moved !== "", moved];
  });
  await row("home.52", "Space switches the focused tile", async () => {
    const before = (await homes(page))[0].accessories[0].on;
    await home.locator("[data-home-accessory]").first().focus();
    await page.keyboard.press("Space");
    return saved(page, (all) => all[0].accessories[0].on !== before);
  });
  await row("home.55", "dragging a tile reorders it, on the server", async () => {
    const before = (await homes(page))[0].accessories.map((a) => a.name);
    const tiles = home.locator("[data-home-accessory]");
    const count = await tiles.count();
    await tiles.nth(count - 1).dragTo(tiles.nth(0));
    const done = await saved(
      page,
      (all) => all[0].accessories.map((a) => a.name).join() !== before.join(),
    );
    return [done, (await homes(page))[0].accessories.map((a) => a.name).join()];
  });
  await row("home.56", "an accessory dragged onto a room moves there", async () => {
    await page.keyboard.press("ControlOrMeta+2");
    await home.getByRole("button", { name: "Default Room", exact: true }).click();
    await home
      .getByRole("button", { name: /Sensor Pad/ })
      .dragTo(home.getByRole("button", { name: "Study", exact: true }));
    return saved(page, (all) =>
      all[0].accessories.some((a) => a.name === "Sensor Pad" && a.room === "Study"),
    );
  });
  await row("home.57", "dragging a room reorders the rooms", async () => {
    await home
      .getByRole("button", { name: "Hall", exact: true })
      .dragTo(home.getByRole("button", { name: "Default Room", exact: true }));
    return [
      await saved(page, (all) => all[0].rooms[0] === "Hall"),
      (await homes(page))[0].rooms.join(),
    ];
  });
  await row("home.49", "a room row's menu, and Room Settings renames", async () => {
    await context(page, home.getByRole("button", { name: "Study", exact: true }), "Room Settings…");
    await inSheet(page, { name: "Den", press: "Done" });
    return saved(
      page,
      (all) => all[0].rooms.includes("Den") && all[0].accessories.some((a) => a.room === "Den"),
    );
  });
  await row("home.37", "Remove Room moves what was in it to the first room left", async () => {
    await context(page, home.getByRole("button", { name: "Den", exact: true }), "Remove Room…");
    await inSheet(page, { press: "Remove" });
    return saved(
      page,
      (all) => !all[0].rooms.includes("Den") && all[0].accessories.every((a) => a.room !== "Den"),
    );
  });
  await row(
    "home.54",
    "Delete on a tile asks, then removes it from scenes and automations",
    async () => {
      await page.keyboard.press("ControlOrMeta+2");
      await home.getByRole("button", { name: "Hall", exact: true }).click();
      const fan = anyTile("Fan");
      await fan.focus();
      await page.keyboard.press("Delete");
      await inSheet(page, { press: "Remove" });
      const removed = await saved(
        page,
        (all) =>
          !all[0].accessories.some((a) => a.name === "Fan") &&
          Object.keys(all[0].scenes[0].sets).every((id) =>
            all[0].accessories.some((a) => a.id === id),
          ),
      );
      await page.keyboard.press("ControlOrMeta+1");
      return removed;
    },
  );
  await row("home.50", "a scene tile's menu removes it, and what ran it", async () => {
    await context(page, tile("Evening"), "Remove Scene…");
    await inSheet(page, { press: "Remove" });
    return saved(
      page,
      (all) => all[0].scenes.length === 0 && (all[0].automations ?? []).length === 0,
    );
  });
  await row(
    "home.36",
    "Home Settings: name and wallpaper saved; Invite dimmed with its reason",
    async () => {
      await chooseMenu(page, "Edit", "Home Settings…");
      const sheet = await inSheet(page, { name: "Flat", choices: { "Wallpaper:": "Dusk" } });
      const invite = sheet.getByRole("button", { name: /People|Invite/ });
      const dimmed = await invite.isDisabled();
      const reason = (await sheet.innerText()).includes("Sharing a home needs HomeKit");
      await shot(page, path.join(out, "home-settings.png"));
      await sheet.getByRole("button", { name: "Done", exact: true }).click();
      const kept = await saved(
        page,
        (all) => all[0].name === "Flat" && all[0].wallpaper === "dusk",
      );
      const paper = await home
        .locator(".mac-home-view")
        .evaluate((view) => getComputedStyle(view).backgroundImage);
      return [
        dimmed && reason && kept && paper.includes("gradient"),
        `${dimmed} ${reason} ${kept}`,
      ];
    },
  );
  await row("home.9", "File > New Home adds a home and shows it", async () => {
    await chooseMenu(page, "File", "New Home…");
    await inSheet(page, { name: "Cabin", press: "Add" });
    await home.getByRole("heading", { name: "Cabin" }).waitFor({ timeout: 3_000 });
    return saved(page, (all) => all.length === 2 && all[1].name === "Cabin");
  });
  await row("home.60", "the last home and tab come back after a reload", async () => {
    await page.keyboard.press("ControlOrMeta+2");
    await until(async () => {
      const { json } = await api(page, "GET", "/api/system-preferences/settings");
      return json.values?.["home.tab"] === "rooms";
    }, 6_000);
    await reloadDesktop(page);
    const again = page.locator('[data-window-id="home"]');
    if ((await again.count()) === 0) await openFromDock(page, "Home", "home");
    await again.getByLabel("Rooms").first().waitFor({ timeout: 15_000 });
    return again.getByRole("button", { name: "Default Room", exact: true }).first().isVisible();
  });
  await row("home.44", "Remove Home, from Home Settings of the second home", async () => {
    const shell = page.locator('[data-window-id="home"]');
    await shell.getByRole("button", { name: "Homes" }).click();
    await page.getByRole("menuitem", { name: "Home Settings…" }).click();
    await inSheet(page, { press: "Remove Home…" });
    await inSheet(page, { press: "Remove" });
    return saved(page, (all) => all.length === 1 && all[0].name === "Flat");
  });
  await row("home.28", "Help > Home Help opens its guide", async () => {
    await chooseMenu(page, "Help", "Home Help");
    const helper = page.locator('[data-window-id="help-viewer"]');
    await helper.waitFor({ timeout: 10_000 });
    await helper.getByText("What Home does here").first().waitFor({ timeout: 8_000 });
    await page.keyboard.press("ControlOrMeta+w");
    return true;
  });
}

async function perPerson(page, base) {
  // Row 61: another account, in its own browser context, has its own empty home.
  const other = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const second = await other.newPage();
    await second.goto(`${base}/`, { waitUntil: "load" });
    await createAccount(second, {
      name: `homeb${tag}`,
      fullName: `Home B ${tag}`,
      password: `pw-${tag}-b`,
    });
    const reply = await api(second, "GET", "/api/home/homes");
    step("home.61: another person's homes are their own", reply.json.homes === null);
    const mine = await homes(page);
    step("home.61: the first person's homes stay", mine[0].name === "Flat");
  } finally {
    await other.close();
  }
}

async function networkRows(page) {
  const shell = await openFromDock(page, "Network Utility", "network-utility");
  const tab = async (name) => {
    await shell.getByRole("tab", { name, exact: true }).click();
  };
  const output = (name) => shell.getByRole("textbox", { name: `${name} output` });
  const finished = (name, words, timeout = 20_000) =>
    until(async () => (await output(name).inputValue()).includes(words), timeout);
  const run = async (field, value) => {
    const input = shell.getByRole("textbox", { name: field });
    await input.fill(value);
    await input.press("Enter");
  };

  await row("net.info", "Info shows the browser's own facts, labelled", async () => {
    const text = await shell.innerText();
    return [
      text.includes("a page is shown no network interface") &&
        text.includes("This Browser (not an interface)") &&
        text.includes("browser's online flag") &&
        text.includes("Not shown to a web page"),
      text.slice(0, 200).replace(/\n/g, " "),
    ];
  });
  await shot(page, path.join(out, "network-info.png"));
  await row("net.lookup", "Lookup asks the real resolver, and prints its records", async () => {
    await tab("Lookup");
    const idle = await output("Lookup").inputValue();
    await run("Internet address", "example.com");
    const done = await finished("Lookup", "status: NOERROR");
    const text = await output("Lookup").inputValue();
    return [
      idle.startsWith("Real:") && done && /example\.com\.?\t\d+\tIN\tA\t\d+\.\d+/.test(text),
      text.split("\n").slice(2, 6).join(" | "),
    ];
  });
  await shot(page, path.join(out, "network-lookup.png"));
  await row("net.lookup.type", "a record type can be chosen", async () => {
    await shell.getByRole("combobox", { name: "Record:" }).click();
    await page.getByRole("option", { name: "NS", exact: true }).click();
    await run("Internet address", "example.com");
    const done = await finished("Lookup", "example.com  NS  status: NOERROR");
    return [done, (await output("Lookup").inputValue()).slice(0, 120)];
  });
  await row("net.lookup.bad", "what is not a host is refused in words", async () => {
    expectRefusal(400, "/api/network-utility/lookup");
    await run("Internet address", "bad host");
    return finished("Lookup", "Lookup did not start:");
  });
  await row("net.whois", "Whois asks the real registry over RDAP, and says so", async () => {
    await tab("Whois");
    await run("Domain address", "example.com");
    const done = await finished("Whois", "Domain Name: EXAMPLE.COM");
    const text = await output("Whois").inputValue();
    return [done && text.includes("rdap.verisign.com (RDAP over HTTPS"), text.slice(0, 160)];
  });
  await row("net.whois.ip", "Whois of an address ARIN holds", async () => {
    await run("Domain address", "8.8.8.8");
    return finished("Whois", "rdap.arin.net");
  });
  await row("net.whois.tld", "a name no declared registry holds is refused in words", async () => {
    expectRefusal(400, "/api/network-utility/whois");
    await run("Domain address", "example.co.uk");
    return finished("Whois", "no registry for example.co.uk is declared");
  });
  await row("net.ping", "Ping says it is not ping, and times labelled HTTPS requests", async () => {
    await tab("Ping");
    const idle = await output("Ping").inputValue();
    await run("Network address", "example.com");
    const done = await finished("Ping", "not ICMP", 40_000);
    const text = await output("Ping").inputValue();
    return [
      idle.startsWith("This is not ping") &&
        done &&
        /request 4: HTTP \d+, \d+ ms round trip over HTTPS/.test(text),
      text.split("\n").slice(-2).join(" | "),
    ];
  });
  await shot(page, path.join(out, "network-ping.png"));
  await row(
    "net.ping.undeclared",
    "Ping to a host not declared sends nothing and says so",
    async () => {
      await run("Network address", "not-declared.example.net");
      return finished("Ping", "Nothing was sent to not-declared.example.net");
    },
  );
  await row("net.stop", "Stop ends a run and keeps what it printed", async () => {
    await run("Network address", "example.com");
    await finished("Ping", "request 1:", 8_000);
    await shell.getByRole("button", { name: "Stop", exact: true }).click({ timeout: 5_000 });
    const done = await finished("Ping", "Ping was stopped.", 3_000);
    await page.waitForTimeout(1_500);
    const text = await output("Ping").inputValue();
    const again = await shell.getByRole("button", { name: "Ping", exact: true }).isEnabled();
    return [
      done && again && text.includes("request 1:") && !text.includes("request 4:"),
      text.split("\n").slice(-3).join(" | "),
    ];
  });
  for (const [title, field, id, why] of [
    ["Traceroute", "Network address", "net.traceroute", "growing hop limits"],
    ["Finger", "User name and domain address", "net.finger", "port 79"],
    ["Port Scan", "Internet or IP address", "net.portscan", "many ports"],
  ]) {
    await row(
      id,
      `${title} says what a web service cannot do, before and after a run`,
      async () => {
        await tab(title);
        const idle = await output(title).inputValue();
        await run(field, "user@example.com");
        const after = await output(title).inputValue();
        return [idle.includes(why) && after.includes("Nothing was sent."), after.slice(0, 80)];
      },
    );
  }
  await row(
    "net.netstat",
    "Netstat lists what can be said, each labelled as not the real thing",
    async () => {
      await tab("Netstat");
      const seen = [];
      for (const [radio, words] of [
        ["Display routing table information", "Not a routing table"],
        [
          "Display comprehensive network statistics for each protocol",
          "Not the machine's protocol statistics",
        ],
        ["Display multicast information", "Not available"],
        ["Display the state of all current socket connections", "Not sockets"],
      ]) {
        await shell.getByRole("radio", { name: radio }).click();
        await shell.getByRole("button", { name: "Netstat", exact: true }).click();
        if (await finished("Netstat", words, 8_000)) seen.push(words);
      }
      return [seen.length === 4, seen.join(", ")];
    },
  );
  await row("net.save", "File > Save Output downloads what the pane printed", async () => {
    await tab("Whois");
    await run("Domain address", "example.com");
    await finished("Whois", "Domain Name: EXAMPLE.COM");
    await page.waitForTimeout(500);
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 8_000 }),
      chooseMenu(page, "File", "Save Output…"),
    ]);
    const name = download.suggestedFilename();
    const text = readFileSync(await download.path(), "utf8");
    return [
      sameDownloadName(name, "Network Utility Whois.txt", browserName) &&
        text.includes("EXAMPLE.COM"),
      name,
    ];
  });
  await row("net.print", "File > Print prints a copy of the output", async () => {
    await page.evaluate(() => {
      window.__printed = [];
      new MutationObserver((_, watch) => {
        const frame = document.querySelector("iframe[data-network-utility-print]");
        if (!frame) return;
        watch.disconnect();
        frame.addEventListener(
          "load",
          () => {
            frame.contentWindow.print = () => {
              window.__printed.push(frame.contentDocument.body.textContent);
            };
          },
          { capture: true },
        );
      }).observe(document.body, { childList: true });
    });
    await chooseMenu(page, "File", "Print…");
    return until(
      async () =>
        ((await page.evaluate(() => window.__printed.at(-1))) ?? "").includes("EXAMPLE.COM"),
      4_000,
    );
  });
  await row("net.edit", "Edit acts on the field: Select All, then Copy", async () => {
    const input = shell.getByRole("textbox", { name: "Domain address" });
    await input.fill("copy-me.example");
    await input.focus();
    await chooseMenu(page, "Edit", "Select All");
    await page.waitForTimeout(450);
    const all = await input.evaluate((field) =>
      field.value.slice(field.selectionStart, field.selectionEnd),
    );
    await chooseMenu(page, "Edit", "Copy");
    await page.waitForTimeout(450);
    return [all === "copy-me.example", all];
  });
  await row("net.context", "the output's contextual menu offers Copy", async () => {
    const box = output("Whois");
    await box.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await box.click({ button: "right", position: { x: 40, y: 20 } });
    const menu = page.getByRole("menu", { name: "Whois text commands" });
    await menu.waitFor({ timeout: 3_000 });
    const rows = await menu.getByRole("menuitem").allInnerTexts();
    await page.keyboard.press("Escape");
    return [rows.some((each) => each.startsWith("Copy")), rows.join(" | ").replace(/\n/g, " ")];
  });
  await row("net.keep", "the tab, address and output come back after a reload", async () => {
    await run("Domain address", "example.com");
    await finished("Whois", "Domain Name: EXAMPLE.COM");
    await page.waitForTimeout(1_200);
    await reloadDesktop(page);
    const again = page.locator('[data-window-id="network-utility"]');
    if ((await again.count()) === 0) await openFromDock(page, "Network Utility", "network-utility");
    const box = again.getByRole("textbox", { name: "Whois output" });
    const back = await until(async () => (await box.inputValue()).includes("EXAMPLE.COM"), 12_000);
    const address = await again.getByRole("textbox", { name: "Domain address" }).inputValue();
    return [back && address === "example.com", address];
  });
  await row("net.history", "recent lookups are kept, and can be forgotten", async () => {
    const held = (await api(page, "GET", "/api/network-utility/history")).json;
    const had = held.history?.some((each) => each.host === "example.com");
    const gone = await api(page, "DELETE", "/api/network-utility/history");
    const now = (await api(page, "GET", "/api/network-utility/history")).json;
    return [had && gone.status === 200 && now.history === null, `${gone.status}`];
  });
  await row("net.help", "Help > Network Utility Help opens its guide", async () => {
    await chooseMenu(page, "Help", "Network Utility Help");
    const helper = page.locator('[data-window-id="help-viewer"]');
    await helper.waitFor({ timeout: 10_000 });
    await helper.getByText("What is not the real thing").first().waitFor({ timeout: 8_000 });
    return true;
  });
}

await run(async (page) => {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, {
    name: `homea${tag}`,
    fullName: `Home A ${tag}`,
    password: `pw-${tag}-a`,
  });
  const { catalogue } = (await api(page, "GET", "/api/apps")).json;
  step(
    "both apps are in the catalogue, preinstalled",
    ["home", "network-utility"].every((id) => catalogue.find((app) => app.id === id)?.preinstalled),
  );
  await homeRows(page);
  await perPerson(page, base);
  await networkRows(page);
});
