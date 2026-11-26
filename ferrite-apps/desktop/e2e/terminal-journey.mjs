#!/usr/bin/env node
// Drives Terminal's first version in a real browser against the running desktop: the window, what
// it says about itself, its commands on the real drive, what it refuses, and that a folder of its
// own is all that changes. Every step reads the window or the server. It makes one file and one
// folder of its own, with unique names, deletes them by id, and shows no other file's contents.
//
//   node e2e/terminal-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out } = options();
const { step, run } = journey("terminal");
const stamp = Date.now();
const FILE = `terminal-journey-${stamp}.txt`;
const FOLDER = `terminal-journey-${stamp}`;
const TEXT = `written for the journey ${stamp}`;
const LINES = `lines-${stamp}.txt`;
const OUT = `out-${stamp}.txt`;

const log = (page) => page.getByRole("log", { name: "Terminal output" }).first();
async function type(page, line) {
  await page.keyboard.type(line);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => {
      const text = document.querySelector('[role="log"][aria-label="Terminal output"]')?.innerText;
      return /%\s*$/.test(text ?? "");
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(100);
}
const shown = async (page) => log(page).innerText();
/** What the window shows after the last time `line` was typed: only that command's answer. */
const answerTo = async (page, line) => (await shown(page)).split(line).at(-1);

await run(async (page) => {
  await openDesktop(page, base, step);
  const fileId = await uploadFile(page, {
    parent: "documents",
    name: FILE,
    type: "text/plain",
    text: TEXT,
  });
  const linesId = await uploadFile(page, {
    parent: "documents",
    name: LINES,
    type: "text/plain",
    text: "banana\ncherry\nbanana\napple\n",
  });
  try {
    await theJourney(page);
  } finally {
    await api(page, "POST", "/api/files/ops", {
      ops: [
        { op: "delete", id: fileId },
        { op: "delete", id: linesId },
      ],
    });
  }
});

async function theJourney(page) {
  const before = JSON.stringify((await api(page, "GET", "/api/files/")).json?.entries?.length);
  await launch(page, "Terminal");
  await log(page).waitFor({ state: "visible", timeout: 10_000 });
  await page.getByRole("textbox", { name: "Terminal input" }).first().focus();
  await page.waitForTimeout(300);
  const start = await shown(page);
  step(
    "the first lines say it is simulated, a first version, and what is not here yet",
    start.includes("simulated shell") &&
      start.includes("first version") &&
      start.includes("not here yet"),
  );
  step("the window is named as Terminal names it", /— zsh — 80×24/.test(await page.content()));

  await type(page, "help");
  step("help lists the commands", (await shown(page)).includes("history"));
  await type(page, "cd Documents");
  await type(page, "pwd");
  step("cd and pwd", (await shown(page)).includes("/Users/shackett/Documents"));
  await type(page, "ls -1");
  step("ls lists the file on the real drive", (await answerTo(page, "ls -1")).includes(FILE));
  await type(page, `cat ${FILE}`);
  step("cat shows that file's text", (await answerTo(page, `cat ${FILE}`)).includes(TEXT));
  await type(page, `echo a | cat > ${OUT}`);
  const written = async () => {
    const entry = (await api(page, "GET", "/api/files/")).json?.entries?.find(
      (each) => each.name === OUT,
    );
    return entry ? { size: entry.size, id: entry.id } : null;
  };
  step("> writes a new file on the real drive", (await written())?.size === 2);
  await type(page, `echo more >> ${OUT}`);
  step(">> adds to it, read back from the server", (await written())?.size === 7);
  await type(page, `wc -l < ${OUT}`);
  step(
    "< reads it",
    (await answerTo(page, `wc -l < ${OUT}`)).trim().startsWith("2"),
    (await answerTo(page, `wc -l < ${OUT}`)).trim(),
  );
  await type(page, `cat nothing-here 2> ${OUT}`);
  step(
    "2> sends the error to the file, not the screen",
    !(await answerTo(page, `cat nothing-here 2> ${OUT}`)).includes("No such file") &&
      (await written())?.size === "cat: nothing-here: No such file or directory\n".length,
  );
  await type(page, `echo a > ${FOLDER}-none/x`);
  step(
    "a target that cannot be used is said and nothing runs",
    (await answerTo(page, `echo a > ${FOLDER}-none/x`)).includes("no such file or directory"),
  );
  await shot(page, path.join(out, "terminal-redirection.png"));
  await type(page, `rm ${OUT}`);
  step("the journey's file is gone again", (await written()) === null);
  await type(page, `cat ${FILE} | wc -w`);
  step(
    "a pipe feeds wc what cat wrote: five words of the journey's file",
    (await answerTo(page, `cat ${FILE} | wc -w`)).trim().startsWith("5"),
    (await answerTo(page, `cat ${FILE} | wc -w`)).trim(),
  );
  await type(page, `ls -1 | grep terminal-journey-${stamp} | wc -l`);
  step(
    "three commands in a row: ls, grep and wc count the one file",
    (await answerTo(page, `ls -1 | grep terminal-journey-${stamp} | wc -l`)).trim().startsWith("1"),
  );
  await type(page, `ls | grep -c ${FILE}`);
  step(
    "ls into a pipe writes one name a line",
    (await answerTo(page, `ls | grep -c ${FILE}`)).trim().startsWith("1"),
  );
  await type(page, `grep -c journey ${FILE}`);
  step(
    "grep counts the matching line of the real drive's file",
    (await answerTo(page, `grep -c journey ${FILE}`)).trim().split("\n")[0] === "1",
  );
  const lineOf = async (typed) =>
    (await answerTo(page, typed))
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.includes("%"));
  await type(page, `sort -r ${LINES}`);
  step(
    "sort -r puts the real file's lines in reverse order",
    JSON.stringify(await lineOf(`sort -r ${LINES}`)) ===
      JSON.stringify(["cherry", "banana", "banana", "apple"]),
    (await lineOf(`sort -r ${LINES}`)).join(),
  );
  await type(page, `sort ${LINES} | uniq -c | head -n 2`);
  step(
    "sort, uniq -c and head count the repeated line",
    JSON.stringify(await lineOf("| head -n 2")) === JSON.stringify(["1 apple", "2 banana"]),
    (await lineOf("| head -n 2")).join(),
  );
  await type(page, `tail -n 1 ${FILE} | grep -q journey && echo found-it`);
  step(
    "a pipeline's status decides &&",
    (await answerTo(page, "&& echo found-it")).includes("found-it"),
  );
  await shot(page, path.join(out, "terminal-pipes.png"));
  await type(page, `echo first; cat ${FILE}x || echo after-failure; echo x && echo after-success`);
  const list = await answerTo(page, "after-success");
  const listed = await shown(page);
  step(
    "; && and || run the commands of a line in order, by their status",
    /first[\s\S]*No such file[\s\S]*after-failure[\s\S]*x[\s\S]*after-success/.test(listed),
    list.slice(0, 20),
  );
  await shot(page, path.join(out, "terminal-line-list.png"));
  await type(page, `rm ${FILE}x`);
  step(
    "rm of a file that is not there says so",
    (await answerTo(page, `rm ${FILE}x`)).includes("No such file or directory"),
  );

  // The file-changing commands, in a folder of this journey's own.
  const entries = async () => (await api(page, "GET", "/api/files/")).json?.entries ?? [];
  const inFolder = async () => {
    const all = await entries();
    const folder = all.find((entry) => entry.name === FOLDER);
    return {
      folder,
      names: all
        .filter((e) => e.parent === folder?.id)
        .map((e) => e.name)
        .sort(),
    };
  };
  await type(page, `mkdir ${FOLDER}`);
  await type(page, `cd ${FOLDER}`);
  await type(page, "touch empty.txt");
  step(
    "mkdir and touch make a folder and a file on the real drive",
    (await inFolder()).names.join() === "empty.txt",
    (await inFolder()).names.join(),
  );
  await type(page, `cp ../${FILE} copy.txt`);
  await type(page, "mv copy.txt moved.txt");
  step(
    "cp and mv act on the real drive",
    (await inFolder()).names.join() === "empty.txt,moved.txt",
    (await inFolder()).names.join(),
  );
  await type(page, "cat moved.txt");
  step("the copy holds the file's text", (await answerTo(page, "cat moved.txt")).includes(TEXT));
  await type(page, "mkdir -p a/b");
  await type(page, "rmdir a");
  step(
    "rmdir refuses a folder with something in it",
    (await answerTo(page, "rmdir a")).includes("Directory not empty"),
  );
  await type(page, "rm -r a");
  await type(page, "rm moved.txt");
  const erased = await inFolder();
  step(
    "rm erases for real: gone from the folder and not in the Trash",
    erased.names.join() === "empty.txt" &&
      !(await entries()).some((entry) => entry.name === "moved.txt"),
    erased.names.join(),
  );
  await shot(page, path.join(out, "terminal-file-commands.png"));
  await type(page, "cd ..");
  await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: erased.folder.id }] });

  await type(page, "his");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await shot(page, path.join(out, "terminal-first-version.png"));

  const after = JSON.stringify((await api(page, "GET", "/api/files/")).json?.entries?.length);
  step(
    "the drive holds what it held once the journey's folder is gone",
    before === after,
    `${before} ${after}`,
  );
}
