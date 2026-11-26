import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { app, contactsApp } from "./app";
import { Contacts } from "./contacts";
import { NO_ADDRESS, NOT_SET_UP } from "./contacts-card";
import {
  addressFor,
  type Contact,
  displayName,
  fold,
  initialsOf,
  labelOf,
  matches,
  nextLabel,
  secondaryName,
  sortContacts,
  tidy,
} from "./contacts-data";

/**
 * jsdom has no layout, so the list view renders its first 40 rows and the menus are placed
 * by Base UI without measurements. Geometry is checked by the visual comparisons in Chromium.
 */
const frame = () => screen.getByRole("region", { name: "Contacts" });
// The name list. A label's open pop-up menu is a list box too, outside the window.
const list = () => within(frame()).getByRole("listbox");
const names = () =>
  within(list())
    .getAllByRole("option")
    .map((row) => row.textContent);
const entry = (name: string) => within(list()).getByRole("option", { name });
const group = (name: string) => screen.getByRole("treeitem", { name });
const heading = () => screen.getByRole("heading", { level: 2 });
const button = (name: string) => screen.getByRole("button", { name });
const field = (name: string) => screen.getByRole("textbox", { name });

const PEOPLE: readonly Contact[] = [
  {
    id: "ada",
    account: "icloud",
    first: "Ada",
    last: "Marsh",
    phones: [{ label: "mobile", value: "555 0101" }],
    emails: [{ label: "work", value: "ada@marsh.example" }],
  },
  { id: "ben", account: "mac", first: "Ben", last: "Abbot", note: "Plays the cello." },
];

