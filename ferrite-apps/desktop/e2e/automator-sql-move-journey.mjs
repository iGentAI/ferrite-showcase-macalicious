#!/usr/bin/env node
// Automator on the served desktop, as a new account: Apply SQL on a SQLite file of the drive, File > Move
// To…, Change Type of Images replacing its file, and the Copy Finder Items offer of Rename Finder Items.
// Python's sqlite3 module, a SQLite other than the
// page's, makes the database and reads the changed file back from the drive. Exits 0 only when every
// step passed with no console error, page error or failed request.
//
//   node e2e/automator-sql-move-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { api, journey, launch, options, reloadDesktop } from "./app-journey.mjs";
import { createAccount, newAccount } from "./r3-census-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, browserName } = options();
const { step, run, expectRefusal } = journey("automator-sql-move");
const account = newAccount("sqlmove", browserName);
const tag = Date.now().toString(36);
const scratch = mkdtempSync(path.join(process.env.TMPDIR ?? tmpdir(), "automator-sql-"));

/** Python's SQLite on the file: the rows of the last statement. */
function sqlite(bytes, ...statements) {
  const file = path.join(scratch, `${Date.now()}.sqlite`);
  writeFileSync(file, bytes ?? Buffer.alloc(0));
  const script =
    "import sqlite3,sys,json\nc=sqlite3.connect(sys.argv[1])\nrows=[]\nfor s in sys.argv[2:]:\n  rows=c.execute(s).fetchall()\nc.commit()\nprint(json.dumps(rows))";
  const done = spawnSync("python3", ["-c", script, file, ...statements], { encoding: "utf8" });
  if (done.status !== 0) throw new Error(done.stderr);
  return { rows: JSON.parse(done.stdout), bytes: readFileSync(file) };
}

async function until(check, ms = 30_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });

