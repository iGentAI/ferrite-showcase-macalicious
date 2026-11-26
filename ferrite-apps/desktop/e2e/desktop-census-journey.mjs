#!/usr/bin/env node
// The desktop's census (app `desktop`), part 1: the menu bar with no window open (Finder in front), the Apple menu and its
// Recent Items, every status menu, and Bring All to Front across an application's two windows. Real mouse and keyboard
// only, on accounts made at the login window under `ferrite dev`; the server is read back through the page's own API.
// `--phase write` sets what persists (Recent Items, Show Percentage); after a real same-root restart of `ferrite dev`,
// `--phase restart-check --run <same id>` signs the same account in and finds it, and a second account does not.
//
//   node e2e/desktop-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase write|restart-check|all] [--run <id>] [--out dir]

import {
  census,
  clickOwn,
  closeAll,
  closeMenus,
  createAccount,
  dimmedIn,
  dockButton,
  drag,
  frameOf,
  managedOf,
  menuItem,
  menuOpen,
  menuTitle,
  moveTo,
  openFromDock,
  openMenu,
  passwordField,
  person,
  preferencesShow,
  signInOther,
} from "./r2-census-kit.mjs";

const V = "desktop-census-journey.mjs";
const R = (id, state, role, name, expected, extra = {}) => ({
  id: `desktop.${id}`,
  app: "desktop",
  window_or_state: state,
  role,
  name,
  how_reached: extra.how ?? `${state.replace(/^menu:/, "")} in the menu bar, with the mouse`,
  expected_outcome: expected,
  verified_by: `${V} ${id}`,
  persists: extra.persists ?? "none",
  notes: extra.notes ?? "",
  ...extra,
});
const NO_WINDOW = "unavailable:no window is open (the desktop shows none)";

// Finder in front with no window: its menus as the desktop builds them.
const finderRows = [
  R(
    "finder.about-finder",
    "menu:Finder",
    "menuitem",
    "About Finder",
    "an About window names Finder and its version; its close button closes it",
  ),
  R(
    "finder.preferences",
    "menu:Finder",
    "menuitem",
    "Preferences…",
    "Finder's Preferences window opens with its panes; its close button closes it",
  ),
  R(
    "finder.empty-trash",
    "menu:Finder",
    "menuitem",
    "Empty Trash…",
    "unavailable:No Finder window is open",
    { dimmed: "No Finder window is open" },
  ),
  R(
    "finder.empty-trash-reason",
    "menu:Finder",
    "menuitem",
    "No Finder window is open",
    "unavailable:the statement itself",
    { statement: true },
  ),
  R(
    "finder.services",
    "menu:Finder",
    "menuitem",
    "Services",
    "its submenu shows the dimmed statement No Services Apply",
  ),
  R(
    "finder.no-services-apply",
    "menu:Finder > Services",
    "menuitem",
    "No Services Apply",
    "unavailable:the statement itself",
    { statement: true },
  ),
  R("finder.hide-finder", "menu:Finder", "menuitem", "Hide Finder", NO_WINDOW, { noWindow: true }),
  R("finder.hide-others", "menu:Finder", "menuitem", "Hide Others", NO_WINDOW, { noWindow: true }),
  R("finder.show-all", "menu:Finder", "menuitem", "Show All", NO_WINDOW, { noWindow: true }),
  R("file.close-window", "menu:File", "menuitem", "Close Window", NO_WINDOW, { noWindow: true }),
  R(
    "edit.finder-adds-no-edit-commands",
    "menu:Edit",
    "menuitem",
    "No Finder window is open",
    "unavailable:the statement itself",
    { statement: true },
  ),
  ...["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"].map((item) =>
    R(
      `edit.${item.toLowerCase().replace(/ /g, "-")}`,
      "menu:Edit",
      "menuitem",
      item,
      "unavailable:No Finder window is open",
      { dimmed: "No Finder window is open" },
    ),
  ),
  R("view.enter-full-screen", "menu:View", "menuitem", "Enter Full Screen", NO_WINDOW, {
    noWindow: true,
  }),
  R("go.back", "menu:Go", "menuitem", "Back", "unavailable:No Finder window is open", {
    dimmed: "No Finder window is open",
  }),
  R("go.forward", "menu:Go", "menuitem", "Forward", "unavailable:No Finder window is open", {
    dimmed: "No Finder window is open",
  }),
  R(
    "go.finder-has-no-back-or-forward",
    "menu:Go",
    "menuitem",
    "No Finder window is open",
    "unavailable:the statement itself",
    { statement: true },
  ),
  R(
    "go.applications",
    "menu:Go",
    "menuitem",
    "Applications",
    "its submenu lists every application; choosing one opens it (first, middle and last checked)",
  ),
  R(
    "go.applications.app",
    "menu:Go > Applications",
    "menuitem",
    "/(Safari|Mail|FaceTime|Messages|Maps|Photos|Contacts|Calendar|Reminders|Notes|Music|Podcasts|TV|News|App Store|System Preferences|About This Mac|Activity Monitor|Calculator|Chess|Console|Font Book|Force Quit Applications|Help Viewer|Keychain Access|Stickies|Storage Management|System Information|TextEdit)/",
    "choosing an application opens its window",
    { notes: "kind: an application of Go > Applications" },
  ),
  R("window.minimize", "menu:Window", "menuitem", "Minimize", NO_WINDOW, { noWindow: true }),
  R("window.zoom", "menu:Window", "menuitem", "Zoom", NO_WINDOW, { noWindow: true }),
  R("window.bring-all-to-front", "menu:Window", "menuitem", "Bring All to Front", NO_WINDOW, {
    noWindow: true,
  }),
  R(
    "help.finder-help",
    "menu:Help",
    "menuitem",
    "Finder Help",
    "Help Viewer opens on a search for Finder",
  ),
];

