#!/usr/bin/env node
// Storage Management on Ferrite: the signed-in person's Ferrite drive against
// its quota. With a picture, a large movie file and a document in the drive,
// a file in the Trash and a stored keychain, GET /api/storage-management/usage
// reports the drive by kind of file (adding up to what the quota counts) and
// the app data; the window is titled with the drive's free space, lists
// Photos, Movies, Documents, the Trash, Large Files and App Data, empties the
// Trash through the drive's own route, erases a large file from Large Files,
// and forgets the keychain through Keychain Access's own route. A second
// person, signed in through the login window in a browser of their own, finds
// their drive empty. Exits 0 only when every step passed and the page
// logged no console error, page error, failed request or HTTP error. It
// removes what it wrote.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/storage-management-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                           [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, nextResponse, openDesktop, options, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";
import { driveOps, openWithSpotlight, uploadFile } from "./system-kit.mjs";

const VAULT = "/api/keychain-access/vault";
const USAGE = "/api/storage-management/usage";
const { base, out } = options();
const { step, run } = journey("storage-management");

// An envelope as Keychain Access seals one; the server keeps only its shape.
const vault = {
  version: 1,
  kdf: { name: "PBKDF2-SHA-256", iterations: 600000, salt: "AAAAAAAAAAAAAAAAAAAAAA==" },
  iv: "AAAAAAAAAAAAAAAA",
  ciphertext: "AAAAAAAAAAAAAAAAAAAAAAAAAAA=",
};

const category = (usage, id) => usage.json.drive?.categories?.find((c) => c.id === id);

/** Answers Storage Management's question before it erases anything with `button`. */
async function confirm(page, button) {
  const question = page.getByRole("alertdialog");
  await question.waitFor({ timeout: 10_000 });
  await question.getByRole("button", { name: button, exact: true }).click();
}

