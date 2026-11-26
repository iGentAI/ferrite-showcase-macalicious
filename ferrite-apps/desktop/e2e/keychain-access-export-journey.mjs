#!/usr/bin/env node
// Keychain Access's Password Assistant, Access Control tab and Export on a served desktop: the assistant fills the
// password field; the exported file holds no name or password in the clear, opens with its password and refuses
// another, and holds only what was selected; the file password never reaches the server. Exits 0 only when every
// step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/keychain-access-export-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { readFileSync } from "node:fs";
import path from "node:path";
import { journey, nextSave, openDesktop } from "./journey-kit.mjs";

const VAULT = "/api/keychain-access/vault";
const KEYCHAIN_PASSWORD = "journey horse battery";
const FILE_PASSWORD = "another staple sentence";
const KEPT = { name: "kept-item", secret: "kept-s3cret" };
const LEFT = { name: "left-item", secret: "left-s3cret" };

/** What a person would do with the file's documented format, in the browser's own WebCrypto. */
const openFile = (page, text, password) =>
  page.evaluate(
    async ({ text, password }) => {
      const envelope = JSON.parse(text);
      const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const base = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveKey"],
      );
      const key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: bytes(envelope.kdf.salt),
          iterations: envelope.kdf.iterations,
        },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );
      try {
        const plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: bytes(envelope.iv) },
          key,
          bytes(envelope.ciphertext),
        );
        return new TextDecoder().decode(plain);
      } catch {
        return null;
      }
    },
    { text, password },
  );

await journey("keychain-access-export", async ({ page, base, out, step }) => {
  const sent = [];
  page.on("request", (request) => {
    const body = request.postData();
    if (body) sent.push(body);
  });
  await openDesktop(page, base);
  await page
    .getByRole("button", { name: /^Keychain Access$/ })
    .first()
    .click();
  const window = page.locator("[data-keychain-state]").first();
  await window.waitFor({ timeout: 10_000 });

  let dialog = page.getByRole("dialog", { name: "New Keychain Password" });
  await dialog.getByLabel("New Password:").fill(KEYCHAIN_PASSWORD);
  await dialog.getByLabel("Verify:").fill(KEYCHAIN_PASSWORD);
  await dialog.getByRole("button", { name: "Create" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });

  for (const { name, secret } of [KEPT, LEFT]) {
    await page.keyboard.press("Control+n");
    dialog = page.getByRole("dialog", { name: "New Password Item" });
    await dialog.waitFor({ timeout: 5_000 });
    await dialog.getByLabel("Keychain Item Name:").fill(name);
    await dialog.getByLabel("Password:", { exact: true }).fill(secret);
    const saved = nextSave(page, VAULT);
    await dialog.getByRole("button", { name: "Add" }).click();
    await saved;
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  }

  await page.keyboard.press("Control+n");
  dialog = page.getByRole("dialog", { name: "New Password Item" });
  await dialog.getByRole("button", { name: "Password Assistant…" }).click();
  const suggestion = await dialog.getByLabel("Suggestion:").inputValue();
  step(
    "the assistant suggests a password",
    suggestion.length === 20,
    `${suggestion.length} characters`,
  );
  await page.screenshot({ path: path.join(out, "keychain-assistant.png") });
  await dialog.getByRole("button", { name: "Another" }).click();
  const another = await dialog.getByLabel("Suggestion:").inputValue();
  step("Another gives a different one", another !== suggestion && another.length === 20);
  await dialog.getByRole("button", { name: "Use This Password" }).click();
  step(
    "Use This Password fills the field and the quality shows",
    (await dialog.getByLabel("Password:", { exact: true }).inputValue()) === another &&
      (await dialog.getByText(/at most \d+ bits/).isVisible()),
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await dialog.waitFor({ state: "hidden" });

  const grid = window.getByRole("grid", { name: "Items" });
  const row = (name) => grid.getByRole("row").filter({ hasText: name }).first();
  await row(KEPT.name).click();
  await page.keyboard.press("Control+i");
  dialog = page.getByRole("dialog", { name: KEPT.name });
  await dialog.getByRole("tab", { name: "Access Control" }).click();
  step(
    "Access Control says what is true",
    await dialog.getByText(/No app on this desktop can read this item/).isVisible(),
  );
  await page.screenshot({ path: path.join(out, "keychain-access-control.png") });
  await dialog.getByRole("button", { name: "Done" }).click();
  await dialog.waitFor({ state: "hidden" });

  await page.keyboard.press("Control+Shift+e");
  dialog = page.getByRole("dialog", { name: "Export Items" });
  await dialog.waitFor({ timeout: 5_000 });
  await dialog.getByLabel("File Password:").fill(FILE_PASSWORD);
  await dialog.getByLabel("Verify:").fill("not the same");
  step(
    "Export waits for the password twice",
    await dialog.getByRole("button", { name: "Export" }).isDisabled(),
  );
  await dialog.getByLabel("Verify:").fill(FILE_PASSWORD);
  const download = page.waitForEvent("download", { timeout: 30_000 });
  await dialog.getByRole("button", { name: "Export" }).click();
  const file = await download;
  const text = readFileSync(await file.path(), "utf8");
  step(
    "the file is named as the menu says",
    file.suggestedFilename() === "Keychain Items.json",
    file.suggestedFilename(),
  );
  step(
    "the file holds nothing in the clear",
    ![KEPT.name, KEPT.secret, LEFT.name, FILE_PASSWORD].some((word) => text.includes(word)),
  );
  const opened = await openFile(page, text, FILE_PASSWORD);
  step("its password opens it, with the item in it", opened?.includes(KEPT.secret) === true);
  step("and only what was selected", opened?.includes(LEFT.secret) === false);
  step("another password does not", (await openFile(page, text, KEYCHAIN_PASSWORD)) === null);
  step(
    "neither the file password nor a secret reached the server",
    !sent.some((body) =>
      [FILE_PASSWORD, KEPT.secret, LEFT.secret].some((word) => body.includes(word)),
    ),
    `${sent.length} requests with bodies`,
  );
});
