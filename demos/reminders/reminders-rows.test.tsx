import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { readKeptText } from "../desktop/desktop-kept-text";
import {
  connectDesktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { takeMapsSearch } from "../maps/maps-open";
import { peekPaneRequest } from "../system-preferences/pane-request";
import { RemindersView, type RemindersViewProps, SHARE_UNAVAILABLE } from "./reminders";
import type { Reminder, ReminderList } from "./reminders-data";
import { dayOf } from "./reminders-data";
import {
  copyReminderDetails,
  forgetGoneDetails,
  PICTURE_UNREADABLE,
  reminderDetail,
  reminderPictures,
} from "./reminders-details";
import { NO_MAPS } from "./reminders-info";
import { REMINDERS_SHARED_ALERTS, REMINDERS_TODAY_NOTIFICATION } from "./reminders-kept";
import { changeOfPlace, metresBetween, placeCrossing } from "./reminders-location";
import { RemindersPreferences } from "./reminders-preferences";
import { sharedReminderKey } from "./reminders-shared";

vi.mock("../contacts/contacts-people", () => ({
  useContactPeople: () => [
    { name: "Anna Lind", to: "anna" },
    { name: "Bo Ek", to: "bo" },
  ],
}));

const LISTS: readonly ReminderList[] = [
  { id: "home", name: "Home", color: "green" },
  { id: "work", name: "Work", color: "blue" },
];
const REMINDERS: readonly Reminder[] = [
  { id: "milk", listId: "home", title: "Buy milk", notes: "Oat" },
  { id: "eggs", listId: "home", title: "Buy eggs" },
];

const row = (title: string) => {
  const found = screen
    .getAllByRole("option")
    .find((each) => each.querySelector(".mac-reminders-text")?.textContent === title);
  if (!found) throw new Error(`no reminder titled ${title}`);
  return found;
};
const titles = () =>
  [...document.querySelectorAll(".mac-reminders-text")].map((each) => each.textContent);
const listRow = (name: string) =>
  screen.getByRole("treeitem", { name: new RegExp(`^${name}\\s*\\d+$`) });

function AppMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("reminders", title);
  return (
    <Menu>
      <MenuTrigger>{title}</MenuTrigger>
      <MenuPopup>{items}</MenuPopup>
    </Menu>
  );
}

const view = (props: Partial<RemindersViewProps> = {}) => (
  <RemindersView
    defaultLists={LISTS}
    defaultReminders={REMINDERS}
    defaultSource="home"
    {...props}
  />
);

const stubPictures = () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (file: File) => {
      if (file.type === "image/broken") throw new Error("not a picture");
      return { width: 480, height: 240, close: () => {} };
    }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: () => {},
  } as unknown as RenderingContext);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,AAAA");
};

let write = vi.fn();
let stop = () => {};
beforeEach(() => {
  receiveDesktopValues({});
  write = vi.fn();
  stop = connectDesktopValues(write);
});
afterEach(() => {
  stop();
  forgetDesktopValues();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Reminders > Accounts…", () => {
  it("asks System Preferences for Internet Accounts", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AppMenu title="Reminders" />
        {view()}
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Reminders" }));
    await user.click(await screen.findByRole("menuitem", { name: "Accounts…" }));
    expect(peekPaneRequest()).toBe("internet-accounts");
  });
});

describe("File > Share List…", () => {
  it("is dimmed with its reason for a person who cannot share", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AppMenu title="File" />
        {view()}
      </>,
    );
    await user.click(screen.getByRole("button", { name: "File" }));
    const item = await screen.findByRole("menuitem", { name: "Share List…" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("title", SHARE_UNAVAILABLE);
  });

  it("opens the list's sharing for the list shown", async () => {
    const user = userEvent.setup();
    const none = async () => null;
    render(
      <>
        <AppMenu title="File" />
        {view({
          sharing: { me: "me", share: none, add: none, remove: none, leave: none, stop: none },
        })}
      </>,
    );
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: "Share List…" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Home");
  });
});

