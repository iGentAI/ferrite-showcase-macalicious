import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { takeAddressRequests } from "../desktop/desktop-reach";
import { Contacts } from "./contacts";
import { type Contact, withMyCard } from "./contacts-data";
import { cardsFromServer, smartGroupsFromServer } from "./contacts-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ADA = {
  id: "ada",
  account: "icloud",
  first: "Ada",
  last: "Marsh",
  emails: [{ label: "work", value: "ada@marsh.example" }],
};

const CHRIS = { name: "chris", full_name: "Chris Carter", guest: false };
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";

const CARDS = "/api/contacts/cards";
const GROUPS = "/api/contacts/smart-groups";

const pathOf = (url: string) => new URL(url, "http://desktop.test").pathname;
const reply = (status: number, body: unknown) => ({
  ok: status < 300,
  status,
  json: async () => body,
});

/**
 * The desktop's server, answered by address: the cards document, the smart groups, the
 * signed-in account (`me`, nobody by default), the desktop's accounts and the pictures. A `PUT`
 * is answered with what it sent.
 */
function serve(
  cards: unknown,
  {
    me = { name: null } as unknown,
    groups = { smart_groups: null } as unknown,
    users = {} as Record<string, string>,
    pictures = {} as Record<string, unknown>,
  } = {},
) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const path = pathOf(url);
    if (init?.method === "PUT") return reply(200, JSON.parse(String(init.body)));
    if (path === "/api/contacts/me") return reply(200, me);
    if (path === GROUPS) return reply(200, groups);
    if (path === "/api/contacts/pictures") return reply(200, { pictures });
    if (path.startsWith("/api/contacts/users/")) {
      const name = path.slice("/api/contacts/users/".length);
      const fullName = users[name];
      return fullName
        ? reply(200, { name, full_name: fullName })
        : reply(404, { error: `No one on this desktop has the account name “${name}”.` });
    }
    return reply(200, cards);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const saves = (fetch: ReturnType<typeof serve>, url = CARDS) =>
  fetch.mock.calls
    .filter(([to, init]) => init?.method === "PUT" && pathOf(to) === url)
    .map(([to, init]) => ({ url: to, body: JSON.parse(String(init?.body)) }));

const window = () => screen.getByRole("region", { name: "Contacts" });
const names = () =>
  within(within(window()).getByRole("listbox"))
    .getAllByRole("option")
    .map((row) => row.textContent);

const split = () => document.querySelector(".mac-contacts-split") as HTMLElement;
const ready = () => waitFor(() => expect(split()).not.toHaveAttribute("inert"));