/** Another application takes the front, and then Storage Management comes back to it. */
async function comeForward(page) {
  await launch(page, "Calculator");
  await page.locator('[data-window-id="calculator"]').waitFor({ timeout: 10_000 });
  await launch(page, "Storage Management");
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const current = await api(page, "GET", VAULT);
  const put = await api(page, "PUT", VAULT, { vault, rev: current.json.rev });
  const picture = await uploadFile(page, {
    parent: "pictures",
    name: "Beach.jpg",
    type: "image/jpeg",
    size: 40_000,
  });
  const movie = await uploadFile(page, {
    parent: "movies",
    name: "Holiday.mp4",
    type: "video/mp4",
    size: 5_200_000,
  });
  const plan = await uploadFile(page, {
    parent: "documents",
    name: "Plan.txt",
    type: "text/plain",
    text: "a plan",
  });
  const old = await uploadFile(page, {
    parent: "documents",
    name: "Old notes.txt",
    type: "text/plain",
    text: "old",
  });
  const trashed = await driveOps(page, [{ op: "trash", id: old }]);
  step(
    "the person keeps a keychain, a picture, a movie, a document and a file in the Trash",
    put.status === 200 && Boolean(picture && movie && plan) && trashed === 200,
  );

  const usage = await api(page, "GET", USAGE);
  const drive = usage.json.drive;
  const sum = (drive?.categories ?? []).reduce((total, c) => total + c.bytes, 0);
  step(
    "the module reports the drive by kind, adding up to what the quota counts",
    usage.status === 200 &&
      category(usage, "photos")?.bytes === 40_000 &&
      category(usage, "movies")?.bytes === 5_200_000 &&
      category(usage, "documents")?.bytes === 6 &&
      category(usage, "trash")?.bytes === 3 &&
      sum === drive.used &&
      drive.quota === 134_217_728,
    JSON.stringify(drive?.categories),
  );

  await openWithSpotlight(page, "Storage Management");
  const window = page.getByRole("region", { name: /^Ferrite Drive - .* available of 134\.2 MB$/ });
  await window.first().waitFor({ state: "visible", timeout: 10_000 });
  const sidebar = window.getByRole("tree", { name: "Categories" });
  await sidebar.getByRole("treeitem", { name: /^Movies/ }).waitFor({ timeout: 10_000 });
  step(
    "the window is titled with the drive's free space and lists each kind, Large Files and App Data",
    (await sidebar.getByRole("treeitem", { name: /^Photos/ }).count()) === 1 &&
      (await sidebar.getByRole("treeitem", { name: /^Documents/ }).count()) === 1 &&
      (await sidebar.getByRole("treeitem", { name: /^Trash/ }).count()) === 1 &&
      (await sidebar.getByRole("treeitem", { name: /^Large Files/ }).count()) === 1 &&
      (await sidebar.getByRole("treeitem", { name: /^App Data/ }).count()) === 1,
  );
  await shot(page, path.join(out, "storage-management.png"));

  // The figures the window shows are the seeded drive's.
  const freeMb = (drive.quota - drive.used) / 1_000_000;
  const titleText = await window.first().locator(".mac-title-bar-title-text").innerText();
  const shownFree = Number.parseFloat(titleText.replace("Ferrite Drive - ", ""));
  step(
    "the title shows the quota less what is used",
    Math.abs(shownFree - freeMb) < 0.1,
    `${titleText} (${freeMb})`,
  );
  const shownSize = async (name, expected) =>
    (await sidebar.getByRole("treeitem", { name: new RegExp(`^${name}`) }).innerText()).includes(
      expected,
    );
  step(
    "each kind shows its seeded size",
    (await shownSize("Movies", "5.2 MB")) && (await shownSize("Photos", "40 KB")),
  );

  // Several files selected, with the row's contextual menu; nothing goes before the question.
  const extra = await uploadFile(page, {
    parent: "documents",
    name: "Extra.txt",
    type: "text/plain",
    text: "extra",
  });
  await comeForward(page);
  await sidebar.getByRole("treeitem", { name: /^Documents/ }).click();
  const documents = window.getByRole("grid", { name: "Documents files" });
  await documents.getByText("Extra.txt").waitFor({ timeout: 10_000 });
  step("a file added elsewhere shows when the window comes forward", true);
  await documents.getByText("Plan.txt").click();
  await documents.getByText("Extra.txt").click({ modifiers: ["ControlOrMeta"] });
  await window.getByText("2 items selected").waitFor({ timeout: 5_000 });
  step("two files can be selected", true);
  await documents.getByText("Extra.txt").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete…" }).waitFor();
  await shot(page, path.join(out, "storage-management-row-menu.png"));
  await page.keyboard.press("Escape");
  await documents.press("Delete");
  await page.getByRole("alertdialog").getByText("delete these 2 items").waitFor({ timeout: 5_000 });
  step("the Delete key asks about both", true);
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await documents.getByText("Plan.txt").waitFor({ timeout: 5_000 });
  step("and Cancel keeps them", true);
  await driveOps(page, [{ op: "delete", id: extra }]);
  await sidebar.getByRole("treeitem", { name: /^Recommendations/ }).click();
  await window.getByRole("button", { name: "Empty Trash" }).waitFor({ timeout: 10_000 });

  const emptied = nextResponse(page, "POST", "/api/files/ops");
  await window.getByRole("button", { name: "Empty Trash" }).click();
  await confirm(page, "Empty Trash");
  step("Empty Trash goes through the drive's own route", (await emptied).status() === 200);
  await page
    .waitForFunction(
      async (url) => {
        const response = await fetch(url, { credentials: "same-origin" });
        return (await response.json()).drive?.trash?.items === 0;
      },
      USAGE,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
  step("and the Trash is empty", category(await api(page, "GET", USAGE), "trash")?.bytes === 0);

  // The Trash refilled: its recommendation offers its button again, not "Completed".
  const again = await uploadFile(page, {
    parent: "documents",
    name: "Again.txt",
    type: "text/plain",
    text: "again",
  });
  await driveOps(page, [{ op: "trash", id: again }]);
  await comeForward(page);
  await window.getByRole("button", { name: "Empty Trash" }).waitFor({ timeout: 10_000 });
  step("a Trash filled again offers Empty Trash again", true);
  await driveOps(page, [{ op: "delete", id: again }]);

  await window.getByRole("button", { name: "Review Files" }).first().click();
  const large = window.getByRole("grid", { name: "Large Files files" });
  await large.getByText("Holiday.mp4 — Movies").click();
  const erased = nextResponse(page, "POST", "/api/files/ops");
  await window.getByRole("button", { name: "Delete…" }).click();
  await confirm(page, "Delete");
  step("Delete… erases a large file through the drive", (await erased).status() === 200);
  await window.getByText("No Files").waitFor({ timeout: 10_000 });
  const after = await api(page, "GET", USAGE);
  const movies = category(after, "movies");
  step(
    "the drive reports Movies at zero bytes and no files",
    after.status === 200 &&
      Array.isArray(after.json.drive?.categories) &&
      movies !== undefined &&
      movies.bytes === 0 &&
      movies.files === 0,
    JSON.stringify({ status: after.status, movies }),
  );
  await shot(page, path.join(out, "storage-management-large-files.png"));

  await sidebar.getByRole("treeitem", { name: /^App Data/ }).click();
  await window
    .getByRole("grid", { name: "App Data files" })
    .getByText("Encrypted Keychain")
    .click();
  const forgot = nextResponse(page, "DELETE", VAULT);
  await window.getByRole("button", { name: "Delete…" }).click();
  await confirm(page, "Delete");
  step(
    "Delete… forgets the keychain through Keychain Access's own route",
    (await forgot).status() === 200,
  );
  const stored = await api(page, "GET", VAULT);
  step("the server holds no keychain", stored.json.vault === null);

  // A second person, in a browser of their own, makes an account at the login window.
  const run = Date.now().toString(36);
  const person = {
    name: `storage-${run}`,
    fullName: "Storage Other",
    password: `tide-${run}-pool`,
  };
  const other = await page.context().browser().newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(otherPage, person);
  const who = await api(otherPage, "GET", "/api/session");
  step(
    "a second person signs in at the login window",
    who.status === 200 && who.json?.account?.name === person.name,
    JSON.stringify(who.json?.account),
  );
  const theirs = await api(otherPage, "GET", USAGE);
  step(
    "that person's drive is their own, and empty",
    theirs.status === 200 &&
      theirs.json.drive?.used === 0 &&
      Array.isArray(theirs.json.drive?.files) &&
      theirs.json.drive.files.length === 0,
    JSON.stringify({ status: theirs.status, used: theirs.json.drive?.used }),
  );
  await other.close();

  await driveOps(page, [
    { op: "delete", id: picture },
    { op: "delete", id: plan },
  ]);
});
