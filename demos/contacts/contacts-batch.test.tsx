import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import {
  beginDesktopValues,
  changeDesktopValue,
  connectDesktopValues,
  desktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { registerFileReceivers, takeSharedFiles } from "../desktop/desktop-share-link";
import { Contacts } from "./contacts";
import { archiveFileName, archiveText, readArchive } from "./contacts-archive";
import {
  addressLines,
  type Contact,
  formatPhone,
  listNameParts,
  withThisAsMine,
} from "./contacts-data";
import { ContactsPreferences } from "./contacts-preferences";
import {
  CONTACTS_ADDRESS_FORMAT,
  CONTACTS_CARD_CHOSEN,
  CONTACTS_GROUP_SHOWN,
  CONTACTS_PHONE_FORMAT,
  CONTACTS_SORT,
  CONTACTS_TEMPLATE,
  CONTACTS_VCARD_NOTES,
} from "./contacts-print";

const ADA: Contact = {
  id: "ada",
  account: "icloud",
  first: "Ada",
  last: "Marsh",
  phones: [{ label: "mobile", value: "5550100000" }],
  note: "ferry",
};
const BEN: Contact = { id: "ben", account: "icloud", first: "Ben", last: "Abbot" };
const MINE: Contact = {
  id: "mine",
  account: "icloud",
  first: "Chris",
  last: "Vale",
  me: true,
  user: "chris",
};

function Menus() {
  const file = useDesktopAppMenuItems("contacts", "File");
  const edit = useDesktopAppMenuItems("contacts", "Edit");
  const card = useDesktopAppMenuItems("contacts", "Card");
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="File">{file}</MenuBarMenu>
      <MenuBarMenu title="Edit">{edit}</MenuBarMenu>
      <MenuBarMenu title="Card">{card}</MenuBarMenu>
    </MenuBar>
  );
}

function open(contacts: readonly Contact[], chosen: string) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <>
      <Menus />
      <Contacts defaultContacts={contacts} defaultContact={chosen} />
    </>,
  );
  return user;
}

async function choose(user: ReturnType<typeof open>, menu: string, row: RegExp) {
  await user.click(screen.getByRole("menuitem", { name: menu }));
  await user.click(await screen.findByRole("menuitem", { name: row }));
}

const rows = () =>
  within(screen.getByRole("listbox", { hidden: true }))
    .getAllByRole("option", { hidden: true })
    .map((row) => row.textContent);

beforeEach(() => beginDesktopValues());

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the names of a row", () => {
  it("bolds the name the list is sorted by, in the order the names are shown", () => {
    expect(listNameParts(ADA, "last", "first")).toEqual(["Ada ", "Marsh", ""]);
    expect(listNameParts(ADA, "first", "first")).toEqual(["", "Ada", " Marsh"]);
    expect(listNameParts(ADA, "last", "last")).toEqual(["", "Marsh", " Ada"]);
    expect(listNameParts(ADA, "first", "last")).toEqual(["Marsh ", "Ada", ""]);
  });

  it("bolds a company or a single name whatever the sort", () => {
    const firm: Contact = { ...BEN, company: "Tide", isCompany: true };
    expect(listNameParts(firm, "first", "first")).toEqual(["", "Tide", ""]);
    expect(listNameParts({ ...BEN, last: "" }, "last", "first")).toEqual(["", "Ben", ""]);
  });
});

describe("addresses and numbers", () => {
  const address = {
    label: "home",
    street: "1 Quay",
    city: "Bonn",
    state: "NW",
    zip: "53111",
    country: "",
  };

  it("lays an address out by format", () => {
    expect(addressLines(address, "us")).toEqual(["1 Quay", "Bonn, NW 53111"]);
    expect(addressLines(address, "uk")).toEqual(["1 Quay", "Bonn", "NW", "53111"]);
    expect(addressLines(address, "de")).toEqual(["1 Quay", "53111 Bonn", "NW"]);
  });

  it("formats North American numbers and leaves the rest as typed", () => {
    expect(formatPhone("5550100000")).toBe("(555) 010-0000");
    expect(formatPhone("1 555 010 0000")).toBe("+1 (555) 010-0000");
    expect(formatPhone("+44 20 7946 0000")).toBe("+44 20 7946 0000");
    expect(formatPhone("ask reception")).toBe("ask reception");
  });
});

