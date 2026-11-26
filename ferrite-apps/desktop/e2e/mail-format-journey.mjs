#!/usr/bin/env node
// Mail's Format menu on Ferrite, in a real browser against the running app: lists, indentation and Make Plain
// Text act on a New Message, and what is sent reaches the other person with a pasted quote and its list,
// or, made plain, with no styled text. Exits 0 only when every step passed and no page logged a console error,
// a page error, a failed request or an HTTP error.
//
//   node e2e/mail-format-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-format");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mtchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mtmartin-${id}`, fullName: `Martin ${id}`, password };

const seen = (check) => within(10_000, check).then((took) => took !== null);
const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const text = (page) => compose(page).locator(".mac-mail-compose-message").first();
const html = (page) => text(page).evaluate((el) => el.innerHTML);
const openFormat = (page) =>
  page.getByRole("menubar").getByRole("menuitem", { name: "Format", exact: true }).first().click();
const submenu = async (page, trigger, row) => {
  await openFormat(page);
  await page.getByRole("menu").last().getByRole("menuitem", { name: trigger }).click();
  await page.getByRole("menuitem", { name: row }).first().click();
};
const newMessage = async (page, subject) => {
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const to = compose(page).getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await compose(page).getByLabel("Subject:").fill(subject);
  await text(page).click();
};
const closeAndSave = async (page) => {
  await compose(page).getByRole("button", { name: "Close" }).first().click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^Save/ })
    .click({ timeout: 2_000 })
    .catch(() => {});
  await within(10_000, async () => (await compose(page).count()) === 0);
  await page.waitForTimeout(1_500);
};
const opensWith = async (page, subject, row) => {
  await viewer(page)
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: subject })
    .first()
    .dblclick();
  await compose(page).waitFor({ timeout: 10_000 });
  await openFormat(page);
  const offered = await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: row })
    .waitFor({ timeout: 5_000 })
    .then(
      () => true,
      () => false,
    );
  await page.keyboard.press("Escape");
  return offered;
};
const sendAndRead = async (page, reader, subject) => {
  await page.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(page).count()) === 0);
  let found = null;
  await within(20_000, async () => {
    const reply = await reader.request.get(new URL("/api/mail/messages", reader.url()).href);
    const message = ((await reply.json()).messages ?? []).find((each) => each.subject === subject);
    if (!message) return false;
    const read = await reader.request.get(
      new URL(`/api/mail/messages/${message.id}`, reader.url()).href,
    );
    found = await read.json();
    return true;
  });
  return found;
};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());

  const styled = `Styled ${id}`;
  await newMessage(a, styled);
  await a.keyboard.type("First line");
  await a.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await a.evaluate(() =>
    navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob(["<blockquote><div>Pasted quote</div></blockquote>"], {
          type: "text/html",
        }),
        "text/plain": new Blob(["Pasted quote"], { type: "text/plain" }),
      }),
    ]),
  );
  await a.keyboard.press("Enter");
  await a.keyboard.press("Control+v");
  step(
    "a quote pasted into the message stays a quote",
    await seen(async () => /<blockquote[^>]*>.*Pasted quote/s.test(await html(a))),
  );
  await text(a).evaluate((el) => {
    el.insertAdjacentHTML("beforeend", "<div>Item</div>");
    const range = document.createRange();
    range.selectNodeContents(el.lastChild);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await submenu(a, "Lists", "Insert Bulleted List");
  step(
    "Lists makes a bulleted list",
    await seen(async () => /<ul>.*Item.*<\/ul>/s.test(await html(a))),
  );
  await submenu(a, "Indentation", "Increase");
  const nested = await seen(async () =>
    /<ul>\s*<ul>|<blockquote[^>]*>\s*<ul>|<li>\s*<ul>/.test(await html(a)),
  );
  step("Indentation moves the line in", nested);
  await shot(a, "mail-format");
  await submenu(a, "Indentation", "Decrease");
  const sent = await sendAndRead(a, b, styled);
  step(
    "what is sent keeps its quote and its list",
    /<blockquote[^>]*>/.test(sent?.html ?? "") && /<ul>/.test(sent?.html ?? ""),
  );

  const quoted = `Quoted ${id}`;
  await newMessage(a, quoted);
  await a.keyboard.type("Quote this");
  await submenu(a, "Quote Level", "Increase");
  step(
    "Quote Level > Increase quotes the line",
    await seen(async () => /<blockquote[^>]*>.*Quote this/s.test(await html(a))),
  );
  await within(5_000, () => text(a).evaluate((el) => document.activeElement === el));
  await a.keyboard.press("Control+'");
  step(
    "its key adds a second level",
    await seen(async () => (await html(a)).match(/<blockquote/g)?.length === 2),
  );
  await shot(a, "mail-quote-level");
  await a.keyboard.press("Control+z");
  step(
    "Undo takes the level back and only that",
    await seen(async () => {
      const now = await html(a);
      return now.match(/<blockquote/g)?.length === 1 && now.includes("Quote this");
    }),
  );
  await a.getByRole("menubar").getByRole("menuitem", { name: "Edit", exact: true }).first().click();
  await a.getByRole("menu").last().getByRole("menuitem", { name: /^Redo/ }).click();
  step(
    "Edit > Redo gives it again",
    await seen(async () => (await html(a)).match(/<blockquote/g)?.length === 2),
  );
  await a.getByRole("menubar").getByRole("menuitem", { name: "Edit", exact: true }).first().click();
  await a.getByRole("menu").last().getByRole("menuitem", { name: /^Undo/ }).click();
  step(
    "Edit > Undo takes it back",
    await seen(async () => (await html(a)).match(/<blockquote/g)?.length === 1),
  );
  await within(5_000, () => text(a).evaluate((el) => document.activeElement === el));
  await a.keyboard.press("Control+Shift+z");
  step(
    "Redo gives it again",
    await seen(async () => (await html(a)).match(/<blockquote/g)?.length === 2),
  );
  await a.keyboard.press("Control+Alt+'");
  step(
    "Decrease's key takes one off, keeping the text",
    await seen(async () => {
      const now = await html(a);
      return now.match(/<blockquote/g)?.length === 1 && now.includes("Quote this");
    }),
  );
  const sentQuote = await sendAndRead(a, b, quoted);
  step(
    "what is sent keeps its quote level",
    /<blockquote[^>]*>.*Quote this/s.test(sentQuote?.html ?? ""),
  );

  await newMessage(a, `Split ${id}`);
  await text(a).evaluate((el) => {
    el.innerHTML =
      "<blockquote><div>Keep one</div><div>Take out</div><div>Keep two</div></blockquote>";
    const range = document.createRange();
    range.selectNodeContents(el.querySelectorAll("div")[1]);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await a.keyboard.press("Control+Alt+'");
  step(
    "Decrease on a middle line splits the quote, keeping every line",
    await seen(async () => {
      const now = await html(a);
      return (
        now.match(/<blockquote/g)?.length === 2 &&
        /<\/blockquote>\s*<div>Take out<\/div>\s*<blockquote/.test(now)
      );
    }),
    await html(a),
  );
  step(
    "the same lines stay selected",
    (await a.evaluate(() => document.getSelection().toString().trim())) === "Take out",
  );
  await a.keyboard.press("Control+z");
  step(
    "Undo puts the one quote back",
    await seen(async () => {
      const now = await html(a);
      return (
        now.match(/<blockquote/g)?.length === 1 &&
        ["Keep one", "Take out", "Keep two"].every((line) => now.includes(line))
      );
    }),
    await html(a),
  );
  await closeAndSave(a);

  const plain = `Plain ${id}`;
  await newMessage(a, plain);
  await a.keyboard.type("Header words");
  const beforeHeader = await html(a);
  await compose(a).getByLabel("Subject:").click();
  await a.keyboard.press("Control+]");
  step(
    "with the keyboard in a header field the keys leave the message alone",
    (await html(a)) === beforeHeader,
  );
  await text(a).evaluate((el) => {
    el.replaceChildren();
    el.insertAdjacentHTML("beforeend", '<p style="color: red">Coloured</p>');
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await openFormat(a);
  await a
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Make Plain Text/ })
    .click();
  await a.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  step(
    "Cancel keeps a paragraph's colour, which Make Plain Text had asked about",
    await seen(async () => (await html(a)).includes("color: red")),
  );
  for (const tag of ["mark", "del", "code", "small"]) {
    await text(a).evaluate((el) => {
      el.replaceChildren();
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await text(a).click();
    await a.evaluate((pasted) => {
      return navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([pasted], { type: "text/html" }),
          "text/plain": new Blob(["word"], { type: "text/plain" }),
        }),
      ]);
    }, `<${tag}>word</${tag}>`);
    await a.keyboard.press("Control+v");
    await seen(async () => (await html(a)).includes("word"));
    await openFormat(a);
    await a
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: /^Make Plain Text/ })
      .click();
    const asked = await a
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel" })
      .click({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      );
    step(
      `Make Plain Text asks about pasted ${tag}, and Cancel keeps it`,
      asked && (await seen(async () => (await html(a)).includes(`<${tag}`))),
    );
  }
  await text(a).evaluate((el) => {
    el.replaceChildren();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await text(a).click();
  await a.keyboard.type("Plain words");
  await a.keyboard.press("Control+a");
  await a.keyboard.press("Control+b");
  await openFormat(a);
  await a
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Make Plain Text/ })
    .click();
  const alert = a.getByRole("alertdialog");
  step(
    "Make Plain Text asks first when it would take styles away",
    await alert.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    ),
  );
  await alert.getByRole("button", { name: "OK" }).click();
  step("and takes them away", await seen(async () => (await html(a)) === "<div>Plain words</div>"));
  await text(a).click();
  await a.keyboard.press("End");
  await text(a).evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", " pasted");
    data.setData("text/html", '<a href="https://example.com"><b> pasted</b></a>');
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  step(
    "a message made plain takes pasted text without its styles",
    await seen(async () => (await html(a)) === "<div>Plain words pasted</div>"),
  );
  const made = await sendAndRead(a, b, plain);
  step("the message goes with no styled text", made?.text === "Plain words pasted" && !made?.html);

  const reopened = `Reopened ${id}`;
  await newMessage(a, reopened);
  await a.keyboard.type("Kept plain");
  await openFormat(a);
  await a
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Make Plain Text/ })
    .click();
  await text(a).click();
  await a.keyboard.press("Control+End");
  await a.keyboard.press("Enter");
  await a.keyboard.type("second");
  await a.keyboard.press("Enter");
  await a.keyboard.type("third");
  // A real drag of the text selected in the Subject field onto the third line.
  const subject = compose(a).getByLabel("Subject:");
  await subject.fill("DROPPED");
  await subject.selectText();
  await subject.dragTo(text(a).locator("div").filter({ hasText: "third" }).last(), {
    sourcePosition: { x: 12, y: 8 },
    targetPosition: { x: 1, y: 8 },
  });
  step(
    "a drop on a message made plain goes where it lands, as text",
    await seen(async () =>
      /<div>[^<]*DROPPED[^<]*third|<div>third[^<]*DROPPED/.test(await html(a)),
    ),
  );
  await subject.fill(reopened);
  await text(a).click();
  await a.keyboard.press("Control+s");
  await a.waitForTimeout(1_500);
  await closeAndSave(a);
  const emptyPlain = `Empty plain ${id}`;
  const emptyRich = `Empty rich ${id}`;
  await newMessage(a, emptyPlain);
  await openFormat(a);
  await a
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Make Plain Text/ })
    .click();
  await a
    .getByRole("alertdialog")
    .getByRole("button", { name: /^(OK|Convert|Make Plain Text)/ })
    .click({ timeout: 2_000 })
    .catch(() => {});
  await closeAndSave(a);
  await newMessage(a, emptyRich);
  await closeAndSave(a);
  await a.reload();
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await viewer(a)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: /^Drafts/ })
    .getByText("Drafts", { exact: true })
    .first()
    .click();
  await viewer(a)
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: reopened })
    .first()
    .dblclick();
  await compose(a).waitFor({ timeout: 10_000 });
  await openFormat(a);
  step(
    "a draft made plain opens plain",
    await a
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: /^Make Rich Text/ })
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await a.keyboard.press("Escape");
  await closeAndSave(a);
  step(
    "an empty draft made plain opens plain after a reload",
    await opensWith(a, emptyPlain, /^Make Rich Text/),
  );
  await closeAndSave(a);
  step(
    "an empty rich draft opens rich after a reload",
    await opensWith(a, emptyRich, /^Make Plain Text/),
  );
  await closeAndSave(a);

  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  await viewer(b)
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: styled })
    .first()
    .click();
  const quote = viewer(b).locator(".mac-mail-live-styled blockquote").first();
  await quote.waitFor({ timeout: 10_000 });
  step(
    "the reader sees the quote with its rule",
    await quote.evaluate(
      (el) => Number.parseFloat(getComputedStyle(el).borderInlineStartWidth) > 0,
    ),
  );
  await shot(b, "mail-quote-read");
});