await run(async (page) => {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, account);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  const DB = `Books ${tag}.sqlite`;
  const made = sqlite(
    null,
    "CREATE TABLE books(title TEXT, pages INTEGER)",
    "INSERT INTO books VALUES ('Alpha', 100), ('Beta', 200)",
  );
  await uploadFile(page, {
    parent: "documents",
    name: DB,
    type: "application/vnd.sqlite3",
    bytes: made.bytes,
  });
  await uploadFile(page, {
    parent: "documents",
    name: `Plain ${tag}.db`,
    type: "text/plain",
    text: "not a database",
  });
  for (const name of [`Named ${tag}.txt`, `Own ${tag}.txt`]) {
    await uploadFile(page, { parent: "documents", name, type: "text/plain", text: "a name" });
  }
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    canvas.getContext("2d").fillRect(0, 0, 8, 8);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  for (const name of [`Dot ${tag}.png`, `Kept ${tag}.png`]) {
    await uploadFile(page, {
      parent: "pictures",
      name,
      type: "image/png",
      bytes: Buffer.from(png, "base64"),
    });
  }
  const dropId = (
    await api(page, "POST", "/api/files/ops", {
      ops: [{ op: "mkdir", parent: "documents", name: `Watched ${tag}` }],
    })
  ).json.created[0];
  await reloadDesktop(page);

  const entries = async () => (await api(page, "GET", "/api/files/")).json.entries;
  const entryNamed = async (name) =>
    (await entries()).find((entry) => entry.name === name && !entry.trashed_ms);
  const bytesOf = async (name) => {
    const entry = await entryNamed(name);
    if (!entry) return null;
    const data = await page.evaluate(
      async ({ id, version, size }) => {
        const bytes = [];
        for (let piece = 0; bytes.length < size; piece += 1) {
          const reply = await fetch(
            `/api/files/content/${encodeURIComponent(id)}?piece=${piece}&count=1&version=${version}`,
            { credentials: "same-origin" },
          );
          bytes.push(...new Uint8Array(await reply.arrayBuffer()));
        }
        return bytes;
      },
      { id: entry.id, version: entry.version ?? 0, size: entry.size },
    );
    return Buffer.from(data);
  };
  const books = async (sql = "SELECT title, pages FROM books ORDER BY pages") =>
    sqlite(await bytesOf(DB), sql).rows;
  const saved = async (name) =>
    (await api(page, "GET", "/api/automator/workflows")).json.library?.workflows.find(
      (entry) => entry.name === name,
    );
  const locations = async () => (await api(page, "GET", "/api/automator/locations")).json;

  await launch(page, "Automator");
  const actions = page.getByRole("grid", { name: "Actions" });
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 20_000 });
  const search = page.getByPlaceholder("Name", { exact: true });
  const nameField = page.getByRole("textbox", { name: "Workflow name" });
  const steps = page.locator(".mac-automator-step");
  const status = page.locator(".mac-automator-status");

  const add = async (title, settings = {}) => {
    const before = await steps.count();
    await search.fill(title);
    await actions.getByText(title, { exact: true }).first().dblclick();
    await steps.nth(before).waitFor({ timeout: 5_000 });
    await search.fill("");
    const added = steps.nth(before);
    for (const [label, value] of Object.entries(settings)) {
      if (value === true) await added.getByRole("checkbox", { name: label, exact: true }).click();
      else if (typeof value === "object") {
        await added.getByRole("combobox", { name: label }).click();
        await page.getByRole("option", { name: value.choose, exact: true }).click();
      } else await added.getByLabel(label, { exact: true }).fill(value);
    }
    return added;
  };
  const fileRow = async (name) => {
    await bar(page, "File").click();
    await page.waitForTimeout(250);
    await page.getByRole("menuitem", { name }).first().click();
  };
  const newOf = async (type, name) => {
    await fileRow(/^New/);
    const sheet = page.getByRole("dialog", { name: /Choose a type/ });
    await sheet.getByRole("radio", { name: type, exact: true }).click();
    await sheet.getByRole("button", { name: "Choose" }).click();
    await sheet.waitFor({ state: "detached" });
    const asked = page.getByRole("button", { name: /Don.t Save/ });
    if (
      await asked.waitFor({ timeout: 1_500 }).then(
        () => true,
        () => false,
      )
    )
      await asked.click();
    await page.waitForTimeout(500);
    await nameField.fill(name);
  };
  /** Runs the workflow in the window: the text of its log. */
  const runIt = async () => {
    const before = await page.getByText(/^Workflow (completed|failed)$/).count();
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await until(
      async () => (await page.getByText(/^Workflow (completed|failed)$/).count()) > before,
      60_000,
    );
    return (await page.locator(".mac-automator-lower").first().textContent()) ?? "";
  };
  const textOfFile = async (name) => (await bytesOf(name))?.toString("utf8") ?? null;

  /* ------------------------------------------------------------------------------ Apply SQL */
  const OUT = `rows ${tag}.txt`;
  await newOf("Workflow", `Read ${tag}`);
  const untouched = await entryNamed(DB);
  await add("Apply SQL", {
    database: `Documents/${DB}`,
    SQL: "SELECT title, pages FROM books ORDER BY pages",
  });
  await add("New Text File", { path: `Documents/${OUT}` });
  const readLog = await runIt();
  step(
    "SELECT hands its rows to the next action as text, and a new file holds them",
    (await until(() => textOfFile(OUT))) === "Alpha|100\nBeta|200",
    `${await textOfFile(OUT)} / ${readLog.slice(0, 200)}`,
  );
  step(
    "A SELECT leaves the database's file as it was",
    (await entryNamed(DB)).version === untouched.version,
  );

  await newOf("Workflow", `Insert ${tag}`);
  await add("Run JavaScript", { code: 'return ["Gamma\\t300", "Delta\\t400"];' });
  await add("Apply SQL", {
    database: `Documents/${DB}`,
    SQL: "INSERT INTO books VALUES (?, ?)",
  });
  await runIt();
  step(
    "The input fills the ? of the SQL, once per item, and another SQLite reads the changed file",
    await until(async () => (await books()).length === 4),
    JSON.stringify(await books()),
  );

  await newOf("Workflow", `Update ${tag}`);
  await add("Run JavaScript", {
    code: `return "UPDATE books SET pages = pages + 1 WHERE title = 'Alpha'";`,
  });
  await add("Apply SQL", { database: `Documents/${DB}` });
  await runIt();
  step(
    "With no SQL of its own, the input is the statements",
    await until(
      async () => (await books("SELECT pages FROM books WHERE title = 'Alpha'"))[0]?.[0] === 101,
    ),
    JSON.stringify(await books()),
  );

  const version = (await entryNamed(DB)).version;
  await newOf("Workflow", `Broken ${tag}`);
  await add("Apply SQL", {
    database: `Documents/${DB}`,
    SQL: "DELETE FROM books; SELECT FROM nowhere",
  });
  const broken = await runIt();
  step(
    "SQL that fails fails the step, says why, and writes nothing, its first statement included",
    broken.includes("The SQL failed") &&
      (await entryNamed(DB)).version === version &&
      (await books()).length === 4,
    broken.slice(0, 240),
  );
  await newOf("Workflow", `Plain ${tag}`);
  await add("Apply SQL", { database: `Documents/Plain ${tag}.db`, SQL: "SELECT 1" });
  const plain = await runIt();
  step("A file that is no database is refused", plain.includes("not a SQLite database"));

  /* ------------------------------------------------------------------------------- Move To */
  const FLOW = `Flow ${tag}`;
  await newOf("Folder Action", FLOW);
  const ARRIVED = `arrived ${tag}.txt`;
  await add("New Text File", { path: `Documents/${ARRIVED}`, replace: true });
  await page.getByRole("combobox", { name: "Folder Action folder" }).click();
  await page.getByRole("option", { name: `Documents/Watched ${tag}`, exact: true }).click();

  const moveTo = async (folder) => {
    await fileRow("Move To…");
    const panel = page.getByRole("dialog", { name: "Move To" });
    await panel.waitFor({ timeout: 10_000 });
    await panel.getByRole("combobox", { name: /Where/ }).click();
    await page.getByRole("option", { name: folder, exact: true }).click();
    await panel.getByRole("button", { name: "Save" }).click();
    await status.getByText(new RegExp(`^Moved .* to ${folder}\\.`)).waitFor({ timeout: 10_000 });
  };
  await moveTo("Music");
  const file = await entryNamed(`${FLOW}.workflow`);
  step(
    "Move To… on a workflow never saved saves it, and puts its file in the folder",
    file?.parent === "music",
    await status.innerText(),
  );
  const kept = await saved(FLOW);
  step(
    "The server keeps the workflow, and names the file as its location",
    kept?.kind === "folder-action" && (await locations()).locations[kept.id] === file.id,
    JSON.stringify(await locations()),
  );

  await page.waitForTimeout(1_500);
  await uploadFile(page, { parent: dropId, name: "first.txt", type: "text/plain", text: "a" });
  step(
    "Its folder still starts it after the move",
    (await until(() => textOfFile(ARRIVED))) === `Documents/Watched ${tag}/first.txt`,
    String(await textOfFile(ARRIVED)),
  );

  await moveTo("Downloads");
  const again = await entryNamed(`${FLOW}.workflow`);
  step(
    "A second Move To… moves that file, and leaves no other behind",
    again.id === file.id &&
      again.parent === "downloads" &&
      (await entries()).filter((entry) => entry.name === `${FLOW}.workflow`).length === 1,
  );

  const RENAMED = `Flow two ${tag}`;
  await nameField.fill(RENAMED);
  await fileRow(/^Save/);
  await status.getByText(`Saved “${RENAMED}”`).waitFor({ timeout: 10_000 });
  const renamed = await until(async () => {
    const entry = await entryNamed(`${RENAMED}.workflow`);
    return entry?.id === file.id ? entry : null;
  }, 10_000);
  step(
    "Saving renames the file with the workflow and writes it again",
    JSON.parse((await textOfFile(`${RENAMED}.workflow`)) ?? "{}").name === RENAMED,
    JSON.stringify(renamed),
  );

  await newOf("Workflow", `Other ${tag}`);
  await launch(page, "Finder");
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 8_000 });
  await finder.getByRole("treeitem", { name: "Downloads" }).first().click();
  await finder
    .getByRole("option", { name: new RegExp(RENAMED) })
    .first()
    .dblclick();
  const asked = page.getByRole("button", { name: /Don.t Save/ });
  if (
    await asked.waitFor({ timeout: 3_000 }).then(
      () => true,
      () => false,
    )
  )
    await asked.click();
  step(
    "Finder opens the moved file as that workflow, not as a new one",
    await until(async () => (await nameField.inputValue()) === RENAMED, 10_000),
    await nameField.inputValue(),
  );
  const workflows = (await api(page, "GET", "/api/automator/workflows")).json.library.workflows;
  step(
    "Only one workflow has its name, and it still is the server's",
    workflows.filter((entry) => entry.name === RENAMED).length === 1 &&
      workflows.find((entry) => entry.name === RENAMED).id === kept.id,
  );

  const bare = await locations();
  expectRefusal(409, "/api/automator/locations");
  expectRefusal(400, "/api/automator/locations");
  const stale = await api(page, "PUT", "/api/automator/locations", {
    locations: {},
    rev: bare.rev + 7,
  });
  const tooMany = await api(page, "PUT", "/api/automator/locations", {
    locations: Object.fromEntries(Array.from({ length: 51 }, (_, at) => [`w${at}`, `f${at}`])),
    rev: bare.rev,
  });
  step(
    "The server refuses a stale revision and a list over the workflows' limit, and keeps what it has",
    stale.status === 409 &&
      tooMany.status === 400 &&
      (await locations()).locations[kept.id] === file.id,
    `${stale.status} ${tooMany.status}`,
  );

  /* ------------------------------------------------------------------ Change Type of Images */
  await launch(page, "Automator");
  await newOf("Workflow", `Type ${tag}`);
  await add("Get Specified Finder Items", { paths: `Pictures/Dot ${tag}.png` });
  const change = await add("Change Type of Images");
  const question = page.getByRole("dialog", { name: /will change the Finder items/ });
  await question.waitFor({ timeout: 5_000 });
  step(
    "Adding Change Type of Images asks about Copy Finder Items",
    /originals are preserved/.test(await question.innerText()),
  );
  await question.getByRole("button", { name: /Don.t Add/ }).click();
  step(
    "Its checkbox for the Trash is on by default",
    await change.getByRole("checkbox", { name: "put the originals in the Trash" }).isChecked(),
  );
  await change.getByRole("combobox", { name: "to" }).click();
  await page.getByRole("option", { name: "BMP", exact: true }).click();
  await runIt();
  const original = async (name) => (await entries()).find((entry) => entry.name === name);
  step(
    "The BMP takes the file's place, 54 bytes of header and 8 rows of 24",
    (await until(async () => (await entryNamed(`Dot ${tag}.bmp`))?.size === 54 + 8 * 24)) === true,
  );
  step(
    "The original is in the Trash, where it can be got back, its bytes whole",
    Boolean((await original(`Dot ${tag}.png`))?.trashed_ms) &&
      (await original(`Dot ${tag}.png`)).size === Buffer.from(png, "base64").length,
  );

  await newOf("Workflow", `Copied ${tag}`);
  await add("Get Specified Finder Items", { paths: `Pictures/Kept ${tag}.png` });
  await add("Change Type of Images");
  await question.waitFor({ timeout: 5_000 });
  await question.getByRole("button", { name: "Add", exact: true }).click();
  await question.waitFor({ state: "detached" });
  step(
    "Add puts a Copy Finder Items step before it, to the Desktop",
    (await steps.count()) === 3 &&
      /Copy Finder Items/.test(await steps.nth(1).innerText()) &&
      (await steps.nth(1).getByLabel("to", { exact: true }).inputValue()) === "Desktop",
  );
  await steps.nth(2).getByRole("combobox", { name: "to" }).click();
  await page.getByRole("option", { name: "BMP", exact: true }).click();
  await runIt();
  const kin = async () => (await entries()).filter((entry) => entry.name.startsWith(`Kept ${tag}`));
  await until(async () => Boolean(await entryNamed(`Kept ${tag}.bmp`)));
  step(
    "The copy on the Desktop is what changes, and the picture stays where it was",
    (await entryNamed(`Kept ${tag}.bmp`))?.parent === "desktop" &&
      (await kin()).some(
        (entry) =>
          entry.name === `Kept ${tag}.png` && !entry.trashed_ms && entry.parent === "pictures",
      ) &&
      (await kin()).some((entry) => entry.name === `Kept ${tag}.png` && entry.trashed_ms),
    JSON.stringify((await kin()).map((entry) => [entry.name, entry.parent, entry.trashed_ms])),
  );

  /* -------------------------------------------------------------------- Rename Finder Items */
  const renameBy = async (step, words) => {
    await step.getByRole("combobox", { name: "change" }).click();
    await page.getByRole("option", { name: "Add Text", exact: true }).click();
    await step.getByLabel("text", { exact: true }).fill(words);
    await runIt();
  };
  await newOf("Workflow", `Copy first ${tag}`);
  await add("Get Specified Finder Items", { paths: `Documents/Named ${tag}.txt` });
  await add("Move Finder Items");
  step(
    "Move Finder Items, which changes where and not what, does not ask",
    !(await question.isVisible({ timeout: 500 }).catch(() => false)),
  );
  await steps.nth(1).getByRole("button", { name: "Remove Move Finder Items" }).click();
  await add("Rename Finder Items");
  await question.waitFor({ timeout: 5_000 });
  step(
    "Adding Rename Finder Items asks about Copy Finder Items, by its name",
    /“Rename Finder Items” action will change/.test(await question.innerText()),
    await question.innerText(),
  );
  await question.getByRole("button", { name: "Add", exact: true }).click();
  await question.waitFor({ state: "detached" });
  step(
    "Add puts Copy Finder Items before Rename Finder Items, to the Desktop",
    (await steps.count()) === 3 &&
      /Copy Finder Items/.test(await steps.nth(1).innerText()) &&
      (await steps.nth(1).getByLabel("to", { exact: true }).inputValue()) === "Desktop",
  );
  await renameBy(steps.nth(2), " done");
  const renamedCopy = await until(() => entryNamed(`Named ${tag} done.txt`));
  step(
    "The copy on the Desktop takes the new name, and the original keeps its own",
    renamedCopy?.parent === "desktop" &&
      (await entryNamed(`Named ${tag}.txt`))?.parent === "documents",
    JSON.stringify(renamedCopy),
  );

  await newOf("Workflow", `No copy ${tag}`);
  await add("Get Specified Finder Items", { paths: `Documents/Own ${tag}.txt` });
  await add("Rename Finder Items");
  await question.waitFor({ timeout: 5_000 });
  await question.getByRole("button", { name: /Don.t Add/ }).click();
  await question.waitFor({ state: "detached" });
  step("Don't Add adds no step", (await steps.count()) === 2);
  await renameBy(steps.nth(1), " done");
  const renamedOwn = await until(() => entryNamed(`Own ${tag} done.txt`));
  step(
    "Without the copy the file itself is renamed",
    renamedOwn?.parent === "documents" && !(await entryNamed(`Own ${tag}.txt`)),
    JSON.stringify(renamedOwn),
  );
  console.log(`engine run: ${browserName}`);
});