describe("Edit's text commands", () => {
  it("dims Spelling and Substitutions until a reminder is selected", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AppMenu title="Edit" />
        {view()}
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("menuitem", { name: "Spelling and Grammar" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Substitutions" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows the Spelling panel over the selected reminder, whose text it changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("buy\nmilk\noat\n")),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <AppMenu title="Edit" />
        {view()}
      </>,
    );
    await user.click(row("Buy milk"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(await screen.findByRole("menuitem", { name: "Spelling and Grammar" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Show Spelling and Grammar" }));
    expect(await screen.findByRole("dialog", { name: "Spelling and Grammar" })).toBeInTheDocument();
    const text = document.querySelector<HTMLTextAreaElement>(".mac-reminders-tool-panels textarea");
    expect(text?.value).toBe("Buy milk\nOat");
    fireEvent.change(text as HTMLTextAreaElement, { target: { value: "Buy mlik\nOats" } });
    expect(titles()).toEqual(["Buy mlik", "Buy eggs"]);
    // A text left with no title is no reminder: the title stays.
    fireEvent.change(text as HTMLTextAreaElement, { target: { value: "" } });
    expect(titles()).toEqual(["Buy mlik", "Buy eggs"]);
  });

  it("speaks the titles of the selected reminders", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(readonly text: string) {}
      },
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <AppMenu title="Edit" />
        {view()}
      </>,
    );
    await user.click(row("Buy milk"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(await screen.findByRole("menuitem", { name: "Speech" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Start Speaking" }));
    expect(speak.mock.calls[0]?.[0].text).toBe("Buy milk");
  });

  it("turns quotes and hyphens smart as they are typed in a reminder's notes", async () => {
    const user = userEvent.setup();
    render(view());
    await user.click(row("Buy eggs"));
    await user.click(row("Buy eggs").querySelector("[data-reminder-info]") as Element);
    const notes = within(await screen.findByRole("dialog")).getByRole("textbox", { name: "Notes" });
    await user.type(notes, 'say "hi" -- now');
    expect(notes).toHaveValue("say “hi” — now");
    expect(notes).toHaveAttribute("spellcheck", "true");
  });
});

describe("a reminder's pictures", () => {
  const showInfo = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(row(title).querySelector("[data-reminder-info]") as Element);
    return screen.findByRole("dialog");
  };

  it("keeps a chosen picture, draws it in the row, and takes it off again", async () => {
    stubPictures();
    const user = userEvent.setup();
    render(view());
    const info = await showInfo(user, "Buy eggs");
    await user.upload(
      within(info).getByLabelText("Image file"),
      new File(["x"], "eggs.png", { type: "image/png" }),
    );
    await waitFor(() =>
      expect(row("Buy eggs").querySelector("img")).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,AAAA",
      ),
    );
    expect(reminderPictures("eggs")).toEqual(["data:image/jpeg;base64,AAAA"]);
    expect(write).toHaveBeenCalledWith("reminders.picture.eggs", '["data:image/jpeg;base64,AAAA"]');

    await user.click(within(info).getByRole("combobox", { name: "images" }));
    await user.click(await screen.findByRole("option", { name: "Remove Image" }));
    await waitFor(() => expect(reminderPictures("eggs")).toEqual([]));
    expect(row("Buy eggs").querySelector(".mac-reminders-thumbnail")).toBeNull();
  });

  it("says when a file is no picture, and adds nothing", async () => {
    stubPictures();
    const user = userEvent.setup({ applyAccept: false });
    render(view());
    const info = await showInfo(user, "Buy eggs");
    await user.upload(
      within(info).getByLabelText("Image file"),
      new File(["x"], "eggs.bin", { type: "image/broken" }),
    );
    expect(await within(info).findByRole("status")).toHaveTextContent(PICTURE_UNREADABLE);
    expect(within(info).queryByRole("combobox", { name: "images" })).toBeNull();
  });

  it("takes a picture dropped on a row, and leaves other files", async () => {
    stubPictures();
    render(view());
    const dataTransfer = (file: File) => ({
      types: ["Files"],
      files: [file],
      dropEffect: "",
      getData: () => "",
    });
    const png = dataTransfer(new File(["x"], "a.png", { type: "image/png" }));
    expect(fireEvent.dragOver(row("Buy milk"), { dataTransfer: png })).toBe(false);
    expect(png.dropEffect).toBe("copy");
    fireEvent.drop(row("Buy milk"), { dataTransfer: png });
    await waitFor(() => expect(row("Buy milk").querySelector("img")).not.toBeNull());

    fireEvent.drop(row("Buy eggs"), {
      dataTransfer: dataTransfer(new File(["x"], "a.txt", { type: "text/plain" })),
    });
    await act(async () => {});
    expect(row("Buy eggs").querySelector(".mac-reminders-thumbnail")).toBeNull();
  });
});

describe("what is dropped on a list", () => {
  it("makes a reminder of a link, with its address, in that list", () => {
    const dataTransfer = {
      types: ["text/uri-list", "application/x-macalicious-link-title"],
      effectAllowed: "all",
      dropEffect: "",
      getData: (type: string) =>
        ({
          "text/uri-list": "https://apple.com/",
          "application/x-macalicious-link-title": "Apple",
        })[type] ?? "",
    };
    const onDataChange = vi.fn();
    render(view({ onDataChange }));
    expect(fireEvent.dragOver(listRow("Work"), { dataTransfer })).toBe(false);
    expect(dataTransfer.dropEffect).toBe("copy");
    fireEvent.drop(listRow("Work"), { dataTransfer });
    expect(onDataChange.mock.lastCall?.[0].reminders.at(-1)).toMatchObject({
      listId: "work",
      title: "Apple",
      url: "https://apple.com/",
    });
  });

  it("makes a reminder of each message from Mail, with who sent it in its notes", () => {
    const onDataChange = vi.fn();
    render(view({ onDataChange }));
    fireEvent.drop(listRow("Work"), {
      dataTransfer: {
        types: ["application/x-macalicious-mail", "text/plain"],
        getData: (type: string) =>
          type === "text/plain"
            ? "Anna Lind: Lunch: Friday?\nBo Ek: Invoice"
            : type === "application/x-macalicious-mail"
              ? '["m1","m2"]'
              : "",
      },
    });
    expect(
      onDataChange.mock.lastCall?.[0].reminders
        .slice(2)
        .map(({ listId, title, notes }: Reminder) => ({ listId, title, notes })),
    ).toEqual([
      { listId: "work", title: "Lunch: Friday?", notes: "From Anna Lind" },
      { listId: "work", title: "Invoice", notes: "From Bo Ek" },
    ]);
  });
});

describe("At a Location and When Messaging a Person", () => {
  const located: Reminder = { id: "bank", listId: "home", title: "Bank", atLocation: true };
  const showBank = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(row("Bank").querySelector("[data-reminder-info]") as Element);
    return screen.findByRole("dialog");
  };

  it("keeps the place, says when the alert comes, and has Maps find it on a desktop", async () => {
    const user = userEvent.setup();
    render(view({ defaultReminders: [located], DesktopWindow: (() => null) as never }));
    const info = await showBank(user);
    expect(info).toHaveTextContent("Enter a place to be reminded when you arrive or leave.");
    expect(within(info).getByRole("button", { name: "Show in Maps" })).toBeDisabled();
    await user.type(within(info).getByRole("textbox", { name: "Location" }), "Kungsgatan 1");
    expect(reminderDetail("bank").place).toBe("Kungsgatan 1");
    expect(info).toHaveTextContent(
      "The alert comes while Reminders is open and this browser gives its location.",
    );
    await user.click(within(info).getByRole("button", { name: "Show in Maps" }));
    expect(takeMapsSearch()).toBe("Kungsgatan 1");
  });

  it("fires on the crossing it asks for, and never on the first position", () => {
    expect(placeCrossing({}, 50)).toEqual({ inside: true, fires: false });
    expect(placeCrossing({ inside: false }, 199)).toEqual({ inside: true, fires: true });
    expect(placeCrossing({ inside: true }, 201)).toEqual({ inside: false, fires: false });
    expect(placeCrossing({ inside: true, leaving: true }, 201)).toEqual({
      inside: false,
      fires: true,
    });
    expect(placeCrossing({ inside: false, leaving: true }, 10)).toEqual({
      inside: true,
      fires: false,
    });
  });

  it("measures a kilometre north as a kilometre", () => {
    const metres = metresBetween({ lat: 59, lon: 18 }, { lat: 59.009, lon: 18 });
    expect(Math.round(metres)).toBe(1001);
  });

  it("forgets what it worked out from the old place when the place changes", () => {
    expect(JSON.parse(JSON.stringify(changeOfPlace("Bank")))).toEqual({ place: "Bank" });
  });

  it("dims Show in Maps outside a desktop, with why", async () => {
    const user = userEvent.setup();
    render(view({ defaultReminders: [located] }));
    const info = await showBank(user);
    await user.type(within(info).getByRole("textbox", { name: "Location" }), "Home");
    const maps = within(info).getByRole("button", { name: "Show in Maps" });
    expect(maps).toBeDisabled();
    expect(maps).toHaveAttribute("title", NO_MAPS);
  });

  it("chooses the person from Contacts and keeps them", async () => {
    const user = userEvent.setup();
    render(
      view({
        defaultReminders: [{ id: "bank", listId: "home", title: "Bank", whenMessaging: true }],
      }),
    );
    const info = await showBank(user);
    const person = within(info).getByRole("combobox", { name: "Person" });
    expect(person).toHaveTextContent("Add Contact");
    await user.click(person);
    await user.click(await screen.findByRole("option", { name: "Bo Ek" }));
    expect(reminderDetail("bank").person).toEqual({ name: "Bo Ek", to: "bo" });
    await waitFor(() => expect(person).toHaveTextContent("Bo Ek"));
  });
});

describe("kept details", () => {
  it("go with a pasted copy, and go when their reminder is gone", async () => {
    receiveDesktopValues({
      "reminders.details": JSON.stringify({ old: { place: "Here" }, "sh-1/x": { place: "There" } }),
      "reminders.picture.old": JSON.stringify(["data:a"]),
      "reminders.picture.sh-1__x": JSON.stringify(["data:b"]),
    });
    copyReminderDetails("old", "copy");
    expect(reminderDetail("copy").place).toBe("Here");
    expect(reminderPictures("copy")).toEqual(["data:a"]);

    forgetGoneDetails(new Set(["copy"]));
    expect(reminderDetail("old")).toEqual({});
    expect(reminderPictures("old")).toEqual([]);
    expect(reminderDetail("copy").place).toBe("Here");
    expect(reminderDetail("sh-1/x").place).toBe("There");
    expect(readKeptText("reminders.picture.sh-1__x")).toBe('["data:b"]');
  });
});

describe("alerts the window watches for itself", () => {
  const shared = {
    id: "sh-1",
    name: "Trip",
    color: "purple",
    owned: false,
    owner: { name: "anna", fullName: "Anna" },
    members: [],
    reminders: [
      { id: "passport", listId: "sh-1", title: "Passport", due: "2020-01-01", dueTime: "09:00" },
    ],
  } as unknown as NonNullable<RemindersViewProps["sharedLists"]>[number];

  it("raises a shared list's reminder that just fell due, and keeps it closed", async () => {
    const now = new Date();
    const due = new Date(now.getTime() - 3_600_000);
    const pad = (value: number) => String(value).padStart(2, "0");
    const list = {
      ...shared,
      reminders: [
        {
          id: "passport",
          listId: "sh-1",
          title: "Passport",
          due: dayOf(due),
          dueTime: `${pad(due.getHours())}:${pad(due.getMinutes())}`,
        },
      ],
    };
    const user = userEvent.setup();
    render(view({ alertHost: true, sharedLists: [list] }));
    const alert = await screen.findByRole("alert", { name: "Reminders" });
    expect(alert).toHaveTextContent("Passport");
    await user.click(within(alert).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("alert", { name: "Reminders" })).toBeNull());
    expect(write).toHaveBeenCalledWith(
      REMINDERS_SHARED_ALERTS,
      expect.objectContaining({ [sharedReminderKey("sh-1", "passport")]: expect.any(Number) }),
    );
  });

  it("raises none in a window that does not draw the alerts", () => {
    render(view({ sharedLists: [shared] }));
    expect(screen.queryByRole("alert", { name: "Reminders" })).toBeNull();
  });

  it("shows the Today notification once it is due, once a day", async () => {
    const today = dayOf(new Date());
    receiveDesktopValues({
      [REMINDERS_TODAY_NOTIFICATION]: { on: true, time: "00:00" },
    });
    const user = userEvent.setup();
    render(
      view({
        alertHost: true,
        today,
        defaultReminders: [
          { id: "a", listId: "home", title: "One", due: today },
          { id: "b", listId: "home", title: "Two", due: today },
          { id: "c", listId: "home", title: "Later", due: "2999-01-01" },
        ],
      }),
    );
    const alert = await screen.findByRole("alert", { name: "Reminders" });
    expect(alert).toHaveTextContent("2 reminders are due today");
    await user.click(within(alert).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByText("2 reminders are due today")).toBeNull());
    expect(write).toHaveBeenCalledWith(REMINDERS_TODAY_NOTIFICATION, {
      on: true,
      time: "00:00",
      closedOn: today,
    });
  });
});

describe("Reminders > Preferences", () => {
  it("turns the Today notification on, at 9:00 until it is changed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("null")),
    );
    const user = userEvent.setup();
    render(<RemindersPreferences />);
    const time = screen.getByRole("group", { name: "Today Notification Time" });
    expect(time).toHaveTextContent(/9/);
    await user.click(screen.getByRole("checkbox", { name: "Today Notification:" }));
    expect(write).toHaveBeenCalledWith(REMINDERS_TODAY_NOTIFICATION, {
      on: true,
      time: "09:00",
    });
  });
});