/** Choose `item` in the bar's pull-down of desktop commands. */
async function command(user: ReturnType<typeof userEvent.setup>, item: string) {
  await user.click(screen.getByRole("button", { name: "Contacts commands" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

describe("Contacts on the desktop's Ferrite application", () => {
  it("keeps only cards it can show from a reply", () => {
    expect(cardsFromServer({ cards: [ADA, { id: "x", account: "exchange" }] })).toEqual([ADA]);
    expect(cardsFromServer({ cards: null })).toBeUndefined();
    // Optional fields in another shape: the card is left out rather than break the card view.
    expect(
      cardsFromServer({
        cards: [
          { ...ADA, id: "a", emails: "ada@marsh.example" },
          { ...ADA, id: "b", phones: [null] },
          { ...ADA, id: "c", urls: [{ label: "home" }] },
          { ...ADA, id: "d", note: 4 },
          { ...ADA, id: "e", user: "Ada Marsh" },
          { ...ADA, id: "f", image: 3 },
          ADA,
        ],
      }),
    ).toEqual([ADA]);
    const desktop = { ...ADA, id: "m", user: "martin", image: "p-1" };
    expect(cardsFromServer({ cards: [desktop] })).toEqual([desktop]);
    expect(
      smartGroupsFromServer({
        smart_groups: [
          { id: "a", name: "Desk", rule: "desktop-user" },
          { id: "b", name: "Ferry", rule: "contains", text: "ferry" },
          { id: "c", name: "Odd", rule: "everyone" },
          { id: "d", name: "No text", rule: "contains" },
        ],
      })?.map((group) => group.id),
    ).toEqual(["a", "b"]);
  });

  it("asks no server and shows no desktop command when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<Contacts />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Contacts commands" })).toBeNull();
  });

  it("keeps its content inert until the saved cards have loaded", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn((url: string) =>
      pathOf(url) === CARDS
        ? new Promise((resolve) => {
            answer = resolve;
          })
        : Promise.resolve(
            reply(200, pathOf(url) === GROUPS ? { smart_groups: null } : { name: null }),
          ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<Contacts />);
    expect(split()).toHaveAttribute("inert");
    expect(split()).toHaveAttribute("aria-busy", "true");
    await vi.waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => pathOf(url) === CARDS)).toBe(true),
    );
    expect(split()).toHaveAttribute("inert");
    answer(reply(200, { cards: [ADA] }));
    await ready();
    expect(names()).toEqual(["Ada Marsh"]);
  });

  it("shows the session's saved cards and saves a new card as it is typed", async () => {
    const user = userEvent.setup();
    const fetch = serve({ cards: [ADA] });
    render(<Contacts />);
    await waitFor(() => expect(names()).toEqual(["Ada Marsh"]));
    await ready();
    expect(saves(fetch)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "New Contact" }));
    await user.keyboard("Lena");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      const last = saves(fetch).at(-1);
      expect(last?.url).toBe("/api/contacts/cards");
      expect(last?.body.cards.map((card: { first: string }) => card.first)).toEqual([
        "Ada",
        "Lena",
      ]);
    });
  });

  it("gives a new card an id no saved card has, a card made in an earlier session included", async () => {
    const user = userEvent.setup();
    const made = { id: "new-1", account: "icloud", first: "Mia", last: "Earlier" };
    const fetch = serve({ cards: [ADA, made] });
    render(<Contacts />);
    await waitFor(() => expect(names()).toEqual(["Mia Earlier", "Ada Marsh"]));
    await ready();
    await user.click(screen.getByRole("button", { name: "New Contact" }));
    await user.keyboard("Lena");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(saves(fetch).at(-1)?.body.cards).toHaveLength(3));
    const ids = saves(fetch)
      .at(-1)
      ?.body.cards.map((card: { id: string }) => card.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain("new-1");
  });

  it("saves nothing over a stored document whose cards it cannot read", async () => {
    for (const stored of [{ cards: "Ada" }, { cards: { 0: ADA } }, { rev: 3 }]) {
      const user = userEvent.setup();
      const fetch = serve(stored);
      const { unmount } = render(<Contacts />);
      await ready();
      await user.click(screen.getByRole("button", { name: "New Contact" }));
      await user.keyboard("Lena");
      await user.click(screen.getByRole("button", { name: "Done" }));
      await waitFor(() => expect(names()).toContain("Lena"));
      expect(saves(fetch)).toEqual([]);
      unmount();
    }
  });

  it("starts a signed-in person who has saved nothing with only their own card", async () => {
    serve({ cards: null }, { me: CHRIS });
    render(<Contacts />);
    await ready();
    expect(names()).toEqual(["Chris Carter, my card"]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Chris Carter");
    expect(window().querySelector("[data-account]")).toHaveTextContent("chris@macalicious");
  });

  it("gives saved cards My Card, with the account's name, and keeps the person's own edits", () => {
    const account = { name: "chris", fullName: "Chris Carter", guest: false };
    const saved: Contact[] = [{ id: "ada", account: "icloud", first: "Ada", last: "Marsh" }];
    const [mine, ...rest] = withMyCard(saved, account);
    expect(rest).toEqual(saved);
    expect(mine).toEqual({
      id: "my-card",
      account: "icloud",
      first: "Chris",
      last: "Carter",
      me: true,
      user: "chris",
    });
    const renamed: Contact[] = [{ id: "me", account: "mac", first: "C.", last: "", me: true }];
    expect(withMyCard(renamed, account)).toEqual([{ ...renamed[0], user: "chris" }]);
    const kept = withMyCard(renamed, account);
    expect(withMyCard(kept, account)).toBe(kept);
    expect(withMyCard([], { name: "guest", fullName: "Guest User", guest: true })).toEqual([
      { id: "my-card", account: "icloud", first: "Guest", last: "User", me: true },
    ]);
  });

  it("invites the person of a card to Chess, and dims the row on a card with no one's account", async () => {
    const user = userEvent.setup();
    serve({ cards: [ADA, { ...ADA, id: "m", first: "Martin", user: "martin" }] }, { me: CHRIS });
    render(<Contacts />);
    await ready();
    const row = (name: RegExp) => within(window()).getByRole("option", { name });

    await user.click(row(/^Ada/));
    await user.click(screen.getByRole("button", { name: "Contacts commands" }));
    const dimmed = await screen.findByRole("menuitem", { name: "Invite to Chess…" });
    expect(dimmed).toHaveAttribute("aria-disabled", "true");
    expect(dimmed).toHaveAttribute("title", "This card has no account on this desktop.");
    await user.keyboard("{Escape}");

    await user.click(row(/^Martin/));
    await command(user, "Invite to Chess…");
    expect(takeAddressRequests("chess")).toEqual([
      { app: "chess", to: "martin", name: "Martin Marsh" },
    ]);
  });

  it("adds a desktop user by account name, and says when no account has the name", async () => {
    const user = userEvent.setup();
    const fetch = serve({ cards: [ADA] }, { me: CHRIS, users: { martin: "Martin Klein" } });
    render(<Contacts />);
    await ready();
    expect(names()).toEqual(["Chris Carter, my card", "Ada Marsh"]);

    await command(user, "Add Desktop User…");
    const sheet = await screen.findByRole("dialog", { name: "Add a Desktop User" });
    await user.type(within(sheet).getByRole("textbox", { name: "Account Name" }), "nobody");
    await user.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "No one on this desktop has the account name “nobody”.",
    );
    await user.clear(within(sheet).getByRole("textbox", { name: "Account Name" }));
    await user.type(within(sheet).getByRole("textbox", { name: "Account Name" }), "chris");
    await user.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(within(sheet).getByRole("alert")).toHaveTextContent("your own account");
    await user.clear(within(sheet).getByRole("textbox", { name: "Account Name" }));
    await user.type(within(sheet).getByRole("textbox", { name: "Account Name" }), "Martin");
    await user.click(within(sheet).getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Martin Klein"),
    );
    expect(window().querySelector("[data-account]")).toHaveTextContent("martin@macalicious");
    const actions = screen.getByRole("group", { name: "Actions" });
    expect(within(actions).getByRole("button", { name: "message" })).toBeEnabled();
    expect(within(actions).getByRole("button", { name: "mail" })).toBeEnabled();
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.cards).toEqual([
        expect.objectContaining({ id: "my-card", me: true, user: "chris" }),
        ADA,
        expect.objectContaining({ first: "Martin", last: "Klein", user: "martin" }),
      ]),
    );

    // The same account again shows the card it already has.
    await command(user, "Add Desktop User…");
    const again = await screen.findByRole("dialog", { name: "Add a Desktop User" });
    await user.type(within(again).getByRole("textbox", { name: "Account Name" }), "martin");
    await user.click(within(again).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(names().filter((name) => name?.startsWith("Martin"))).toHaveLength(1);
  });

  it("keeps a smart group of desktop users in a document of its own", async () => {
    const user = userEvent.setup();
    const martin = { id: "m", account: "icloud", first: "Martin", last: "Klein", user: "martin" };
    const fetch = serve({ cards: [ADA, martin] }, { me: CHRIS });
    render(<Contacts />);
    await ready();
    await command(user, "New Smart Group…");
    const sheet = await screen.findByRole("dialog", { name: "New Smart Group" });
    await user.type(within(sheet).getByRole("textbox", { name: "Smart Group Name" }), "Desk");
    await user.click(within(sheet).getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(screen.getByRole("treeitem", { name: "Desk" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(names()).toEqual(["Martin Klein"]);
    await waitFor(() =>
      expect(saves(fetch, GROUPS).at(-1)?.body.smart_groups).toEqual([
        {
          id: expect.any(String),
          name: "Desk",
          rule: "rules",
          conditions: [{ field: "user", test: "yes", value: "" }],
        },
      ]),
    );

    await command(user, "Delete Smart Group “Desk”");
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("treeitem", { name: "Desk" })).toBeNull());
    expect(screen.getByRole("treeitem", { name: "All Contacts" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await waitFor(() => expect(saves(fetch, GROUPS).at(-1)?.body.smart_groups).toEqual([]));
  });

  it("lists a saved smart group that finds cards by any field", async () => {
    serve(
      { cards: [ADA, { id: "b", account: "mac", first: "Ben", last: "Abbot", note: "ferry" }] },
      { groups: { smart_groups: [{ id: "g", name: "Ferry", rule: "contains", text: "Ferry" }] } },
    );
    const user = userEvent.setup();
    render(<Contacts />);
    await ready();
    await user.click(screen.getByRole("treeitem", { name: "Ferry" }));
    expect(names()).toEqual(["Ben Abbot"]);
  });

  it("shows a card's own picture once it has loaded", async () => {
    const fetch = serve(
      { cards: [{ ...ADA, image: "v1" }] },
      { pictures: { ada: { version: "v1", image: JPEG } } },
    );
    render(<Contacts />);
    await ready();
    await waitFor(() =>
      expect(window().querySelector(".mac-contacts-picture-image")).toHaveAttribute("src", JPEG),
    );
    expect(fetch.mock.calls.some(([url]) => url === "/api/contacts/pictures?ids=ada")).toBe(true);
  });

  it("imports the cards of a vCard file from the computer", async () => {
    const user = userEvent.setup();
    const fetch = serve({ cards: [ADA] }, { me: CHRIS });
    render(<Contacts />);
    await ready();
    const file = new File(
      [
        [
          "BEGIN:VCARD",
          "VERSION:3.0",
          "N:Brandt;Lena;;;",
          "EMAIL;TYPE=INTERNET;TYPE=HOME:lena@brandt.example",
          "END:VCARD",
          "BEGIN:VCARD",
          "VERSION:3.0",
          "N:Klein;Martin;;;",
          "X-MACALICIOUS-USER:martin",
          "END:VCARD",
        ].join("\r\n"),
      ],
      "Friends.vcf",
      { type: "text/vcard" },
    );
    fireEvent.change(screen.getByLabelText("vCard file"), { target: { files: [file] } });
    expect(await screen.findByText("2 cards were imported.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(names()).toEqual(["Lena Brandt", "Chris Carter, my card", "Martin Klein", "Ada Marsh"]);
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.cards).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            first: "Lena",
            emails: [{ label: "home", value: "lena@brandt.example" }],
          }),
          expect.objectContaining({ first: "Martin", user: "martin" }),
        ]),
      ),
    );
  });

  it("leaves a card the person moved to alone when a slow delete of another finishes", async () => {
    const user = userEvent.setup();
    const BEN = { ...ADA, id: "ben", first: "Ben", last: "Abbot" };
    const fetch = serve({ cards: [{ ...ADA, image: "v1" }, BEN] });
    const served = fetch.getMockImplementation() as typeof globalThis.fetch;
    let answer = () => {};
    fetch.mockImplementation(async (url, init) => {
      if (init?.method === "DELETE") {
        await new Promise<void>((resolve) => {
          answer = resolve;
        });
        return reply(200, {});
      }
      return served(url, init) as never;
    });
    render(<Contacts />);
    await ready();
    const rows = () => within(within(window()).getByRole("listbox")).getAllByRole("option");
    const row = (name: RegExp) => rows().find((each) => name.test(each.textContent ?? ""));
    await user.click(row(/Marsh/) as HTMLElement);
    fireEvent.keyDown(within(window()).getByRole("listbox"), { key: "Delete" });
    const alert = await screen.findByRole("alertdialog");
    await user.click(within(alert).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await user.click(row(/Abbot/) as HTMLElement);
    await user.click(within(window()).getByRole("button", { name: "Edit" }));
    const done = within(window()).getByRole("button", { name: "Done" });
    answer();
    await waitFor(() => expect(names()).toEqual(["Ben Abbot"]));
    expect(done).toBeInTheDocument();
    expect(row(/Abbot/)).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the picture of an imported vCard on its card", async () => {
    const fetch = serve({ cards: [ADA] }, { me: CHRIS });
    render(<Contacts />);
    await ready();
    const file = new File(
      [
        [
          "BEGIN:VCARD",
          "VERSION:3.0",
          "N:Brandt;Lena;;;",
          "PHOTO:data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
          "END:VCARD",
        ].join("\r\n"),
      ],
      "Lena.vcf",
      { type: "text/vcard" },
    );
    fireEvent.change(screen.getByLabelText("vCard file"), { target: { files: [file] } });
    expect(await screen.findByText("1 card was imported.")).toBeVisible();
    expect(screen.queryByText("Pictures that are not JPEG or PNG were left out.")).toBeNull();
    await waitFor(() => {
      const lena = saves(fetch)
        .at(-1)
        ?.body.cards.find((card: { first?: string }) => card.first === "Lena");
      expect(lena?.image).toEqual(expect.any(String));
    });
    const put = fetch.mock.calls.find(
      ([url, init]) => String(url).includes("/api/contacts/pictures/") && init?.method === "PUT",
    );
    expect(JSON.parse(String(put?.[1]?.body)).image).toBe(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
    );
  });

  it("says a picture in a vCard that is not a JPEG or PNG was left out", async () => {
    serve({ cards: [ADA] }, { me: CHRIS });
    render(<Contacts />);
    await ready();
    const file = new File(
      [
        [
          "BEGIN:VCARD",
          "VERSION:3.0",
          "N:Brandt;Lena;;;",
          "PHOTO;ENCODING=b;TYPE=GIF:R0lGODlhAQABAAAAACw=",
          "END:VCARD",
        ].join("\r\n"),
      ],
      "Lena.vcf",
      { type: "text/vcard" },
    );
    fireEvent.change(screen.getByLabelText("vCard file"), { target: { files: [file] } });
    expect(await screen.findByText("1 card was imported.")).toBeVisible();
    expect(screen.getByText("Pictures that are not JPEG or PNG were left out.")).toBeVisible();
  });
});
