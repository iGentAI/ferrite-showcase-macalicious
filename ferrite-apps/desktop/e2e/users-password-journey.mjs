#!/usr/bin/env node
// Users & Groups' Change Password on a served desktop, with a person of their own in each of two
// browsers: the wrong old password is refused and nothing changes; the right one changes it, the other
// browser is signed out, and only the new password opens the account afterwards. Exits 0 only when
// every step passed with no console error, page error, failed request or HTTP error, apart from the
// refusal this journey asks for.
//
//   node e2e/users-password-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("users-password");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const changed = `reef-${id}-sand`;
const ana = { name: `upana-${id}`, fullName: `Ana ${id}`, password };
const other = { name: `upother-${id}`, fullName: `Other ${id}`, password };

const sessionOf = (page) =>
  page.evaluate(() => fetch("/api/session").then((reply) => reply.json()));

await run({}, {}, async ({ person }) => {
  allow(/api\/session\/password/);
  allow(/api\/session\/sign-in/);
  // Her second browser changes person behind its page's back, and its page's next ticket says so.
  allow(/api\/session\/ticket/);
  allow(/status of 409/);
  allow(/status of 401/);
  const a = await person("ana", ana);
  // Her second browser, signed in by the same route as the login window.
  const b = await person("other", other);
  const signedIn = await b.evaluate(
    async ({ name, password }) => {
      const out = await fetch("/api/session/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const reply = await fetch("/api/session/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      return [out.status, reply.status];
    },
    { name: ana.name, password },
  );
  step("she is signed in in a second browser", signedIn[1] === 200, signedIn.join());

  await openFromDock(a, "System Preferences");
  const window = a.locator('[data-window-id="system-preferences"]');
  await window
    .getByRole("button", { name: /^Users & Groups/ })
    .first()
    .click();
  await window.getByRole("button", { name: "Change Password…" }).click();
  const fill = async (old, next) => {
    await window.getByLabel("Old password:").fill(old);
    await window.getByLabel("New password:").fill(next);
    await window.getByLabel("Verify:").fill(next);
  };
  const submit = window.getByRole("button", { name: "Change Password", exact: true });

  await fill("not the password", changed);
  await shot(a, "users-password");
  await submit.click();
  await window.getByText("The name or password is incorrect.").waitFor({ timeout: 15_000 });
  const still = await sessionOf(b);
  step("the wrong old password is refused, and the other browser stays", Boolean(still.account));

  await fill(password, changed);
  await submit.click();
  await window.getByRole("button", { name: "Change Password…" }).waitFor({ timeout: 15_000 });
  step("the right one changes it", Boolean((await sessionOf(a)).account));
  const out = await within(10_000, async () => !(await sessionOf(b)).account);
  step("her other browser is signed out", out !== null);

  const attempt = (secret) =>
    b.evaluate(
      async ({ name, secret }) =>
        (
          await fetch("/api/session/sign-in", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, password: secret }),
          })
        ).status,
      { name: ana.name, secret },
    );
  step("the old password no longer opens the account", (await attempt(password)) === 401);
  step("the new one does", (await attempt(changed)) === 200);
});