const appleRows = [
  R(
    "apple.about-this-mac",
    "menu:Apple",
    "menuitem",
    "About This Mac",
    "About This Mac's window opens",
  ),
  R(
    "apple.system-preferences",
    "menu:Apple",
    "menuitem",
    "System Preferences…",
    "System Preferences' window opens",
  ),
  R("apple.app-store", "menu:Apple", "menuitem", "App Store…", "App Store's window opens"),
  R(
    "apple.recent-items",
    "menu:Apple",
    "menuitem",
    "Recent Items",
    "its submenu lists the apps this account opened, newest first",
  ),
  R(
    "apple.recent-items.applications",
    "menu:Apple > Recent Items",
    "menuitem",
    "Applications",
    "unavailable:the heading of the list under it",
    { statement: true },
  ),
  R(
    "apple.recent-items.app",
    "menu:Apple > Recent Items",
    "menuitem",
    "/(App Store|System Preferences|About This Mac|Force Quit Applications|Console|Calculator)/",
    "choosing a recent app opens it again",
    { notes: "kind: an app of Recent Items" },
  ),
  R(
    "apple.recent-items.clear-menu",
    "menu:Apple > Recent Items",
    "menuitem",
    "Clear Menu",
    "the list empties to the dimmed statement No Recent Applications (Clear Menu then dimmed)",
  ),
  R(
    "apple.recent-items.no-recent-applications",
    "menu:Apple > Recent Items",
    "menuitem",
    "No Recent Applications",
    "unavailable:the statement itself, shown while the list is empty",
    { statement: true },
  ),
  R(
    "apple.recent-items.kept",
    "menu:Apple > Recent Items",
    "menuitem",
    "About This Mac",
    "the list is kept for the account: after a reload and a real restart it still lists the app opened last; a second account's list is empty",
    { persists: "restart", phase: "restart-check" },
  ),
  R(
    "apple.force-quit",
    "menu:Apple",
    "menuitem",
    "Force Quit…",
    "the Force Quit Applications window opens",
  ),
  R(
    "apple.sleep",
    "menu:Apple",
    "menuitem",
    "Sleep",
    "the display goes black; a key wakes it into the lock screen, and the account's password unlocks the desktop",
  ),
  R(
    "apple.restart",
    "menu:Apple",
    "menuitem",
    "Restart…",
    "an alert asks to restart; Cancel leaves the desktop as it was (Restart itself: accounts-census-journey.mjs)",
  ),
  R(
    "apple.shut-down",
    "menu:Apple",
    "menuitem",
    "Shut Down…",
    "an alert asks to shut down; Cancel leaves the desktop as it was (Shut Down itself: accounts-census-journey.mjs)",
  ),
  R(
    "apple.lock-screen",
    "menu:Apple",
    "menuitem",
    "Lock Screen",
    "enabled for a person's account (locking and unlocking: accounts-census-journey.mjs)",
  ),
  R(
    "apple.log-out",
    "menu:Apple",
    "menuitem",
    "/Log Out .+…/",
    "names the account and is enabled (logging out: accounts-census-journey.mjs)",
    { notes: "kind: Log Out <full name>…" },
  ),
];

const pane = (id, item, paneId, state) =>
  R(id, state, "menuitem", item, `System Preferences opens on its ${paneId} pane`, {
    pane: paneId,
  });
const statusRows = [
  R("status.time-machine", "menu bar extras", "menuitem", "Time Machine", "its menu opens"),
  R(
    "status.time-machine.latest-backup-none",
    "status:Time Machine",
    "menuitem",
    "Latest Backup: None",
    "unavailable:the statement itself (true: no backup exists on this desktop)",
    { statement: true },
  ),
  R(
    "status.time-machine.no-disk",
    "status:Time Machine",
    "menuitem",
    "This desktop has no Time Machine disk.",
    "unavailable:the statement itself",
    { statement: true },
  ),
  R(
    "status.time-machine.back-up-now",
    "status:Time Machine",
    "menuitem",
    "Back Up Now",
    "unavailable:This desktop has no Time Machine disk.",
    { dimmed: "This desktop has no Time Machine disk." },
  ),
  R(
    "status.time-machine.enter-time-machine",
    "status:Time Machine",
    "menuitem",
    "Enter Time Machine",
    "unavailable:This desktop has no Time Machine disk.",
    { dimmed: "This desktop has no Time Machine disk." },
  ),
  pane(
    "status.time-machine.open-preferences",
    "Open Time Machine Preferences…",
    "time-machine",
    "status:Time Machine",
  ),
  R("status.wi-fi", "menu bar extras", "menuitem", "Wi-Fi", "its menu opens"),
  R(
    "status.wi-fi.network",
    "status:Wi-Fi",
    "menuitem",
    "/Network: (Connected|Offline)/",
    "unavailable:the statement itself, true to navigator.onLine",
    { statement: true, notes: "kind: the network state" },
  ),
  R(
    "status.wi-fi.reports-only",
    "status:Wi-Fi",
    "menuitem",
    "/The browser reports only whether it is online\\.|Quality: like /",
    "unavailable:the statement itself",
    { statement: true },
  ),
  R(
    "status.wi-fi.turn-off",
    "status:Wi-Fi",
    "menuitem",
    "Turn Wi-Fi Off",
    "unavailable:A web page cannot switch Wi-Fi.",
    { dimmed: "A web page cannot switch Wi-Fi." },
  ),
  R(
    "status.wi-fi.cannot-switch",
    "status:Wi-Fi",
    "menuitem",
    "A web page cannot switch Wi-Fi.",
    "unavailable:the statement itself",
    { statement: true },
  ),
  pane("status.wi-fi.open-preferences", "Open Network Preferences…", "network", "status:Wi-Fi"),
  R("status.airplay", "menu bar extras", "menuitem", "AirPlay", "its menu opens"),
  R(
    "status.airplay.off",
    "status:AirPlay",
    "menuitem",
    "AirPlay: Off",
    "unavailable:the statement itself (true: the desktop has no AirPlay)",
    { statement: true },
  ),
  pane(
    "status.airplay.open-preferences",
    "Open Displays Preferences…",
    "displays",
    "status:AirPlay",
  ),
  R("status.battery", "menu bar extras", "menuitem", "Battery", "its menu opens"),
  R(
    "status.battery.state",
    "status:Battery",
    "menuitem",
    "/Battery: \\d+%|Battery status unknown/",
    "unavailable:the statement itself, true to navigator.getBattery where the engine has it, unknown where not",
    { statement: true, notes: "kind: the battery state" },
  ),
  R(
    "status.battery.detail",
    "status:Battery",
    "menuitem",
    "/Power Source: (Power Adapter|Battery)|This browser does not report the battery\\./",
    "unavailable:the statement itself, true to the browser",
    { statement: true, notes: "kind: the power source, or why it is unknown" },
  ),
  R(
    "status.battery.show-percentage",
    "status:Battery",
    "menuitemcheckbox",
    "Show Percentage",
    "where the engine reports the battery: the level shows beside the glyph; elsewhere dimmed under This browser does not report the battery.",
  ),
  R(
    "status.battery.show-percentage-kept",
    "status:Battery",
    "menuitemcheckbox",
    "Show Percentage",
    "kept for the account across a reload and a real restart; a second account's is off",
    { persists: "restart", phase: "restart-check" },
  ),
  pane(
    "status.battery.open-preferences",
    "Open Energy Saver Preferences…",
    "energy-saver",
    "status:Battery",
  ),
  R(
    "status.clock",
    "menu bar extras",
    "menuitem",
    "/Clock, \\w{3} \\d{1,2}:\\d{2} (AM|PM)/",
    "shows the browser's local day and time; its menu opens",
    { notes: "kind: the clock" },
  ),
  pane(
    "status.clock.open-preferences",
    "Open Date & Time Preferences…",
    "date-and-time",
    "status:Clock",
  ),
  R(
    "status.user",
    "menu bar extras",
    "menuitem",
    "/.+/",
    "names the signed-in account's full name; its menu opens",
    { notes: "kind: the account's full name (one item)" },
  ),
  R(
    "status.user.login-window",
    "status:user",
    "menuitem",
    "Login Window…",
    "the login window shows over the session; Cancel returns to the desktop",
  ),
  pane(
    "status.user.users-and-groups",
    "Users & Groups Preferences…",
    "users-and-groups",
    "status:user",
  ),
  R(
    "status.spotlight",
    "menu bar extras",
    "menuitem",
    "Spotlight",
    "shows Spotlight's search field; a second click hides it",
  ),
  R("status.siri", "menu bar extras", "menuitem", "Siri", "shows Siri; a second click hides it"),
  R(
    "status.notification-center",
    "menu bar extras",
    "menuitem",
    "Notification Center",
    "shows Notification Center; a second click hides it",
  ),
];