describe("Make This My Card", () => {
  it("moves the mark and the account name, and the old card stays", () => {
    expect(withThisAsMine([MINE, ADA], "ada")).toEqual([
      { id: "mine", account: "icloud", first: "Chris", last: "Vale" },
      { ...ADA, me: true, user: "chris" },
    ]);
  });

  it("is a step Undo takes back", async () => {
    const user = open([MINE, ADA], "ada");
    await choose(user, "Card", /^Make This My Card/);
    await waitFor(() => expect(rows()).toContain("Ada Marsh, my card"));
    await choose(user, "Edit", /^Undo Make This My Card/);
    await waitFor(() => expect(rows()).toContain("Chris Vale, my card"));
    expect(rows()).not.toContain("Ada Marsh, my card");
  });
});

describe("Discard Changes", () => {
  it("puts the card back as it was when the edit began, and ends the edit", async () => {
    const user = open([ADA, BEN], "ada");
    await choose(user, "Card", /^Edit Card/);
    fireEvent.change(screen.getByRole("textbox", { name: "First" }), {
      target: { value: "Adelaide" },
    });
    await choose(user, "Card", /^Discard Changes/);
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "First" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Ada Marsh" })).toBeVisible();
    expect(rows()).toEqual(["Ben Abbot", "Ada Marsh"]);
  });

  it("takes away a card just made, with its New Card step", async () => {
    const user = open([ADA, BEN], "ada");
    await choose(user, "File", /^New Card/);
    await waitFor(() => expect(rows()).toHaveLength(3));
    await choose(user, "Card", /^Discard Changes/);
    await waitFor(() => expect(rows()).toEqual(["Ben Abbot", "Ada Marsh"]));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("menuitem", { name: /^Undo/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("is dimmed, saying why, when no card is being edited", async () => {
    const user = open([ADA], "ada");
    await user.click(screen.getByRole("menuitem", { name: "Card" }));
    const row = await screen.findByRole("menuitem", { name: /^Discard Changes/ });
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("title", "Only a card being edited has changes to discard.");
  });
});

describe("Reorder Last Name Before First", () => {
  it("swaps the two names, and Undo swaps them back", async () => {
    const user = open([ADA], "ada");
    await choose(user, "Card", /^Reorder Last Name/);
    await waitFor(() => expect(rows()).toEqual(["Marsh Ada"]));
    await choose(user, "Edit", /^Undo Reorder Names/);
    await waitFor(() => expect(rows()).toEqual(["Ada Marsh"]));
  });
});

describe("a new card's template", () => {
  it("shows the fields Preferences > Template named", async () => {
    changeDesktopValue(CONTACTS_TEMPLATE, ["nickname", "jobTitle"]);
    const user = open([ADA], "ada");
    await choose(user, "File", /^New Card/);
    expect(await screen.findByRole("textbox", { name: /nickname/i })).toBeVisible();
    expect(screen.getByRole("textbox", { name: /job title/i })).toBeVisible();
  });

  it("starts with neither when none is named", async () => {
    const user = open([ADA], "ada");
    await choose(user, "File", /^New Card/);
    await screen.findByRole("textbox", { name: "First" });
    expect(screen.queryByRole("textbox", { name: /nickname/i })).not.toBeInTheDocument();
  });
});

describe("Preferences", () => {
  const openPane = async (name: string) => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ContactsPreferences />);
    await user.click(screen.getByRole("tab", { name }));
    return user;
  };

  it("Accounts turns an account off, and keeps the last one on", async () => {
    const user = await openPane("Accounts");
    await user.click(screen.getByRole("option", { name: "On My Mac" }));
    await user.click(screen.getByRole("checkbox", { name: "Enable this account" }));
    expect(desktopValues()["contacts.accountsOff"]).toEqual(["mac"]);
    await user.click(screen.getByRole("option", { name: "iCloud" }));
    expect(screen.getByRole("checkbox", { name: "Enable this account" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("option", { name: "On My Mac" }));
    await user.click(screen.getByRole("checkbox", { name: "Enable this account" }));
    expect(desktopValues()["contacts.accountsOff"]).toEqual([]);
  });

  it("Template keeps the fields ticked", async () => {
    const user = await openPane("Template");
    await user.click(screen.getByRole("checkbox", { name: "Nickname" }));
    expect(desktopValues()[CONTACTS_TEMPLATE]).toEqual(["nickname"]);
    await user.click(screen.getByRole("checkbox", { name: "Nickname" }));
    expect(desktopValues()[CONTACTS_TEMPLATE]).toEqual([]);
  });

  it("Phone keeps the choice and shows what it does", async () => {
    const user = await openPane("Phone");
    expect(screen.getByText("Numbers are shown as they were typed.")).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: /format phone numbers/ }));
    expect(desktopValues()[CONTACTS_PHONE_FORMAT]).toBe(true);
    expect(screen.getByText("Ten digits read as (555) 010-0000.")).toBeVisible();
  });

  it("vCard keeps whether notes are written", async () => {
    const user = await openPane("vCard");
    await user.click(screen.getByRole("checkbox", { name: /notes/ }));
    expect(desktopValues()[CONTACTS_VCARD_NOTES]).toBe(false);
  });

  it("General has the address format, which a card then follows", async () => {
    act(() => changeDesktopValue(CONTACTS_ADDRESS_FORMAT, "de"));
    render(
      <Contacts
        defaultContacts={[
          {
            ...ADA,
            addresses: [
              {
                label: "home",
                street: "1 Quay",
                city: "Bonn",
                state: "",
                zip: "53111",
                country: "",
              },
            ],
          },
        ]}
        defaultContact="ada"
      />,
    );
    expect(screen.getByRole("group", { name: "address" })).toHaveTextContent("53111 Bonn");
  });

  it("Phone's choice formats the number on a finished card", () => {
    act(() => changeDesktopValue(CONTACTS_PHONE_FORMAT, true));
    render(<Contacts defaultContacts={[ADA]} defaultContact="ada" />);
    expect(screen.getByText("(555) 010-0000")).toBeVisible();
  });
});

describe("the Contacts archive", () => {
  const archive = {
    cards: [ADA],
    groups: [{ id: "g1", name: "Crew", members: ["ada"] }],
    smartGroups: [{ id: "s1", name: "Ferry", rule: "contains" as const, text: "ferry" }],
    pictures: { ada: { version: "v1", image: "data:image/png;base64,AA==" } },
  };

  it("reads back what it wrote", () => {
    expect(readArchive(archiveText(archive))).toEqual(archive);
  });

  it("refuses what it did not write", () => {
    expect(readArchive("not json")).toBeNull();
    expect(readArchive(JSON.stringify({ cards: [ADA] }))).toBeNull();
  });

  it("is named for the day", () => {
    expect(archiveFileName(new Date(2026, 10, 5))).toBe("Contacts - 2026-11-05.abbu");
  });
});

describe("on the served desktop", () => {
  const reply = (status: number, body: unknown) => ({
    ok: status < 300,
    status,
    json: async () => body,
  });

  /** The server, answered by address: `cards`, no groups, the account `chris`. */
  function serve(cards: readonly Contact[], pictures: Record<string, unknown> = {}) {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, "http://desktop.test").pathname;
      if (init?.method === "PUT") return reply(200, JSON.parse(String(init.body)));
      if (init?.method === "DELETE") return reply(200, {});
      if (path === "/api/contacts/me") {
        return reply(200, { name: "chris", full_name: "Chris Vale", guest: false });
      }
      if (path === "/api/contacts/cards") return reply(200, { cards });
      if (path === "/api/contacts/groups") return reply(200, { groups: [] });
      if (path === "/api/contacts/smart-groups") return reply(200, { smart_groups: [] });
      if (path === "/api/contacts/pictures") return reply(200, { pictures });
      return reply(404, { error: "nothing here" });
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  const ready = () =>
    waitFor(() => expect(screen.getByLabelText("vCard file")).toBeInTheDocument());
  const loaded = () =>
    waitFor(() =>
      expect(document.querySelector(".mac-contacts-split")).not.toHaveAttribute("inert"),
    );
  const puts = (fetch: ReturnType<typeof serve>, path: string) =>
    fetch.mock.calls.flatMap(([url, init]) =>
      init?.method === "PUT" && String(url).endsWith(path) ? [JSON.parse(String(init.body))] : [],
    );

  it("replaces everything with an archive, only after the alert", async () => {
    const fetch = serve([MINE, BEN]);
    const user = open([], "");
    await ready();
    await loaded();
    const text = archiveText({
      cards: [{ ...ADA, image: "v1" }],
      groups: [{ id: "g1", name: "Crew", members: ["ada"] }],
      smartGroups: [],
      pictures: { ada: { version: "v1", image: "data:image/png;base64,AA==" } },
    });
    fireEvent.change(screen.getByLabelText("vCard file"), {
      target: { files: [new File([text], "Contacts - 2026-11-05.abbu")] },
    });
    await screen.findByText(/replace your contacts with/);
    expect(rows()).toEqual(["Ben Abbot", "Chris Vale, my card"]);
    await user.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(rows()).toEqual(["Ada Marsh", "Chris Vale, my card"]));
    expect(puts(fetch, "/api/contacts/pictures/ada")).toEqual([
      { version: "v1", image: "data:image/png;base64,AA==" },
    ]);
    await waitFor(() =>
      expect(puts(fetch, "/api/contacts/groups").at(-1)?.groups).toEqual([
        { id: "g1", name: "Crew", members: ["ada"] },
      ]),
    );
    await waitFor(() =>
      expect(
        puts(fetch, "/api/contacts/cards")
          .at(-1)
          ?.cards.map((card: Contact) => [card.id, card.image]),
      ).toEqual([
        ["my-card", undefined],
        ["ada", "v1"],
      ]),
    );
  });

  it("says what is wrong with a file named as an archive that is none", async () => {
    serve([MINE]);
    render(<Contacts />);
    await ready();
    await loaded();
    fireEvent.change(screen.getByLabelText("vCard file"), {
      target: { files: [new File(["{}"], "Old.abbu")] },
    });
    expect(await screen.findByText("“Old.abbu” is not a Contacts archive.")).toBeVisible();
  });

  it("moves the bold in the list when Sort By changes", async () => {
    serve([ADA]);
    render(<Contacts />);
    await ready();
    await loaded();
    const bold = () => screen.getByRole("option", { name: "Ada Marsh" }).querySelector("b");
    expect(bold()?.textContent).toBe("Marsh");
    act(() => changeDesktopValue(CONTACTS_SORT, "first"));
    expect(bold()?.textContent).toBe("Ada");
  });

  it("leaves alone a file dropped on a card's head that is no picture", async () => {
    const fetch = serve([ADA]);
    render(<Contacts />);
    await ready();
    await loaded();
    const head = document.querySelector('.mac-contacts-head[data-mode="view"]') as HTMLElement;
    const file = new File([new Uint8Array([1])], "pic.txt", { type: "text/plain" });
    fireEvent.drop(head, { dataTransfer: { types: ["Files"], files: [file] } });
    // A file that is no picture is left alone: nothing is sent, and nothing is said.
    await new Promise((settle) => setTimeout(settle, 20));
    expect(
      fetch.mock.calls.some(
        ([url, init]) => init?.method === "PUT" && String(url).includes("pictures"),
      ),
    ).toBe(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("reads back the group shown and the card chosen, and then keeps what changes", async () => {
    serve([ADA, BEN, MINE]);
    const stop = connectDesktopValues(() => {});
    receiveDesktopValues({ [CONTACTS_GROUP_SHOWN]: "all", [CONTACTS_CARD_CHOSEN]: "ben" });
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Contacts />);
    await ready();
    await loaded();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Ben Abbot" })).toBeVisible());
    await user.click(screen.getByRole("option", { name: "Ada Marsh" }));
    await waitFor(() => expect(desktopValues()[CONTACTS_CARD_CHOSEN]).toBe("ada"));
    await user.click(screen.getByRole("treeitem", { name: "All on My Mac" }));
    await waitFor(() => expect(desktopValues()[CONTACTS_GROUP_SHOWN]).toBe("mac"));
    stop();
  });

  it("does not write over the place kept before the settings are read", async () => {
    serve([ADA, BEN, MINE]);
    render(<Contacts />);
    await ready();
    await loaded();
    expect(desktopValues()[CONTACTS_GROUP_SHOWN]).toBeUndefined();
    expect(desktopValues()[CONTACTS_CARD_CHOSEN]).toBeUndefined();
  });

  it("shares a card with Notes as a vCard file", async () => {
    serve([ADA]);
    const stop = registerFileReceivers([{ id: "notes", takesSharedFiles: true }]);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Contacts />);
    await ready();
    await loaded();
    await user.click(screen.getByRole("button", { name: /share/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Notes" }));
    const [shared] = takeSharedFiles("notes");
    expect(shared?.items.map(({ name, type }) => [name, type])).toEqual([
      ["Ada Marsh.vcf", "text/vcard"],
    ]);
    const file = await shared?.items[0]?.bytes?.();
    expect(await file?.text()).toContain("FN:Ada Marsh");
    stop();
  });

  it("leaves a card's picture and note out of its vCard when Preferences > vCard says so", async () => {
    serve([{ ...ADA, image: "v1" }], {
      ada: { version: "v1", image: "data:image/png;base64,AA==" },
    });
    const stop = registerFileReceivers([{ id: "notes", takesSharedFiles: true }]);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { unmount } = render(<Contacts />);
    await ready();
    await loaded();
    await user.click(screen.getByRole("button", { name: /share/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Notes" }));
    const whole = await (await takeSharedFiles("notes")[0]?.items[0]?.bytes?.())?.text();
    expect(whole).toContain("NOTE:ferry");
    expect(whole).toContain("PHOTO;ENCODING=b;TYPE=PNG:AA==");
    unmount();
    act(() => {
      changeDesktopValue(CONTACTS_VCARD_NOTES, false);
      changeDesktopValue("contacts.vcardPhotos", false);
    });
    render(<Contacts />);
    await ready();
    await loaded();
    await user.click(screen.getByRole("button", { name: /share/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Notes" }));
    const bare = await (await takeSharedFiles("notes")[0]?.items[0]?.bytes?.())?.text();
    expect(bare).not.toContain("NOTE:");
    expect(bare).not.toContain("PHOTO");
    stop();
  });
});

describe("Transformations and Speech", () => {
  it("changes the text selected in the field being edited", async () => {
    const insert = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: insert });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const user = open([ADA], "ada");
    await choose(user, "Card", /^Edit Card/);
    const field = screen.getByRole<HTMLInputElement>("textbox", { name: "First" });
    field.focus();
    field.setSelectionRange(0, 3);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Transformations" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Make Upper Case" }));
    await waitFor(() => expect(insert).toHaveBeenCalledWith("insertText", false, "ADA"));
    delete (document as { execCommand?: unknown }).execCommand;
  });

  it("speaks the card when nothing is selected, and dims Transformations", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    const user = open([ADA], "ada");
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Transformations" }));
    expect(await screen.findByRole("menuitem", { name: "Capitalize" })).toHaveAttribute(
      "title",
      "Select text in a field of a card being edited.",
    );
    await user.hover(await screen.findByRole("menuitem", { name: "Speech" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Start Speaking" }));
    expect(speak.mock.calls[0]?.[0].text).toContain("Ada Marsh");
  });
});
