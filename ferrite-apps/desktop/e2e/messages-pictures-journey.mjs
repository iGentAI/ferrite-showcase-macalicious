#!/usr/bin/env node
// The pictures of Messages' conversations on Ferrite, in a real browser against the running app: a person with no
// contact picture shows their initials, one whose contact card has a picture shows it, and a group shows several.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed request or an HTTP
// error.
//
//   node e2e/messages-pictures-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-pictures");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mpchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mpmartin-${id}`, fullName: `Martin Hale`, password };
const ann = { name: `mpann-${id}`, fullName: `Ann Reed`, password };

const seen = (check) => within(15_000, check).then((took) => took !== null);
const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const rowOf = (page, name) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: name })
    .first();
const start = async (page, to, words) => {
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(to);
  const field = messagesOf(page).getByRole("textbox", { name: "Message" });
  await field.fill(words);
  await field.press("Enter");
};

await run({}, {}, async ({ person }) => {
  await person("martin", martin);
  await person("ann", ann);
  const a = await person("chris", chris);
  await openFromDock(a, "Messages");

  await start(a, ann.name, `to ann ${id}`);
  await within(20_000, () => rowOf(a, ann.fullName).isVisible());
  step(
    "a person with no contact picture shows their initials",
    await seen(
      async () =>
        (await rowOf(a, ann.fullName).locator(".mac-messages-monogram").first().innerText()) ===
        "AR",
    ),
  );

  await start(a, `${martin.name}, ${ann.name}`, `to both ${id}`);
  await within(20_000, () => rowOf(a, `to both ${id}`).isVisible());
  step(
    "a group shows its people together",
    await seen(
      async () => (await rowOf(a, `to both ${id}`).locator(".mac-messages-person").count()) === 2,
    ),
  );

  // A contact card naming Martin's account, then its picture added, replaced and removed while Messages
  // stays open.
  const paint = (size) =>
    a.evaluate((side) => {
      const canvas = document.createElement("canvas");
      canvas.width = side;
      canvas.height = side;
      const brush = canvas.getContext("2d");
      brush.fillStyle = "#d0342c";
      brush.fillRect(0, 0, side, side);
      return canvas.toDataURL("image/png");
    }, size);
  const url = (path) => new URL(path, a.url()).href;
  const card = `martin-${id}`;
  const keep = async (image) => {
    const before = await (await a.request.get(url("/api/contacts/cards"))).json();
    const saved = await a.request.put(url("/api/contacts/cards"), {
      data: {
        rev: before.rev,
        cards: [
          ...(before.cards ?? []).filter((each) => each.id !== card),
          {
            id: card,
            account: "icloud",
            first: "Martin",
            last: "Hale",
            user: martin.name,
            ...(image ? { image } : {}),
          },
        ],
      },
    });
    if (!saved.ok()) throw new Error(`could not store the card: ${saved.status()}`);
  };
  const put = async (version, size) => {
    const pictured = await a.request.put(url(`/api/contacts/pictures/${card}`), {
      data: { version, image: await paint(size) },
    });
    if (!pictured.ok()) throw new Error(`could not keep the picture: ${pictured.status()}`);
    await keep(version);
  };
  await start(a, martin.name, `to martin ${id}`);
  await within(20_000, () => rowOf(a, `to martin ${id}`).isVisible());
  const picture = rowOf(a, `to martin ${id}`).locator("img.mac-messages-person").first();
  const widthIs = (wanted) =>
    within(20_000, async () =>
      picture
        .evaluate((img, side) => img.complete && img.naturalWidth === side, wanted)
        .catch(() => false),
    ).then((took) => took !== null);

  await put("v1", 64);
  step("a contact picture added shows without a reload", await widthIs(64));
  await put("v2", 32);
  step("one replaced shows the new one", await widthIs(32));
  await shot(a, "messages-pictures");
  const removed = await a.request.delete(url(`/api/contacts/pictures/${card}`));
  if (!removed.ok()) throw new Error(`could not remove the picture: ${removed.status()}`);
  await keep(null);
  step(
    "one removed leaves the initials",
    await seen(
      async () =>
        (await rowOf(a, `to martin ${id}`)
          .locator(".mac-messages-monogram")
          .first()
          .innerText()) === "MH",
    ),
  );

  await put("v3", 64);
  await widthIs(64);
  await a.reload({ waitUntil: "load" });
  await openFromDock(a, "Messages");
  step("a picture is there after a reload", await widthIs(64));
});