const windowRows = [
  R(
    "window.bring-all-to-front-several",
    "menu:Window (Calculator)",
    "menuitem",
    "Bring All to Front",
    "Calculator's window, behind Console, comes in front of it with its Paper Tape still key",
    {
      how: "Calculator's Paper Tape key, Calculator's window behind Console; Window > Bring All to Front",
    },
  ),
];

// The menu bar's commands from the keyboard (Command is Control off Apple platforms, as on Linux, where these run), an
// application opened from a menu coming in front, and the menu bar over a full-screen window (R2 bundle 02).
const NOT_TYPABLE =
  "n/a:off Apple platforms Command is the Control key, so a key equivalent naming Control as well cannot be typed (macalicious/lib/menu-key-commands); its menu item is verified";
const key = (id, name, expected, how) =>
  R(`key.${id}`, "keyboard", "shortcut", name, expected, { how });
const commandRows = [
  R(
    "go.applications.activates",
    "dock",
    "button",
    "Calculator",
    "opened while Finder's window is key, the application comes in front, key, and the menu bar names it",
    { how: "Finder's window key; Calculator from the Dock" },
  ),
  key(
    "hide-others",
    "⌥⌘H",
    "other applications' windows go to the Dock; the front one's stay",
    "Console key, Calculator open; Control+Alt+H",
  ),
  key("hide", "⌘H", "the front application's windows go to the Dock", "Console key; Control+H"),
  key("minimize", "⌘M", "the key window goes to the Dock", "Console key; Control+M"),
  key("close-window", "⌘W", "the key window closes", "Console key; Control+W"),
  key("quit", "⌘Q", "every window of the front application closes", "Console key; Control+Q"),
  key(
    "force-quit",
    "⌥⌘⎋",
    "the Force Quit Applications window opens",
    "a window key; Control+Alt+Escape",
  ),
  key("enter-full-screen", "⌃⌘F", NOT_TYPABLE, "Control+Command+F"),
  key("lock-screen", "⌃⌘Q", NOT_TYPABLE, "Control+Command+Q"),
  key(
    "log-out",
    "⇧⌘Q",
    "the account logs out to the login window; signing in from its list brings the desktop back",
    "a window key; Control+Shift+Q",
  ),
  R(
    "full-screen.menu-bar",
    "full-screen window (Console)",
    "menu bar",
    "top edge",
    "the menu bar is covered; the pointer at the top edge brings it in over the window; View > Exit Full Screen returns the window to its frame",
    { how: "Console's green button; the pointer to the top edge; View > Exit Full Screen" },
  ),
];

// One click on a menu title opens its menu: no second click (R2 bundle 02 rev 2; R6's "first click opens nothing").
const clickRows = [
  R(
    "menu.switch-by-click",
    "menu bar (Console)",
    "menuitem",
    "Window",
    "with View's menu open, one click on Window shows Window's menu (the pointer opens it on the way; the click closes nothing)",
    { how: "Console key; View clicked open; the mouse moved to Window and clicked once, no retry" },
  ),
  R(
    "menu.click-after-dock-restore",
    "menu bar (Console)",
    "menuitem",
    "Window",
    "after Window > Minimize and the window back from its Dock tile, one click on Window shows its menu",
    {
      how: "Console key; Window > Minimize; the window's Dock tile clicked; Window clicked once, no retry",
    },
  ),
];

// A second Finder window, and a fixed-size window's dimmed zoom button saying why (R2 bundle 06).
const finderWindowRows = [
  R(
    "finder.new-finder-window",
    "menu:File (Finder)",
    "menuitem",
    "New Finder Window",
    "a second Finder window opens, key, its folder its own: going to Documents in it leaves the first where it was",
    { how: "Finder's window key; File > New Finder Window; Documents in the new window's sidebar" },
  ),
  R(
    "finder.second-window",
    "window (Finder, the second)",
    "window",
    "Finder",
    "the second Finder window moves by its title bar, resizes by its edge, goes behind the first when the first is clicked, and closes alone",
    {
      how: "its title bar dragged; its right edge dragged 60 pt in; the first window clicked; its close button",
    },
  ),
  key(
    "new-finder-window",
    "⌘N",
    "a Finder window opens, another while one is open",
    "Finder's window key; Control+N",
  ),
  R(
    "window.fixed-size-reason",
    "window (About This Mac)",
    "button",
    "Zoom",
    "dimmed, giving its reason This window has a fixed size (its tooltip and accessible description)",
    { how: "Apple > About This Mac; its green button read" },
  ),
];

const rows = [
  ...finderRows,
  ...appleRows,
  ...statusRows,
  ...windowRows,
  ...commandRows,
  ...clickRows,
  ...finderWindowRows,
];