describe("Contacts", () => {
  it("shows the groups, the names in order and the card of the captured contact", () => {
    render(<Contacts />);
    expect(frame()).toHaveClass("mac-window", "mac-contacts");
    expect(group("All Contacts")).toHaveAttribute("aria-selected", "true");
    expect(group("All iCloud")).toHaveAttribute("aria-selected", "false");
    expect(group("All on My Mac")).toHaveAttribute("aria-selected", "false");
    // By the last name, and a company by its own.
    expect(names()).toEqual([
      "Apple Inc.",
      "Mara Delgado",
      "Stephen Hackett",
      "Island Post",
      "Tomas Lindqvist",
      "Ines Okafor",
      "Robin Vega",
      "Jun Watanabe",
    ]);
    expect(entry("Stephen Hackett")).toHaveAttribute("aria-selected", "true");
    expect(heading()).toHaveTextContent("Stephen Hackett");
    expect(screen.getByText("stephen@example.com")).toBeInTheDocument();
    expect(button("Edit")).toBeEnabled();
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Search");
  });

  it("shows a contact's card when the contact is selected in the list", async () => {
    const user = userEvent.setup();
    const onContactChange = vi.fn();
    render(<Contacts onContactChange={onContactChange} />);
    await user.click(entry("Ines Okafor"));
    expect(onContactChange).toHaveBeenCalledExactlyOnceWith("ines-okafor");
    expect(entry("Ines Okafor")).toHaveAttribute("aria-selected", "true");
    expect(entry("Stephen Hackett")).toHaveAttribute("aria-selected", "false");
    expect(heading()).toHaveTextContent("Ines Okafor");
    // Her card, not the one that was shown: her company, numbers, address and note.
    expect(screen.getByText("Harbor Ferry")).toBeInTheDocument();
    expect(screen.getByText("(555) 010-0142")).toBeInTheDocument();
    expect(screen.getByText("ines@harborferry.example")).toBeInTheDocument();
    expect(screen.getByText("Runs the Saturday crossings.")).toBeInTheDocument();
    expect(screen.queryByText("stephen@example.com")).not.toBeInTheDocument();
    // The arrow keys move through the list, and the card follows.
    await user.keyboard("{ArrowDown}");
    expect(heading()).toHaveTextContent("Robin Vega");
    expect(onContactChange).toHaveBeenLastCalledWith("robin-vega");
  });

  it("lists the contacts that hold the searched text, and shows the first of them", async () => {
    const user = userEvent.setup();
    render(<Contacts />);
    const search = screen.getByRole("searchbox");
    // A company's name is searched with the names; the card that was shown is not a match.
    await user.type(search, "ferry");
    expect(names()).toEqual(["Ines Okafor"]);
    expect(heading()).toHaveTextContent("Ines Okafor");
    await user.clear(search);
    await user.type(search, "ISLANDPOST");
    expect(names()).toEqual(["Island Post", "Jun Watanabe"]);
    // Clearing the field brings every name back, and the card that was chosen.
    await user.clear(search);
    expect(names()).toHaveLength(8);
    expect(heading()).toHaveTextContent("Stephen Hackett");
    await user.type(search, "zzz");
    expect(screen.getByRole("status")).toHaveTextContent("No Results");
    expect(within(frame()).queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("No Card Selected")).toBeInTheDocument();
    expect(button("Edit")).toBeDisabled();
    expect(button("Share")).toBeDisabled();
  });

  it("lists one account's contacts when its group is selected", async () => {
    const user = userEvent.setup();
    render(<Contacts />);
    await user.click(group("All on My Mac"));
    expect(group("All on My Mac")).toHaveAttribute("aria-selected", "true");
    expect(names()).toEqual(["Apple Inc.", "Mara Delgado", "Island Post", "Robin Vega"]);
    expect(list()).toHaveAccessibleName("All on My Mac");
    // The chosen card is not in this group: the first of the list is shown.
    expect(heading()).toHaveTextContent("Apple Inc.");
    await user.click(group("All iCloud"));
    expect(names()).toEqual(["Stephen Hackett", "Tomas Lindqvist", "Ines Okafor", "Jun Watanabe"]);
    expect(heading()).toHaveTextContent("Stephen Hackett");
  });

  it("edits the card between Edit and Done, and keeps what was typed", async () => {
    const user = userEvent.setup();
    render(<Contacts />);
    await user.click(button("Edit"));
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(field("First")).toHaveValue("Stephen");
    expect(field("Last")).toHaveValue("Hackett");
    expect(field("work email")).toHaveValue("stephen@example.com");

    await user.clear(field("Last"));
    await user.type(field("Last"), "Hale");
    // The list follows the name as it is typed.
    expect(entry("Stephen Hale")).toHaveAttribute("aria-selected", "true");
    // The empty field of a kind takes a value and stays the same field while it does.
    await user.type(field("mobile phone"), "555 0123");
    expect(field("mobile phone")).toHaveFocus();
    expect(field("mobile phone")).toHaveValue("555 0123");
    // Another empty field follows it, with the next label.
    expect(field("iPhone phone")).toHaveValue("");
    await user.type(field("birthday"), "May 2");

    await user.click(button("Done"));
    expect(heading()).toHaveTextContent("Stephen Hale");
    expect(screen.getByText("555 0123")).toBeInTheDocument();
    expect(screen.getByText("May 2")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "First" })).not.toBeInTheDocument();
    // What was typed is still there when the card is edited again.
    await user.click(button("Edit"));
    expect(field("Last")).toHaveValue("Hale");
    expect(field("mobile phone")).toHaveValue("555 0123");
  });

  it("ends an edit when another contact is chosen", async () => {
    const user = userEvent.setup();
    render(<Contacts />);
    await user.click(button("Edit"));
    await user.type(field("note"), "Writes about old Macs.");
    await user.click(entry("Robin Vega"));
    expect(heading()).toHaveTextContent("Robin Vega");
    expect(button("Edit")).toBeInTheDocument();
    await user.click(entry("Stephen Hackett"));
    expect(screen.getByText("Writes about old Macs.")).toBeInTheDocument();
  });

  it("removes a field with its remove button", async () => {
    const user = userEvent.setup();
    render(<Contacts defaultContact="ines-okafor" defaultMode="edit" />);
    expect(field("mobile phone")).toHaveValue("(555) 010-0142");
    await user.click(button("Remove mobile phone"));
    // The second number moves up, and the label the first had is free for the empty field.
    expect(field("work phone")).toHaveValue("(555) 010-0170");
    expect(field("mobile phone")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Remove mobile phone" })).not.toBeInTheDocument();
    await user.click(button("Done"));
    expect(screen.queryByText("(555) 010-0142")).not.toBeInTheDocument();
    expect(screen.getByText("(555) 010-0170")).toBeInTheDocument();
  });

  it("adds a contact to the group that is shown and opens it for editing", async () => {
    const user = userEvent.setup();
    render(<Contacts />);
    await user.click(group("All on My Mac"));
    await user.type(screen.getByRole("searchbox"), "vega");
    await user.click(button("New Contact"));
    // The search is cleared, the card has no name yet and its first name takes the focus.
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(names()).toHaveLength(5);
    expect(entry("No Name")).toHaveAttribute("aria-selected", "true");
    expect(field("First")).toHaveFocus();
    await user.keyboard("Lena");
    await user.type(field("Last"), "Brandt");
    await user.type(field("home email"), "lena@brandt.example");
    await user.click(button("Done"));
    expect(heading()).toHaveTextContent("Lena Brandt");
    expect(screen.getByText("lena@brandt.example")).toBeInTheDocument();
    // Sorted by the last name, in the account whose group was shown.
    expect(names()).toEqual([
      "Apple Inc.",
      "Lena Brandt",
      "Mara Delgado",
      "Island Post",
      "Robin Vega",
    ]);
    await user.click(group("All iCloud"));
    expect(names()).not.toContain("Lena Brandt");
    await user.click(group("All Contacts"));
    expect(names()).toHaveLength(9);
  });

  it("changes a field's label from the label's pop-up menu", async () => {
    const user = userEvent.setup();
    render(<Contacts defaultMode="edit" />);
    const label = () => screen.getAllByRole("combobox", { name: "email label" })[0] as HTMLElement;
    expect(label()).toHaveTextContent("work");
    await user.click(label());
    // The menu is a list box outside the window; the name list is one inside it.
    const custom = await screen.findByRole("option", { name: "Custom…" });
    const menu = custom.closest("[role='listbox']") as HTMLElement;
    expect(menu).not.toBe(list());
    expect(
      within(menu)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["home", "work", "other", "Custom…"]);
    expect(within(menu).getByRole("option", { name: "work" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(within(menu).getByRole("option", { name: "other" }));
    await waitFor(() => expect(label()).toHaveTextContent("other"));
    expect(field("other email")).toHaveValue("stephen@example.com");
    await user.click(button("Done"));
    expect(button("other")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "work" })).not.toBeInTheDocument();
  });

  it("takes a label of the user's own after Custom…", async () => {
    const user = userEvent.setup();
    render(<Contacts defaultMode="edit" />);
    const label = () => screen.getAllByRole("combobox", { name: "email label" })[0] as HTMLElement;
    await user.click(label());
    await user.click(await screen.findByRole("option", { name: "Custom…" }));
    const custom = await screen.findByRole("textbox", { name: "Custom label" });
    await waitFor(() => expect(custom).toHaveFocus());
    await user.keyboard("school{Enter}");
    expect(screen.queryByRole("textbox", { name: "Custom label" })).not.toBeInTheDocument();
    expect(label()).toHaveTextContent("school");
    expect(field("school email")).toHaveValue("stephen@example.com");
    // Escape gives the label up.
    await user.click(label());
    await user.click(await screen.findByRole("option", { name: "Custom…" }));
    await waitFor(() => expect(field("Custom label")).toHaveFocus());
    await user.keyboard("club{Escape}");
    expect(label()).toHaveTextContent("school");
  });

  it("opens a menu of commands from a field's label and reports the one chosen", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Contacts onAction={onAction} />);
    await user.click(button("work"));
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Send Email", "Send Message", "Search with Spotlight"]);
    await user.click(within(menu).getByRole("menuitem", { name: "Send Message" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith("message", {
      contact: expect.objectContaining({ id: "stephen-hackett" }),
      value: "stephen@example.com",
    });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    // From the keyboard: Return opens the menu on its first command, Return chooses it.
    button("work").focus();
    await user.keyboard("{Enter}");
    const opened = await screen.findByRole("menu");
    // The focus reaches the first command a moment after the menu appears; a Return before
    // then would go to the label button.
    await waitFor(() =>
      expect(within(opened).getByRole("menuitem", { name: "Send Email" })).toHaveFocus(),
    );
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenLastCalledWith("mail", {
      contact: expect.objectContaining({ id: "stephen-hackett" }),
      value: "stephen@example.com",
    });
  });

  it("offers the buttons under the name that the card and the Mac's services allow", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { rerender } = render(<Contacts onAction={onAction} />);
    const actions = () => within(screen.getByRole("group", { name: "Actions" }));
    // An email address, no phone number: everything but a call. A button the card cannot use is
    // dimmed and stays focusable, so the reason it gives can be reached (aria-disabled, not disabled).
    expect(actions().getByRole("button", { name: "message" })).toBeEnabled();
    expect(actions().getByRole("button", { name: "call" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(actions().getByRole("button", { name: "call" })).toHaveAttribute(
      "title",
      NO_ADDRESS.call,
    );
    expect(actions().getByRole("button", { name: "video" })).toBeEnabled();
    await user.click(actions().getByRole("button", { name: "mail" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith("mail", {
      contact: expect.objectContaining({ id: "stephen-hackett" }),
      value: "stephen@example.com",
    });
    // The badge at the end of the field's row does the same for that address.
    await user.click(button("Send Email stephen@example.com"));
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenLastCalledWith("mail", expect.anything());
    // A Mac with only Mail set up.
    rerender(<Contacts onAction={onAction} services={["mail"]} />);
    for (const name of ["message", "video"] as const) {
      expect(actions().getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
      expect(actions().getByRole("button", { name })).toHaveAttribute("title", NOT_SET_UP[name]);
    }
    expect(actions().getByRole("button", { name: "mail" })).toBeEnabled();
  });

  it("lists and titles a card by its company when Company is checked", async () => {
    const user = userEvent.setup();
    render(<Contacts defaultContact="ines-okafor" defaultMode="edit" />);
    const company = screen.getByRole("checkbox", { name: "Company" });
    expect(company).not.toBeChecked();
    await user.click(company);
    expect(company).toBeChecked();
    expect(entry("Harbor Ferry")).toHaveAttribute("aria-selected", "true");
    expect(names()).not.toContain("Ines Okafor");
    await user.click(button("Done"));
    expect(heading()).toHaveTextContent("Harbor Ferry");
  });

  it("switches a card being edited between its fields and its picture", async () => {
    const user = userEvent.setup();
    render(<Contacts defaultMode="edit" />);
    const panes = within(screen.getByRole("group", { name: "Card" }));
    expect(panes.getByRole("button", { name: "Info" })).toHaveAttribute("aria-pressed", "true");
    await user.click(panes.getByRole("button", { name: "Picture" }));
    expect(panes.getByRole("button", { name: "Picture" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("textbox", { name: "work email" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Monogram" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Silhouette" }));
    expect(screen.getByRole("radio", { name: "Silhouette" })).toBeChecked();
    await user.click(panes.getByRole("button", { name: "Info" }));
    expect(field("work email")).toBeInTheDocument();
  });

  it("shares the card through the share button's menu", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Contacts onAction={onAction} />);
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Messages" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith("share", {
      contact: expect.objectContaining({ id: "stephen-hackett" }),
      value: "Messages",
    });
  });

  it("starts from the contacts, the group, the card and the mode it is given", () => {
    render(
      <Contacts
        defaultContacts={PEOPLE}
        defaultGroup="icloud"
        defaultContact="ada"
        defaultMode="edit"
      />,
    );
    expect(group("All iCloud")).toHaveAttribute("aria-selected", "true");
    expect(names()).toEqual(["Ada Marsh"]);
    expect(field("First")).toHaveValue("Ada");
    expect(field("mobile phone")).toHaveValue("555 0101");
    expect(button("Done")).toBeInTheDocument();
  });

  it("shows the first of the list when the card it is given is not there", () => {
    render(<Contacts defaultContacts={PEOPLE} defaultContact="nobody" />);
    expect(names()).toEqual(["Ben Abbot", "Ada Marsh"]);
    expect(heading()).toHaveTextContent("Ben Abbot");
    expect(screen.getByText("Plays the cello.")).toBeInTheDocument();
  });

  it("edits the card it shows when it starts in edit mode with a card its group does not hold", async () => {
    const user = userEvent.setup();
    render(
      <Contacts
        defaultContacts={[...PEOPLE, { id: "cal", account: "mac", first: "Cal", last: "Moss" }]}
        defaultGroup="mac"
        defaultContact="ada"
        defaultMode="edit"
      />,
    );
    // Ada is in iCloud: the first card of On My Mac is shown, and is the one being edited.
    expect(names()).toEqual(["Ben Abbot", "Cal Moss"]);
    expect(entry("Ben Abbot")).toHaveAttribute("aria-selected", "true");
    expect(field("First")).toHaveValue("Ben");
    // A new last name moves the card past the other one in the list. It stays the card that
    // is edited: the editor is not handed to the card that is now the list's first.
    await user.clear(field("Last"));
    await user.type(field("Last"), "Zed");
    expect(names()).toEqual(["Cal Moss", "Ben Zed"]);
    expect(field("First")).toHaveValue("Ben");
    expect(field("Last")).toHaveValue("Zed");
    expect(entry("Ben Zed")).toHaveAttribute("aria-selected", "true");
    expect(entry("Cal Moss")).toHaveAttribute("aria-selected", "false");
    await user.click(button("Done"));
    expect(heading()).toHaveTextContent("Ben Zed");
    expect(screen.getByText("Plays the cello.")).toBeInTheDocument();
    // The other card was not touched.
    await user.click(entry("Cal Moss"));
    expect(heading()).toHaveTextContent("Cal Moss");
  });

  it("names the row of the user's own card as that", () => {
    const [ada, ben] = PEOPLE as [Contact, Contact];
    render(<Contacts defaultContacts={[{ ...ada, me: true }, ben]} defaultContact="ada" />);
    expect(entry("Ada Marsh, my card")).toHaveAttribute("aria-selected", "true");
    expect(entry("Ben Abbot")).toBeInTheDocument();
  });

  it("adds a class given for the window controls to the one that places them", () => {
    render(<Contacts controlsProps={{ className: "mine" }} />);
    const controls = button("Close").closest(".mac-contacts-controls");
    expect(controls).not.toBeNull();
    expect(controls).toHaveClass("mac-contacts-controls", "mine");
  });

  it("is a library window that takes the window's props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Contacts
        ref={ref}
        state="inactive"
        width={1000}
        height={500}
        className="mine"
        style={{ left: 40 }}
        data-testid="frame"
      />,
    );
    const root = screen.getByTestId("frame");
    expect(root).toBe(frame());
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-window", "mac-contacts", "mine");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveStyle({ width: "1000px", height: "500px", left: "40px" });
  });

  it("opens at the captured frame and is key by default", () => {
    render(<Contacts />);
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveStyle({ width: "938px", height: "438px" });
  });

  it("reports its window controls and passes their settings on", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = render(
      <Contacts onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} zoomRole="zoom" />,
    );
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onMinimize).toHaveBeenCalledOnce();
    expect(onZoom).toHaveBeenCalledOnce();
    rerender(<Contacts minimizeDisabled zoomDisabled controlsProps={{ closeLabel: "Shut" }} />);
    expect(button("Minimize")).toBeDisabled();
    expect(screen.getByRole("button", { name: /full screen/i })).toBeDisabled();
    expect(button("Shut")).toBeEnabled();
  });

  it("reports presses and double clicks on its drag regions, not on the controls in them", () => {
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Contacts
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const regions = frame().querySelectorAll("[data-window-drag-region]");
    expect(regions).toHaveLength(2);
    for (const region of regions) {
      fireEvent.pointerDown(region, { button: 0 });
      fireEvent.doubleClick(region);
    }
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(2);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(2);
    // Another button, and a press on a control, do not move the window.
    fireEvent.pointerDown(regions[0] as Element, { button: 2 });
    for (const control of [screen.getByRole("searchbox"), button("Close")]) {
      fireEvent.pointerDown(control, { button: 0 });
      fireEvent.doubleClick(control);
    }
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(2);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(2);
  });
});

