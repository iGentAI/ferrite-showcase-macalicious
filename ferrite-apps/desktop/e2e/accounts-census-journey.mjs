#!/usr/bin/env node
// The desktop's accounts (app `desktop`), part 1: a change of the person signed in loads the page once. Log Out, and a
// sign-in as another account of this browser over a desktop that was shown, end the page's session and load the page
// again; the page also tells the browser's other tabs on its session BroadcastChannel (`desktop-accounts.tsx`). Its own
// news used to reach its own listener, which read the session, found it changed and loaded the page a second time,
// cutting short the load the change had started (net::ERR_ABORTED on `/`, R2 bundle 04). On a fast server the first
// load usually committed before the second began, so the race showed only now and then: here a route of the test holds
// the page's own document 1.5 s, which keeps that window open every time. Every action is real mouse and keyboard input
// on accounts made at the login window; each load of the page's document is recorded with how it ended.
//
//   node e2e/accounts-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit [--out dir]

import {
  census,
  createAccount,
  menuItem,
  menuOpen,
  passwordField,
  person,
  userTile,
} from "./r2-census-kit.mjs";

const V = "accounts-census-journey.mjs";
/** How late the page's own document is served once both accounts' first desktops have loaded. */
const SLOW_MS = 1_500;

const R = (id, state, role, name, how, expected, notes = "") => ({
  id: `desktop.accounts.${id}`,
  app: "desktop",
  window_or_state: state,
  role,
  name,
  how_reached: how,
  expected_outcome: expected,
  verified_by: `${V} ${id}`,
  persists: "none",
  notes,
});

const rows = [
  R(
    "log-out.loads-once",
    "menu:Apple",
    "menuitem",
    "/Log Out .+…/",
    `Apple > Log Out <full name>… with the mouse, the page's document served ${SLOW_MS} ms late`,
    "the page loads again once, to the login window listing the account; no load of the page is cut short",
    "kind: Log Out <full name>…",
  ),
  R(
    "switch-user.loads-once",
    "status:user",
    "menuitem",
    "Switch One",
    `the user menu (Switch Two) > Switch One, then Switch One's password typed and Return, the page's document served ${SLOW_MS} ms late`,
    "the page loads again once, to Switch One's desktop; no load of the page is cut short",
    "another account used in this browser, by its full name",
  ),
];

await census("accounts", rows, async ({ base, run, newPage, check, allowed }) => {
  // Requests in flight when the page loads again are cut short by that load (the page's own doing); the loads of the
  // page's document itself are recorded below and asserted, a cut-short one failing its row.
  allowed.aborts = true;
  const page = await newPage("accounts");
  const one = person(run, "swone", "Switch One");
  const two = person(run, "swtwo", "Switch Two");
  const origin = new URL(base).origin;
  const isDocument = (request) => {
    if (!request.isNavigationRequest()) return false;
    const url = new URL(request.url());
    return url.origin === origin && url.pathname === "/";
  };
  /** Every load of the page's own document, in order: "pending", "loaded" or "cut short (<error>)". */
  const loads = [];
  page.on("request", (request) => {
    if (isDocument(request)) loads.push({ request, end: "pending" });
  });
  page.on("requestfinished", (request) => {
    const load = loads.find((entry) => entry.request === request);
    if (load) load.end = "loaded";
  });
  page.on("requestfailed", (request) => {
    const load = loads.find((entry) => entry.request === request);
    if (load) load.end = `cut short (${request.failure()?.errorText ?? "no error text"})`;
  });
  /** How the loads since `mark` ended, once the page has had `settle` ms to load again. */
  const since = async (mark, settle = 2_500) => {
    await page.waitForTimeout(settle);
    return loads.slice(mark).map((entry) => entry.end);
  };
  const statusMenus = page.getByRole("menubar", { name: "Status menus" });

  await createAccount(page, base, one);
  // From here the page's own document is served late (a route of the test; the server is not involved).
  await page.route(
    (url) => url.origin === origin && url.pathname === "/",
    async (route) => {
      if (route.request().isNavigationRequest())
        await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
      // A load cut short meanwhile has nothing left to continue.
      await route.continue().catch(() => {});
    },
  );

  // Log Out from the Apple menu.
  {
    const mark = loads.length;
    const menu = await menuOpen(page, "Apple");
    await menuItem(menu, /^Log Out .+…$/).click();
    const shown = await userTile(page, "Switch One")
      .waitFor({ timeout: 20_000 })
      .then(
        () => true,
        () => false,
      );
    const ends = await since(mark);
    check(
      "desktop.accounts.log-out.loads-once",
      shown && ends.length === 1 && ends[0] === "loaded",
      `login window ${shown ? "shown" : "not shown"}; loads of the page: ${ends.join(", ") || "none"}`,
    );
  }

  // A second account, made at the login window; then back to the first from its user menu.
  await createAccount(page, base, two);
  {
    await statusMenus.getByRole("menuitem", { name: "Switch Two", exact: true }).click();
    const menu = page.locator('[role="menu"][data-open]').last();
    await menu.waitFor({ timeout: 5_000 });
    const mark = loads.length;
    await menuItem(menu, "Switch One").click();
    await passwordField(page).waitFor({ timeout: 10_000 });
    await passwordField(page).click();
    await passwordField(page).pressSequentially(one.password);
    await passwordField(page).press("Enter");
    const back = await statusMenus
      .getByRole("menuitem", { name: "Switch One", exact: true })
      .waitFor({ timeout: 20_000 })
      .then(
        () => true,
        () => false,
      );
    const ends = await since(mark);
    check(
      "desktop.accounts.switch-user.loads-once",
      back && ends.length === 1 && ends[0] === "loaded",
      `Switch One's desktop ${back ? "shown" : "not shown"}; loads of the page: ${ends.join(", ") || "none"}`,
    );
  }
});