await census("desktop", rows, async (kit) => {
  const { base, run, phase, newPage, check, skip, browserName } = kit;
  const main = person(run, "desk", "Desk");
  const other = person(run, "deskb", "Desk B");
  const page = await newPage("desktop");
  const batteryReported = browserName === "chromium" || browserName === "chrome";

  /** The statements and dimmed rows of the menu `title` (opened by `open`), each with its reason in the same menu. */
  async function statements(list, open) {
    const menu = await open();
    for (const row of list) {
      const named = row.name.startsWith("/")
        ? new RegExp(`^(${row.name.slice(1, -1)})$`)
        : row.name;
      const dimmed = await dimmedIn(menu, named);
      const reason = row.dimmed ? await dimmedIn(menu, row.dimmed) : true;
      const shown = row.name.startsWith("/")
        ? ((await menu.getByRole("menuitem", { name: named }).first().textContent()) ?? "").trim()
        : row.name;
      skip(
        row.id,
        row.expected_outcome.startsWith("unavailable:the statement")
          ? `unavailable:${shown}`
          : row.expected_outcome,
        dimmed && reason,
      );
    }
    await closeMenus(page);
  }

  /**
   * One section of the journey: a failure in it (a control missing, a step timing out) is a problem of the run and leaves
   * its unchecked rows "not reached", and the next section starts on a desktop with no menu and no window open.
   */
  const section = async (name, fn) => {
    try {
      await fn();
    } catch (error) {
      kit.problems.push(
        `section ${name} stopped: ${String(error?.message ?? error)
          .split("\n")
          .slice(0, 3)
          .join(" | ")}`,
      );
      await closeMenus(page).catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      await closeAll(page).catch(() => {});
    }
  };

  if (phase !== "restart-check") {
    await createAccount(page, base, main);

    // A. Finder in front, no window.
    for (const title of ["Finder", "File", "Edit", "View", "Go", "Window", "Help"]) {
      const list = finderRows.filter(
        (row) =>
          row.window_or_state === `menu:${title}` && (row.statement || row.dimmed || row.noWindow),
      );
      if (list.length === 0) continue;
      const menu = await menuOpen(page, title);
      for (const row of list) {
        const dimmed = await dimmedIn(menu, row.name);
        const reason = row.dimmed ? await dimmedIn(menu, row.dimmed) : true;
        const none = row.noWindow
          ? (await page.locator(".mac-managed-window").count()) === 0
          : true;
        skip(
          row.id,
          row.statement ? `unavailable:${row.name}` : row.expected_outcome,
          dimmed && reason && none,
        );
      }
      await closeMenus(page);
    }
    {
      const menu = await menuOpen(page, "Finder");
      await menuItem(menu, "Services").hover();
      await page.waitForTimeout(500);
      const sub = page.locator('[role="menu"][data-open]').last();
      const none = await dimmedIn(sub, "No Services Apply");
      check("desktop.finder.services", none);
      skip("desktop.finder.no-services-apply", "unavailable:No Services Apply", none);
      await closeMenus(page);
    }
    {
      await menuItem(await menuOpen(page, "Help"), "Finder Help").click();
      const viewer = managedOf(page, "help-viewer");
      const shown = await viewer.waitFor({ timeout: 8_000 }).then(
        () => true,
        () => false,
      );
      check("desktop.help.finder-help", shown, shown ? "Help Viewer opened" : "no Help Viewer");
      if (shown) await viewer.getByRole("button", { name: "Close" }).first().click();
    }
    {
      await menuItem(await menuOpen(page, "Finder"), "About Finder").click();
      const about = page
        .locator(".mac-desktop-shell-about, .mac-desktop-shell-about-finder")
        .last();
      const shown = await about.waitFor({ timeout: 4_000 }).then(
        () => true,
        () => false,
      );
      const text = shown ? (await about.innerText()).replace(/\s+/g, " ") : "";
      if (shown) await about.getByRole("button", { name: "Close" }).first().click();
      check(
        "desktop.finder.about-finder",
        shown && /Finder/.test(text) && /Version/.test(text) && (await about.count()) === 0,
        text.slice(0, 60),
      );
    }
    {
      await menuItem(await menuOpen(page, "Finder"), "Preferences…").click();
      const prefs = page.locator(".mac-preferences-window").first();
      const shown = await prefs.waitFor({ timeout: 5_000 }).then(
        () => true,
        () => false,
      );
      const tabs = shown ? await prefs.getByRole("tab").allTextContents() : [];
      if (shown) await prefs.getByRole("button", { name: "Close" }).first().click();
      const closed = await prefs.waitFor({ state: "hidden", timeout: 3_000 }).then(
        () => true,
        () => false,
      );
      check("desktop.finder.preferences", shown && tabs.length > 0 && closed, tabs.join(", "));
    }
    {
      let menu = await menuOpen(page, "Go");
      await menuItem(menu, "Applications").hover();
      await page.waitForTimeout(500);
      let sub = page.locator('[role="menu"][data-open]').last();
      const names = (await sub.getByRole("menuitem").allTextContents()).map((n) => n.trim());
      await closeMenus(page);
      let opened = 0;
      const picks = [names[0], names[Math.floor(names.length / 2)], names.at(-1)];
      for (const pick of picks) {
        menu = await menuOpen(page, "Go");
        await menuItem(menu, "Applications").hover();
        await page.waitForTimeout(500);
        sub = page.locator('[role="menu"][data-open]').last();
        const before = await page.locator(".mac-managed-window").count();
        await menuItem(sub, pick).click();
        await page.waitForTimeout(1500);
        if ((await page.locator(".mac-managed-window").count()) > before) opened += 1;
        await closeAll(page);
      }
      check("desktop.go.applications", names.length > 20, `${names.length} applications`);
      check("desktop.go.applications.app", opened === 3, `${opened}/3 of ${picks.join(", ")}`);
    }

    // B. The Apple menu, and Recent Items as it fills.
    const opens = [
      ["desktop.apple.about-this-mac", "About This Mac", "about-this-mac"],
      ["desktop.apple.system-preferences", "System Preferences…", "system-preferences"],
      ["desktop.apple.app-store", "App Store…", "app-store"],
      ["desktop.apple.force-quit", "Force Quit…", "force-quit"],
    ];
    for (const [id, item, windowId] of opens) {
      await menuItem(await menuOpen(page, "Apple"), item).click();
      const shown = await managedOf(page, windowId)
        .waitFor({ timeout: 8_000 })
        .then(
          () => true,
          () => false,
        );
      check(id, shown);
      await closeAll(page);
    }
    {
      const menu = await menuOpen(page, "Apple");
      await menuItem(menu, "Recent Items").hover();
      await page.waitForTimeout(500);
      const sub = page.locator('[role="menu"][data-open]').last();
      const listed = (await sub.getByRole("menuitem").allTextContents()).map((n) => n.trim());
      // Newest first: Force Quit Applications was opened last, then App Store, System Preferences, About This Mac.
      const want = ["Force Quit Applications", "App Store", "System Preferences", "About This Mac"];
      const order = want.map((name) => listed.indexOf(name));
      check(
        "desktop.apple.recent-items",
        order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])),
        listed.join(", ").slice(0, 120),
      );
      skip(
        "desktop.apple.recent-items.applications",
        "unavailable:Applications (the heading of the list)",
        await dimmedIn(sub, "Applications"),
      );
      await menuItem(sub, "About This Mac").click();
      const reopened = await managedOf(page, "about-this-mac")
        .waitFor({ timeout: 8_000 })
        .then(
          () => true,
          () => false,
        );
      check("desktop.apple.recent-items.app", reopened);
      await closeAll(page);
    }
    {
      let menu = await menuOpen(page, "Apple");
      await menuItem(menu, "Recent Items").hover();
      await page.waitForTimeout(500);
      let sub = page.locator('[role="menu"][data-open]').last();
      await menuItem(sub, "Clear Menu").click();
      await page.waitForTimeout(500);
      menu = await menuOpen(page, "Apple");
      await menuItem(menu, "Recent Items").hover();
      await page.waitForTimeout(500);
      sub = page.locator('[role="menu"][data-open]').last();
      const none = await dimmedIn(sub, "No Recent Applications");
      const clearDimmed = await dimmedIn(sub, "Clear Menu");
      check("desktop.apple.recent-items.clear-menu", none && clearDimmed);
      skip(
        "desktop.apple.recent-items.no-recent-applications",
        "unavailable:No Recent Applications",
        none,
      );
      await closeMenus(page);
    }
    {
      const menu = await menuOpen(page, "Apple");
      const lock = !(await dimmedIn(menu, "Lock Screen"));
      const logOut = menu.getByRole("menuitem", { name: /^Log Out .+…$/ });
      const named =
        ((await logOut.textContent()) ?? "").includes("Desk") &&
        !(await dimmedIn(menu, /^Log Out .+…$/));
      check("desktop.apple.lock-screen", lock);
      check("desktop.apple.log-out", named);
      await closeMenus(page);
    }
    for (const [id, item, message] of [
      ["desktop.apple.restart", "Restart…", /restart your computer now/],
      ["desktop.apple.shut-down", "Shut Down…", /shut down your computer now/],
    ]) {
      await menuItem(await menuOpen(page, "Apple"), item).click();
      const alert = page
        .getByRole("alertdialog")
        .or(page.getByRole("dialog"))
        .filter({ hasText: message })
        .first();
      const shown = await alert.waitFor({ timeout: 5_000 }).then(
        () => true,
        () => false,
      );
      if (shown) await alert.getByRole("button", { name: "Cancel" }).click();
      await page.waitForTimeout(400);
      check(
        id,
        shown && (await alert.count()) === 0 && (await menuTitle(page, "Desk").isVisible()),
      );
    }
    {
      await menuItem(await menuOpen(page, "Apple"), "Sleep").click();
      const dark = page.getByRole("img", { name: "Display asleep" });
      const asleep = await dark.waitFor({ timeout: 5_000 }).then(
        () => true,
        () => false,
      );
      await page.waitForTimeout(200);
      await page.keyboard.press("Shift");
      const locked = await passwordField(page)
        .waitFor({ timeout: 8_000 })
        .then(
          () => true,
          () => false,
        );
      if (locked) {
        await passwordField(page).fill(main.password);
        await passwordField(page).press("Enter");
      }
      const back = await menuTitle(page, "Desk")
        .waitFor({ timeout: 10_000 })
        .then(
          () => true,
          () => false,
        );
      check(
        "desktop.apple.sleep",
        asleep && locked && back,
        `asleep=${asleep} locked=${locked} unlocked=${back}`,
      );
    }

    // C. The status menus.
    const extras = page.getByRole("menubar", { name: "Status menus" });
    const openExtra = async (name) => {
      await closeMenus(page);
      await extras.getByRole("menuitem", { name }).first().click();
      const menu = page.locator('[role="menu"][data-open]').last();
      await menu.waitFor({ timeout: 4_000 });
      return menu;
    };
    const paneRow = async (id, extra, item, paneId) => {
      await menuItem(await openExtra(extra), item).click();
      const shown = await preferencesShow(page, paneId);
      const title = await managedOf(page, "system-preferences")
        .locator('[role="region"]')
        .first()
        .getAttribute("aria-label")
        .catch(() => null);
      check(id, shown, shown ? "" : `System Preferences shows ${title ?? "nothing"}`);
    };
    for (const [extra, prefix] of [
      ["Time Machine", "status.time-machine"],
      ["Wi-Fi", "status.wi-fi"],
      ["AirPlay", "status.airplay"],
      ["Battery", "status.battery"],
    ]) {
      const menu = await openExtra(extra);
      check(`desktop.${prefix}`, await menu.isVisible());
      await closeMenus(page);
      const list = statusRows.filter(
        (row) => row.window_or_state === `status:${extra}` && (row.statement || row.dimmed),
      );
      await statements(list, () => openExtra(extra));
    }
    {
      // The statements are true: the network state as navigator.onLine has it; the battery as navigator.getBattery does.
      const online = await page.evaluate(() => navigator.onLine);
      const wifi = await openExtra("Wi-Fi");
      const network = (
        (await wifi.getByRole("menuitem", { name: /^Network: / }).textContent()) ?? ""
      ).trim();
      await closeMenus(page);
      if (network !== (online ? "Network: Connected" : "Network: Offline"))
        check("desktop.status.wi-fi.network", false, `${network} while onLine=${online}`);
      const battery = await page.evaluate(async () =>
        navigator.getBattery
          ? navigator
              .getBattery()
              .then((b) => ({ level: Math.round(b.level * 100), charging: b.charging }))
          : null,
      );
      const menu = await openExtra("Battery");
      const state = (
        (await menu
          .getByRole("menuitem", { name: /^Battery/ })
          .first()
          .textContent()) ?? ""
      ).trim();
      if (battery ? state !== `Battery: ${battery.level}%` : state !== "Battery status unknown")
        check(
          "desktop.status.battery.state",
          false,
          `${state} while the browser reports ${JSON.stringify(battery)}`,
        );
      const percentage = menuItem(menu, "Show Percentage");
      if (batteryReported && battery) {
        await percentage.click();
        await page.waitForTimeout(400);
        const title = (
          (await extras.getByRole("menuitem", { name: "Battery" }).textContent()) ?? ""
        ).trim();
        check(
          "desktop.status.battery.show-percentage",
          title === `${battery.level}%`,
          `title "${title}"`,
        );
      } else {
        const reason = await dimmedIn(menu, "This browser does not report the battery.");
        skip(
          "desktop.status.battery.show-percentage",
          "unavailable:This browser does not report the battery.",
          (await dimmedIn(menu, "Show Percentage")) && reason,
        );
        await closeMenus(page);
      }
    }
    await paneRow(
      "desktop.status.time-machine.open-preferences",
      "Time Machine",
      "Open Time Machine Preferences…",
      "time-machine",
    );
    await paneRow(
      "desktop.status.wi-fi.open-preferences",
      "Wi-Fi",
      "Open Network Preferences…",
      "network",
    );
    await paneRow(
      "desktop.status.airplay.open-preferences",
      "AirPlay",
      "Open Displays Preferences…",
      "displays",
    );
    await paneRow(
      "desktop.status.battery.open-preferences",
      "Battery",
      "Open Energy Saver Preferences…",
      "energy-saver",
    );
    await closeAll(page);
    {
      const clock = extras.getByRole("menuitem", { name: /^Clock, / });
      const label = (await clock.getAttribute("aria-label")) ?? "";
      const now = await page.evaluate(() =>
        [0, -60000, 60000].map((d) => {
          const t = new Date(Date.now() + d);
          return `Clock, ${t.toLocaleDateString("en-US", { weekday: "short" })} ${t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
        }),
      );
      await clock.click();
      const opened = await page
        .locator('[role="menu"][data-open]')
        .last()
        .waitFor({ timeout: 4_000 })
        .then(
          () => true,
          () => false,
        );
      await closeMenus(page);
      check("desktop.status.clock", now.includes(label) && opened, `${label} vs ${now[0]}`);
      await paneRow(
        "desktop.status.clock.open-preferences",
        /^Clock, /,
        "Open Date & Time Preferences…",
        "date-and-time",
      );
      await closeAll(page);
    }
    {
      const user = await openExtra("Desk");
      check("desktop.status.user", await user.isVisible());
      await menuItem(user, "Login Window…").click();
      const tiles = page.getByRole("group", { name: "Users" });
      const shown = await tiles.waitFor({ timeout: 8_000 }).then(
        () => true,
        () => false,
      );
      if (shown) await page.getByRole("button", { name: "Cancel" }).click();
      const back = await menuTitle(page, "Desk")
        .waitFor({ timeout: 8_000 })
        .then(
          () => true,
          () => false,
        );
      check("desktop.status.user.login-window", shown && back);
      await paneRow(
        "desktop.status.user.users-and-groups",
        "Desk",
        "Users & Groups Preferences…",
        "users-and-groups",
      );
      await closeAll(page);
    }
    for (const [id, name, shownBy] of [
      [
        "desktop.status.spotlight",
        "Spotlight",
        page.getByRole("combobox", { name: "Spotlight Search" }),
      ],
      ["desktop.status.siri", "Siri", page.getByRole("textbox", { name: "Type to Siri" })],
      [
        "desktop.status.notification-center",
        "Notification Center",
        page.getByRole("tab", { name: "Today" }),
      ],
    ]) {
      await extras.getByRole("menuitem", { name }).click();
      const shown = await shownBy.waitFor({ timeout: 5_000 }).then(
        () => true,
        () => false,
      );
      await extras.getByRole("menuitem", { name }).click();
      const hidden = await shownBy.waitFor({ state: "hidden", timeout: 5_000 }).then(
        () => true,
        () => false,
      );
      check(id, shown && hidden, `shown=${shown} hidden=${hidden}`);
    }

    // D. Bring All to Front across Calculator's two windows, with Console between them.
    await section("D bring all to front", async () => {
      const calculator = await openFromDock(page, "Calculator", "calculator");
      if ((await managedOf(page, "calculator:tape").count()) === 0) {
        await calculator.click({ position: { x: 100, y: 60 } });
        await page.keyboard.press("ControlOrMeta+t");
      }
      const tape = managedOf(page, "calculator:tape");
      await tape.waitFor({ timeout: 5_000 });
      const consoleWin = await openFromDock(page, "Console", "console");
      // Console moved to the right by its title bar; then Calculator's window raised (a press on a point of its own),
      // Console raised over it, and the Paper Tape raised last, key: Calculator in front, its window behind Console.
      await moveTo(page, consoleWin, 760, 300);
      await clickOwn(page, calculator);
      await clickOwn(page, consoleWin);
      await clickOwn(page, tape);
      await page.waitForTimeout(300);
      const before = {
        calc: await frameOf(calculator),
        console: await frameOf(consoleWin),
        tape: await frameOf(tape),
      };
      const behind = before.calc.z < before.console.z && before.tape.state === "key";
      const menu = await menuOpen(page, "Window");
      await menuItem(menu, "Bring All to Front").click();
      await page.waitForTimeout(400);
      const after = {
        calc: await frameOf(calculator),
        console: await frameOf(consoleWin),
        tape: await frameOf(tape),
      };
      check(
        "desktop.window.bring-all-to-front-several",
        behind &&
          after.calc.z > after.console.z &&
          after.tape.z > after.console.z &&
          after.tape.state === "key",
        `before z calc ${before.calc.z} console ${before.console.z} tape ${before.tape.z} (${before.tape.state}); after ${after.calc.z}/${after.console.z}/${after.tape.z} (${after.tape.state})`,
      );
      await closeAll(page);
    });

    // E1. An application opened while a Finder window is key comes in front, key, and the menu bar names it. Finder's own
    // Go > Applications goes to the folder, so this is opened from the Dock.
    await section("E1 opens over a key window", async () => {
      await dockButton(page, "Finder").click();
      const finderWin = managedOf(page, "finder");
      await finderWin.waitFor({ timeout: 10_000 });
      await clickOwn(page, finderWin);
      await dockButton(page, "Calculator").click();
      const calc = managedOf(page, "calculator");
      await calc.waitFor({ timeout: 10_000 });
      // Once the menu has faded out and the keyboard has settled.
      await page.waitForTimeout(900);
      const c = await frameOf(calc);
      const f = await frameOf(finderWin);
      const named = (
        (await page.getByRole("menubar").first().getByRole("menuitem").nth(1).textContent()) ?? ""
      ).trim();
      check(
        "desktop.go.applications.activates",
        c.state === "key" && f.state !== "key" && c.z > f.z && named === "Calculator",
        `calculator ${c.state} z ${c.z}, finder ${f.state} z ${f.z}, menu bar names ${named}`,
      );
      await closeAll(page);
    });

    // E2. The key equivalents, with the real keyboard, each with the key window's frame holding the keyboard.
    await section("E2 key equivalents", async () => {
      const consoleWin = await openFromDock(page, "Console", "console");
      const calculator = await openFromDock(page, "Calculator", "calculator");
      const minimized = async (m) => (await frameOf(m)).minimized;
      const press = async (keys) => {
        await page.keyboard.press(keys);
        await page.waitForTimeout(450);
      };
      await clickOwn(page, consoleWin);
      await press("Control+Alt+h");
      check(
        "desktop.key.hide-others",
        (await minimized(calculator)) && !(await minimized(consoleWin)),
      );
      await press("Control+h");
      const hidden = await minimized(consoleWin);
      await dockButton(page, "Console").click();
      await page.waitForTimeout(500);
      check("desktop.key.hide", hidden && !(await minimized(consoleWin)));
      await clickOwn(page, consoleWin);
      await press("Control+m");
      const mini = await minimized(consoleWin);
      await dockButton(page, "Console").click();
      await page.waitForTimeout(500);
      check("desktop.key.minimize", mini && !(await minimized(consoleWin)));
      await clickOwn(page, consoleWin);
      await press("Control+w");
      check("desktop.key.close-window", (await consoleWin.count()) === 0);
      await openFromDock(page, "Console", "console");
      await clickOwn(page, consoleWin);
      await press("Control+q");
      check("desktop.key.quit", (await consoleWin.count()) === 0);
      // Calculator back from the Dock (key, with the keyboard), then Force Quit… and Log Out.
      await dockButton(page, "Calculator").click();
      await page.waitForTimeout(500);
      await clickOwn(page, calculator);
      await press("Control+Alt+Escape");
      const forceQuit = await managedOf(page, "force-quit")
        .waitFor({ timeout: 5_000 })
        .then(
          () => true,
          () => false,
        );
      check("desktop.key.force-quit", forceQuit);
      skip("desktop.key.enter-full-screen", NOT_TYPABLE);
      skip("desktop.key.lock-screen", NOT_TYPABLE);
      await closeAll(page);
      await openFromDock(page, "Calculator", "calculator");
      await clickOwn(page, calculator);
      await press("Control+Shift+q");
      const tile = page
        .getByRole("group", { name: "Users" })
        .getByRole("button", { name: "Desk", exact: true });
      const out = await tile.waitFor({ timeout: 10_000 }).then(
        () => true,
        () => false,
      );
      if (out) {
        await tile.click();
        await passwordField(page).fill(main.password);
        await passwordField(page).press("Enter");
      }
      const back = await menuTitle(page, "Desk")
        .waitFor({ timeout: 20_000 })
        .then(
          () => true,
          () => false,
        );
      check("desktop.key.log-out", out && back, `login window=${out}, back=${back}`);
      await closeAll(page);
    });

    // E3. A full-screen window and the menu bar: covered, brought in at the top edge, and View > Exit Full Screen.
    await section("E3 full screen menu bar", async () => {
      const consoleWin = await openFromDock(page, "Console", "console");
      await consoleWin.getByRole("button", { name: "Enter Full Screen" }).click();
      await page.waitForTimeout(600);
      // Read only: which element a press on the View title would reach (the bar is inert while covered).
      const view = page
        .locator('.mac-desktop-shell-menu-bar [role="menuitem"]', { hasText: /^View$/ })
        .first();
      const reachesBar = async () => {
        const b = await view.boundingBox();
        return page.evaluate(
          ([x, y]) =>
            Boolean(document.elementFromPoint(x, y)?.closest(".mac-desktop-shell-menu-bar")),
          [b.x + b.width / 2, b.y + b.height / 2],
        );
      };
      const covered = !(await reachesBar());
      await page.mouse.move(700, 300);
      await page.mouse.move(700, 1, { steps: 6 });
      await page.waitForTimeout(400);
      const revealed = await reachesBar();
      let exited = false;
      if (revealed) {
        await view.click();
        const menu = openMenu(page);
        await menu.waitFor({ timeout: 4_000 });
        await menuItem(menu, "Exit Full Screen").click();
        await page.waitForTimeout(600);
        exited = !(await frameOf(consoleWin)).fullScreen;
      }
      check(
        "desktop.full-screen.menu-bar",
        covered && revealed && exited,
        `covered=${covered} revealed=${revealed} exited=${exited}`,
      );
      await closeAll(page);
    });

    // E4. One click on a title opens its menu: switching from an open menu by a click, and after the Dock tile brought the
    // window back (Window > Minimize closed its menu by taking its application out of the menu bar). Each click is one
    // real click at the title's centre; nothing is retried.
    await section("E4 one click opens a menu", async () => {
      const consoleWin = await openFromDock(page, "Console", "console");
      const clickTitle = async (name) => {
        const box = await menuTitle(page, name).boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      };
      const showing = (item) =>
        page
          .locator('[role="menu"][data-open]')
          .getByRole("menuitem", { name: item, exact: true })
          .first()
          .waitFor({ timeout: 2_000 })
          .then(
            () => true,
            () => false,
          );
      await clickOwn(page, consoleWin);
      await clickTitle("View");
      const viewOpen = await showing("Enter Full Screen");
      await page.waitForTimeout(300);
      await clickTitle("Window");
      const switched = await showing("Bring All to Front");
      check(
        "desktop.menu.switch-by-click",
        viewOpen && switched,
        `View open=${viewOpen}, Window's menu after one click=${switched}`,
      );
      await closeMenus(page);
      await clickTitle("Window");
      const windowOpen = await showing("Minimize");
      if (windowOpen)
        await page
          .locator('[role="menu"][data-open]')
          .getByRole("menuitem", { name: "Minimize", exact: true })
          .first()
          .click();
      await page.waitForTimeout(700);
      await page
        .getByRole("toolbar", { name: "Dock" })
        .getByRole("button", { name: /minimized window$/ })
        .first()
        .click();
      await page.waitForTimeout(600);
      await clickTitle("Window");
      const reopened = await showing("Bring All to Front");
      check(
        "desktop.menu.click-after-dock-restore",
        windowOpen && reopened,
        `minimized from Window=${windowOpen}, Window's menu after one click=${reopened}`,
      );
      await closeMenus(page);
      await closeAll(page);
    });

    // E5. A second Finder window (File > New Finder Window, and Control+N), managed like the first, its folder its own;
    // and a fixed-size window's dimmed zoom button giving its reason.
    await section("E5 new finder window", async () => {
      await dockButton(page, "Finder").click();
      const first = managedOf(page, "finder");
      await first.waitFor({ timeout: 10_000 });
      await clickOwn(page, first);
      const titleOf = (frame) =>
        frame
          .locator(".mac-title-bar")
          .first()
          .innerText()
          .then((t) => t.replace(/\s+/g, " ").trim())
          .catch(() => "");
      const firstBefore = await titleOf(first);
      await menuItem(await menuOpen(page, "File"), "New Finder Window").click();
      const second = managedOf(page, "finder:2");
      const opened = await second.waitFor({ timeout: 8_000 }).then(
        () => true,
        () => false,
      );
      await page.waitForTimeout(400);
      const keyed = opened && (await frameOf(second)).state === "key";
      if (opened) await second.getByText("Documents", { exact: true }).first().click();
      await page.waitForTimeout(600);
      const secondTitle = opened ? await titleOf(second) : "";
      const firstAfter = await titleOf(first);
      check(
        "desktop.finder.new-finder-window",
        opened && keyed && /Documents/.test(secondTitle) && firstAfter === firstBefore,
        `opened=${opened} key=${keyed}; second "${secondTitle}"; first "${firstBefore}" then "${firstAfter}"`,
      );
      if (opened) {
        const moved = await moveTo(page, second, 300, 140);
        const handle = second.locator('.mac-managed-window-resize[data-edge="e"]');
        const box = await handle.boundingBox();
        const before = await frameOf(second);
        await drag(page, box.x + box.width / 2, box.y + box.height / 2, -60, 0);
        await page.waitForTimeout(200);
        const after = await frameOf(second);
        await clickOwn(page, first);
        const stack = { first: await frameOf(first), second: await frameOf(second) };
        // The first window now covers the second: the second comes forward again by a press of its own before its close
        // button is clicked.
        await clickOwn(page, second);
        await second.getByRole("button", { name: "Close" }).first().click();
        await page.waitForTimeout(400);
        const closed = (await second.count()) === 0 && (await first.count()) === 1;
        check(
          "desktop.finder.second-window",
          Math.abs(moved.x - 300) < 2 &&
            Math.abs(moved.y - 140) < 2 &&
            Math.abs(after.width - (before.width - 60)) <= 2 &&
            stack.first.z > stack.second.z &&
            stack.first.state === "key" &&
            closed,
          `moved to ${moved.x},${moved.y}; width ${before.width} to ${after.width}; z ${stack.first.z}/${stack.second.z}, first ${stack.first.state}; closed alone=${closed}`,
        );
      } else check("desktop.finder.second-window", false, "no second window");
      await clickOwn(page, first);
      await page.keyboard.press("Control+n");
      const viaKey = await managedOf(page, "finder:2")
        .waitFor({ timeout: 6_000 })
        .then(
          () => true,
          () => false,
        );
      check(
        "desktop.key.new-finder-window",
        viaKey,
        `another Finder window after Control+N=${viaKey}`,
      );
      await closeAll(page);
      await menuItem(await menuOpen(page, "Apple"), "About This Mac").click();
      const about = managedOf(page, "about-this-mac");
      await about.waitFor({ timeout: 8_000 });
      const zoom = about.getByRole("button", { name: /^(Zoom|Enter Full Screen)$/ }).first();
      const reason = await zoom.getAttribute("title");
      const dimmed = await zoom.isDisabled();
      check(
        "desktop.window.fixed-size-reason",
        dimmed && reason === "This window has a fixed size",
        `dimmed=${dimmed}, reason "${reason}"`,
      );
      await closeAll(page);
    });

    // The marker the persistence check looks for, set last of the write phase (sections C and D opened other apps): About
    // This Mac, opened from the Apple menu, is the newest of Recent Items.
    await menuItem(await menuOpen(page, "Apple"), "About This Mac").click();
    await managedOf(page, "about-this-mac").waitFor({ timeout: 8_000 });
    await closeAll(page);
  }

  // E. Across a real restart (or a reload, with --phase all): the same account finds what it left; a second does not.
  if (phase !== "write") {
    if (phase === "restart-check") await signInOther(page, base, main);
    else await page.reload({ waitUntil: "load" });
    await menuTitle(page, "Desk").waitFor({ timeout: 20_000 });
    const recentOf = async (p) => {
      const menu = await menuOpen(p, "Apple");
      await menuItem(menu, "Recent Items").hover();
      await p.waitForTimeout(500);
      const listed = (
        await p.locator('[role="menu"][data-open]').last().getByRole("menuitem").allTextContents()
      ).map((n) => n.trim());
      await closeMenus(p);
      return listed;
    };
    const mine = await recentOf(page);
    const percentOf = async (p) =>
      (
        (await p
          .getByRole("menubar", { name: "Status menus" })
          .getByRole("menuitem", { name: "Battery" })
          .textContent()) ?? ""
      ).trim();
    const myPercent = await percentOf(page);
    const second = await newPage("desktop-b");
    await createAccount(second, base, other);
    const theirs = await recentOf(second);
    const theirPercent = await percentOf(second);
    check(
      "desktop.apple.recent-items.kept",
      mine[1] === "About This Mac" && theirs.includes("No Recent Applications"),
      `mine: ${mine.join(", ")}; second account: ${theirs.join(", ")}`,
    );
    if (batteryReported)
      check(
        "desktop.status.battery.show-percentage-kept",
        /^\d+%$/.test(myPercent) && theirPercent === "",
        `mine "${myPercent}", second account "${theirPercent}"`,
      );
    else
      skip(
        "desktop.status.battery.show-percentage-kept",
        "n/a:this engine does not report the battery, so Show Percentage is dimmed and nothing is kept",
      );
  }
});
