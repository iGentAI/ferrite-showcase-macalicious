#!/usr/bin/env node
// Mail batch 2, the two drags: a token from To to Cc, and a message to Finder.
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-batch-drags");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `b3chris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `b3martin-${id}`, fullName: `Martin ${id}`, password };
const SUBJECT = `Files ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const row = (page, text) => rows(page).filter({ hasText: text }).first();
async function centre(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not shown");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await a.evaluate(
    async ([to, subject]) =>
      fetch("/api/mail/send", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": subject },
        body: JSON.stringify({ to: [to], cc: [], subject, text: "Hello." }),
      }),
    [martin.name, SUBJECT],
  );
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(20_000, async () => {
    await b.keyboard.press("Control+Shift+N");
    return (await rows(b).count()) >= 1;
  });

  await viewer(b).getByRole("button", { name: "New Message" }).click();
  const to = compose(b).getByLabel("To:");
  await to.click();
  await to.pressSequentially("ada@example.com");
  await to.press("Enter");
  const tokens = (label) =>
    compose(b)
      .locator(".mac-mail-compose-field")
      .filter({ hasText: `${label}:` })
      .locator(".mac-token-field-token");
  const ccField = compose(b).locator(".mac-mail-compose-field").filter({ hasText: "Cc:" });
  const from = await centre(tokens("To").first().locator(".mac-token-field-token-text"));
  const target = await centre(ccField);
  await b.mouse.move(from.x, from.y);
  await b.mouse.down();
  await b.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  await b.mouse.move(target.x, target.y, { steps: 12 });
  console.log(
    "mid-drag",
    await b.evaluate(
      ([x, y]) => ({
        dragging: document.documentElement.dataset.desktopDragging,
        under: document.elementFromPoint(x, y)?.className,
        cursor: document.documentElement.style.cursor,
      }),
      [target.x, target.y],
    ),
  );
  await b.mouse.up();
  step(
    "a token dragged from To lands in Cc and leaves To",
    (await within(
      8_000,
      async () => (await tokens("Cc").count()) === 1 && (await tokens("To").count()) === 0,
    )) !== null,
  );
  await shot(b, "token-dragged");
  await b.keyboard.press("Control+w");
  await within(10_000, async () => (await compose(b).count()) === 0);

  await b.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = b.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const bar = await finder.boundingBox();
  await b.mouse.move(bar.x + bar.width / 2, bar.y + 12);
  await b.mouse.down();
  await b.mouse.move(bar.x + bar.width / 2 + 260, bar.y + 300, { steps: 12 });
  await b.mouse.up();
  const finderNow = await finder.boundingBox();
  const mail = await viewer(b).boundingBox();
  console.log("finder", finderNow, "mail", mail);
  // The list must not lie under Finder: a press there brings Mail forward, over the place to drop.
  const listRow = await centre(row(b, SUBJECT));
  const view = b.viewportSize() ?? { width: 1440, height: 900 };
  const spot = {
    x: Math.min(finderNow.x + finderNow.width, view.width) - 60,
    y: Math.min(finderNow.y + finderNow.height, view.height) - 60,
  };
  await b.mouse.move(listRow.x, listRow.y);
  await b.mouse.down();
  await b.mouse.move(listRow.x + 12, listRow.y + 12, { steps: 4 });
  await b.mouse.move(spot.x, spot.y, { steps: 12 });
  await b.mouse.move(spot.x, view.height + 40, { steps: 6 });
  await b.mouse.up();
  await b.waitForTimeout(1_500);
  const fileShown = () =>
    finder
      .getByRole("option", { name: `${SUBJECT}.eml`, exact: true })
      .first()
      .isVisible();
  step("a message let go outside the browser's window lands nowhere", !(await fileShown()));
  await b.mouse.move(listRow.x, listRow.y);
  await b.mouse.down();
  await b.mouse.move(listRow.x + 12, listRow.y + 12, { steps: 4 });
  await b.mouse.move(spot.x, spot.y, { steps: 12 });
  await b.mouse.up();
  console.log(
    "after drop",
    await b.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, [spot.x, spot.y]),
  );
  await b.waitForTimeout(2_000);
  await shot(b, "dragged-to-finder");
  step("a message dragged to Finder is a file there", (await within(12_000, fileShown)) !== null);
  step("and the message stays in its mailbox", await row(b, SUBJECT).isVisible());
});
