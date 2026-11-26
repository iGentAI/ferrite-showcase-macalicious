// What the journeys of Mail's rules, signatures, settings, search, find and conversations share.

import { within } from "./people-kit.mjs";

export const viewer = (page) => page.locator(".mac-mail").first();
export const compose = (page) => page.locator(".mac-mail-compose").first();
export const preferences = (page) => page.locator(".mac-mail-preferences");
export const rows = (page) =>
  viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
export const row = (page, text) =>
  rows(page)
    .filter({ has: page.getByText(text, { exact: true }) })
    .first();
export const mailboxRow = (page, name) =>
  viewer(page)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: new RegExp(`^${name}`) });
export const values = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values ?? {};
};
export const onServer = async (page, subject) => {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  return (await reply.json()).messages.find((each) => each.subject === subject);
};
export const allOnServer = async (page) => {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  return (await reply.json()).messages;
};
export async function menuPath(page, ...names) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: names[0], exact: true })
    .first()
    .click();
  for (const name of names.slice(1)) {
    const menu = page.getByRole("menu").last();
    await menu
      .getByRole("menuitem", { name })
      .or(menu.getByRole("menuitemcheckbox", { name }))
      .first()
      .click();
  }
}
export async function choose(page, scope, label, option) {
  await scope.getByRole("combobox", { name: label }).first().click();
  await page.getByRole("option", { name: option, exact: true }).last().click();
  // The pop-up's fade, so that a screenshot shows what it was covering.
  await page.waitForTimeout(300);
}
export async function send(page, to, subject, text = "") {
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const field = compose(page).getByLabel("To:");
  await field.click();
  await field.pressSequentially(to);
  await field.press("Enter");
  await compose(page).getByLabel("Subject:").fill(subject);
  if (text) {
    await compose(page).getByRole("textbox", { name: "Message" }).click();
    await page.keyboard.insertText(text);
  }
  await page.keyboard.press("Control+Shift+D");
  if (!(await within(15_000, async () => (await compose(page).count()) === 0))) {
    throw new Error(`the message ${subject} did not go`);
  }
}
export const arrive = (page, check) =>
  within(20_000, async () => {
    await page.keyboard.press("Control+Shift+N");
    return check();
  });
export async function openPane(page, name) {
  if (!(await preferences(page).isVisible())) await menuPath(page, "Mail", "Preferences");
  await preferences(page).getByRole("tab", { name }).click();
}
export const closePreferences = (page) =>
  preferences(page).getByRole("button", { name: "Close" }).first().click();
export const settled = (page) => page.waitForTimeout(1_500);