describe("Contacts at the edges of what it can be given", () => {
  it("shows no card for an empty list, and adds the first one", async () => {
    const user = userEvent.setup();
    render(<Contacts defaultContacts={[]} defaultMode="edit" />);
    expect(within(frame()).queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("No Cards")).toBeInTheDocument();
    // Nothing was searched for, so nothing is announced.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("No Card Selected")).toBeInTheDocument();
    // There is no card to edit, whatever the mode asked for.
    expect(button("Edit")).toBeDisabled();
    expect(button("Share")).toBeDisabled();
    await user.click(button("New Contact"));
    expect(names()).toEqual(["No Name"]);
    expect(field("First")).toHaveFocus();
    await user.keyboard("Ada");
    await user.click(button("Done"));
    expect(names()).toEqual(["Ada"]);
    expect(heading()).toHaveTextContent("Ada");
  });

  it("shows a card that holds nothing as a card without a name", async () => {
    const user = userEvent.setup();
    render(
      <Contacts defaultContacts={[{ id: "blank", account: "icloud", first: " ", last: "" }]} />,
    );
    expect(names()).toEqual(["No Name"]);
    expect(entry("No Name")).toHaveAttribute("aria-selected", "true");
    expect(heading()).toHaveTextContent("No Name");
    const actions = within(screen.getByRole("group", { name: "Actions" }));
    for (const name of ["message", "call", "video", "mail"] as const) {
      expect(actions.getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
      expect(actions.getByRole("button", { name })).toHaveAttribute("title", NO_ADDRESS[name]);
    }
    // No field, so no group of fields and no label that opens a menu.
    for (const name of ["phone", "email", "URL", "user name"])
      expect(screen.queryByRole("group", { name })).not.toBeInTheDocument();
    // Editing it offers an empty field of every kind.
    await user.click(button("Edit"));
    expect(field("mobile phone")).toHaveValue("");
    expect(field("home email")).toHaveValue("");
    await user.click(button("Done"));
    expect(heading()).toHaveTextContent("No Name");
  });

  it("shows a group without cards as empty, and adds a card to it", async () => {
    const user = userEvent.setup();
    render(<Contacts defaultContacts={PEOPLE.slice(0, 1)} defaultContact="ada" />);
    await user.click(group("All on My Mac"));
    expect(within(frame()).queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("No Cards")).toBeInTheDocument();
    expect(screen.getByText("No Card Selected")).toBeInTheDocument();
    expect(button("Edit")).toBeDisabled();
    await user.click(button("New Contact"));
    await user.keyboard("Cy");
    await user.click(button("Done"));
    expect(names()).toEqual(["Cy"]);
    // The card is the Mac's: the other account does not list it.
    await user.click(group("All iCloud"));
    expect(names()).toEqual(["Ada Marsh"]);
    expect(heading()).toHaveTextContent("Ada Marsh");
  });

  it("keeps the card chosen in a searched list when the search is cleared", async () => {
    const user = userEvent.setup();
    const onContactChange = vi.fn();
    render(<Contacts onContactChange={onContactChange} />);
    const search = screen.getByRole("searchbox");
    await user.type(search, "ferry");
    // The list's first card is shown, which nobody chose.
    expect(heading()).toHaveTextContent("Ines Okafor");
    expect(onContactChange).not.toHaveBeenCalled();
    await user.click(entry("Ines Okafor"));
    expect(onContactChange).toHaveBeenCalledExactlyOnceWith("ines-okafor");
    await user.clear(search);
    expect(names()).toHaveLength(8);
    expect(entry("Ines Okafor")).toHaveAttribute("aria-selected", "true");
    expect(heading()).toHaveTextContent("Ines Okafor");
  });

  it("takes the searched text as it is typed, pattern characters included", () => {
    render(<Contacts />);
    const search = screen.getByRole("searchbox");
    const type = (value: string) => fireEvent.change(search, { target: { value } });
    type("(555) 010-01");
    expect(names()).toEqual([
      "Mara Delgado",
      "Island Post",
      "Tomas Lindqvist",
      "Ines Okafor",
      "Robin Vega",
    ]);
    // None of these is a pattern: each is text that no card holds.
    for (const text of [".*", "[", "\\", "island+", "^apple", "vega$", "(555)?"]) {
      type(text);
      expect(screen.getByRole("status")).toHaveTextContent("No Results");
    }
    type("http://www.apple.com");
    expect(names()).toEqual(["Apple Inc."]);
  });

  it("keeps the card being edited listed while what the search found is changed", async () => {
    const user = userEvent.setup();
    render(<Contacts />);
    const search = screen.getByRole("searchbox");
    // Only the company holds this text: the address is "harborferry" in one word.
    await user.type(search, "harbor f");
    expect(names()).toEqual(["Ines Okafor"]);
    await user.click(button("Edit"));
    await user.clear(field("Company name"));
    // The card no longer holds the text, and is still the one listed and edited.
    expect(names()).toEqual(["Ines Okafor"]);
    expect(field("First")).toHaveValue("Ines");
    expect(field("mobile phone")).toHaveValue("(555) 010-0142");
    // Done clears the search that no longer finds the card, so the card stays shown.
    await user.click(button("Done"));
    expect(search).toHaveValue("");
    expect(names()).toHaveLength(8);
    expect(entry("Ines Okafor")).toHaveAttribute("aria-selected", "true");
    expect(heading()).toHaveTextContent("Ines Okafor");
    expect(screen.queryByText("Harbor Ferry")).not.toBeInTheDocument();
  });

  it("keeps a search that still finds the card when the card is done", async () => {
    const user = userEvent.setup();
    render(<Contacts />);
    const search = screen.getByRole("searchbox");
    await user.type(search, "ferry");
    await user.click(button("Edit"));
    await user.type(field("birthday"), "!");
    await user.click(button("Done"));
    expect(search).toHaveValue("ferry");
    expect(names()).toEqual(["Ines Okafor"]);
    expect(screen.getByText("March 14!")).toBeInTheDocument();
  });

  it("shows a field without a label as other, and a choice its menu does not list", async () => {
    const user = userEvent.setup();
    const odd: Contact = {
      id: "odd",
      account: "mac",
      first: "Odd",
      last: "",
      phones: [{ label: " ", value: "555 0100" }],
      ringtone: "Marimba",
    };
    render(<Contacts defaultContacts={[odd]} />);
    // The label is a button that needs a name to be found and pressed.
    expect(button("other")).toBeInTheDocument();
    await user.click(button("Edit"));
    expect(field("other phone")).toHaveValue("555 0100");
    expect(screen.getAllByRole("combobox", { name: "phone label" })[0]).toHaveTextContent("other");
    const ringtone = screen.getByRole("combobox", { name: "ringtone" });
    expect(ringtone).toHaveTextContent("Marimba");
    await user.click(ringtone);
    expect(await screen.findByRole("option", { name: "Marimba" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("titles a company's card by the company and names the person under it", () => {
    const card: Contact = {
      id: "c",
      account: "mac",
      first: "Mara",
      last: "Delgado",
      company: "Tide Tables",
      isCompany: true,
    };
    render(<Contacts defaultContacts={[card]} />);
    expect(names()).toEqual(["Tide Tables"]);
    expect(heading()).toHaveTextContent("Tide Tables");
    expect(screen.getByText("Mara Delgado")).toBeInTheDocument();
  });
});

describe("the contacts' rules", () => {
  const person: Contact = { id: "p", account: "icloud", first: "Ada", last: "Marsh" };
  const company: Contact = { ...person, id: "c", company: "Marsh & Co.", isCompany: true };

  it("names and sorts a person by the last name and a company by its own", () => {
    expect(displayName(person)).toBe("Ada Marsh");
    expect(initialsOf(person)).toBe("AM");
    expect(displayName(company)).toBe("Marsh & Co.");
    expect(initialsOf(company)).toBe("");
    expect(displayName({ ...person, first: "", last: "" })).toBe("No Name");
    // A card with a company and no names is the company's, checked or not.
    expect(displayName({ ...person, first: "", last: "", company: "Tide Tables" })).toBe(
      "Tide Tables",
    );
    const zed: Contact = { ...person, id: "z", first: "Zed", last: "Abbot" };
    expect(sortContacts([person, company, zed]).map((contact) => contact.id)).toEqual([
      "z",
      "p",
      "c",
    ]);
  });

  it("matches names, the company, the note and the fields' values, whatever the case", () => {
    const card: Contact = {
      ...person,
      company: "Harbor Ferry",
      note: "Saturday crossings",
      phones: [{ label: "mobile", value: "555 0101" }],
    };
    expect(matches(card, " ADA m")).toBe(true);
    expect(matches(card, "ferry")).toBe(true);
    expect(matches(card, "crossing")).toBe(true);
    expect(matches(card, "0101")).toBe(true);
    expect(matches(card, "mobile")).toBe(false);
    expect(matches(card, "")).toBe(true);
  });

  it("matches letters whatever their case and accents, also where folding changes the length", () => {
    // The lower case of U+0130 is two characters, and the upper case of U+00DF is two letters.
    const card: Contact = {
      ...person,
      first: "\u0130nci",
      last: "\u00c7elik",
      company: "Stra\u00dfe & S\u00f8n",
      note: "\u0130STANBUL, caf\u00e9",
    };
    expect("\u0130".toLowerCase()).toHaveLength(2);
    for (const text of [
      "inci",
      "\u0130NC\u0130",
      "i\u0307nci",
      "inci celik",
      "\u00e7elik",
      "istanbul",
      "CAFE",
      "cafe\u0301",
      "stra\u00dfe",
    ])
      expect([text, matches(card, text)]).toEqual([text, true]);
    for (const text of ["ince", "strasse", "son", "istanbulu"])
      expect([text, matches(card, text)]).toEqual([text, false]);
    // The card's own texts are shown as they are: nothing is cut out of them.
    expect(displayName(card)).toBe("\u0130nci \u00c7elik");
    expect(initialsOf(card)).toBe("\u0130\u00c7");
    expect(fold("\u0130stanbul")).toBe("istanbul");
  });

  it("takes pattern characters in the searched text as the characters they are", () => {
    const card: Contact = { ...person, note: "a.b* [c] \\d+ (e)? ^f$ g|h" };
    for (const text of ["a.b*", "[c]", "\\d+", "(e)?", "^f$", "g|h"])
      expect([text, matches(card, text)]).toEqual([text, true]);
    for (const text of ["a-b", ".*", "\\w", "c|d", "e?"])
      expect([text, matches(card, text)]).toEqual([text, false]);
  });

  it("treats names of spaces as none, a missing label as other and a letter as one code point", () => {
    expect(displayName({ ...person, first: "  ", last: " " })).toBe("No Name");
    expect(displayName({ ...person, first: " Ada ", last: " " })).toBe("Ada");
    expect(displayName({ ...person, first: " ", last: "", company: " Tide Tables " })).toBe(
      "Tide Tables",
    );
    // Under the name: a person's company, or the person a company's card names.
    expect(secondaryName({ ...person, company: "Tide Tables" })).toBe("Tide Tables");
    expect(secondaryName(company)).toBe("Ada Marsh");
    expect(secondaryName({ ...company, first: "", last: "" })).toBe("");
    expect(secondaryName(person)).toBe("");
    expect(labelOf({ label: "  ", value: "1" })).toBe("other");
    expect(labelOf({ label: " school ", value: "1" })).toBe("school");
    // A letter outside the basic plane is two UTF-16 units: the initial is the whole letter.
    expect(initialsOf({ ...person, first: "\u{1d49c}da", last: "" })).toBe("\u{1d49c}");
    expect(initialsOf({ ...person, first: "", last: "" })).toBe("");
  });

  it("gives a new field the first label of its kind that is free", () => {
    expect(nextLabel("phone", [])).toBe("mobile");
    expect(nextLabel("phone", [{ label: "mobile", value: "1" }])).toBe("iPhone");
    expect(nextLabel("email", [{ label: "home", value: "a@b.example" }])).toBe("work");
  });

  it("drops the fields left empty when a card is done", () => {
    const done = tidy({
      ...person,
      first: " Ada ",
      company: "  ",
      phones: [
        { label: "mobile", value: "  " },
        { label: "home", value: " 555 0101 " },
      ],
      emails: [{ label: "work", value: "" }],
      urls: [{ label: "", value: "example.org" }],
    });
    expect(done.first).toBe("Ada");
    expect(done.company).toBeUndefined();
    expect(done.phones).toEqual([{ label: "home", value: "555 0101" }]);
    expect(done.emails).toBeUndefined();
    expect(done.urls).toEqual([{ label: "other", value: "example.org" }]);
  });

  it("finds what a card can be reached at for each service", () => {
    const card: Contact = {
      ...person,
      emails: [{ label: "work", value: "ada@marsh.example" }],
    };
    expect(addressFor(card, "call")).toBeUndefined();
    expect(addressFor(card, "mail")).toBe("ada@marsh.example");
    expect(addressFor(card, "message")).toBe("ada@marsh.example");
    const phone = { ...card, phones: [{ label: "mobile", value: "555 0101" }] };
    expect(addressFor(phone, "call")).toBe("555 0101");
    expect(addressFor(phone, "video")).toBe("555 0101");
    expect(addressFor(person, "mail")).toBeUndefined();
  });
});

describe("the app descriptor", () => {
  it("names the app, its window, its size and its menus", () => {
    expect(app).toBe(contactsApp);
    expect(app.id).toBe("contacts");
    expect(app.name).toBe("Contacts");
    expect(app.defaultSize).toEqual({ width: 938, height: 438 });
    expect(app.menus[0]).toBe("Contacts");
    expect(app.menus).toContain("Card");
  });

  it("renders its component as a window that a host places and sizes", () => {
    const App = app.component;
    render(<App {...app.defaultSize} state="main" style={{ position: "absolute", top: 30 }} />);
    expect(frame()).toHaveAttribute("data-window-state", "main");
    expect(frame()).toHaveStyle({ position: "absolute", top: "30px", width: "938px" });
  });
});
