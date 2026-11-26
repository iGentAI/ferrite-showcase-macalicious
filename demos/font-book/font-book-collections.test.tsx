import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FontBook } from "./font-book";

const collection = (name: string) => screen.getByRole("treeitem", { name });
const fonts = () => screen.getByRole("treegrid", { name: "Fonts" });
const fontRow = (name: string | RegExp) => within(fonts()).getByRole("row", { name });
const rows = () =>
  within(fonts())
    .queryAllByRole("row")
    .map((row) => row.textContent);
const nameField = () => screen.findByRole("textbox", { name: "Collection name" });
const user = () => userEvent.setup({ pointerEventsCheck: 0 });
/** A menu makes the rest of the page inert until it has gone. */
const menuGone = () => waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

/** A new collection named by typing, as the plus and Return make it. */
async function makeCollection(person: ReturnType<typeof user>, name: string) {
  await person.click(screen.getByRole("button", { name: "Add Collection" }));
  const field = await nameField();
  await person.clear(field);
  await person.type(field, `${name}{Enter}`);
}
/** Pick rows as a press does, without moving the pointer. */
function press(row: HTMLElement, modifiers: { ctrlKey?: boolean; shiftKey?: boolean } = {}) {
  fireEvent.pointerDown(row, modifiers);
  fireEvent.mouseDown(row, modifiers);
  fireEvent.pointerUp(window);
  fireEvent.mouseUp(row, modifiers);
}
const selectedNames = () =>
  within(screen.getByRole("treegrid", { name: "Fonts", hidden: true }))
    .getAllByRole("row", { hidden: true })
    .filter((row) => row.getAttribute("aria-selected") === "true")
    .map((row) => row.textContent);

afterEach(() => {
  Reflect.deleteProperty(document, "elementFromPoint");
});

describe("Font Book's collections", () => {
  it("names a new collection in place, and Escape keeps its first name", async () => {
    const person = user();
    render(<FontBook />);
    await makeCollection(person, "Mine");
    expect(collection("Mine")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region")).toHaveAccessibleName("Mine (0 Fonts)");

    await person.click(screen.getByRole("button", { name: "Add Collection" }));
    await nameField();
    await person.keyboard("Gone{Escape}");
    expect(collection("New Collection")).toBeInTheDocument();
  });

  it("renames from a double click and from the context menu, and never to nothing", async () => {
    const person = user();
    render(<FontBook />);
    await makeCollection(person, "Mine");

    await person.dblClick(collection("Mine"));
    let field = await nameField();
    await person.clear(field);
    await person.type(field, "Ours{Enter}");
    expect(collection("Ours")).toBeInTheDocument();

    fireEvent.contextMenu(collection("Ours"));
    await person.click(await screen.findByRole("menuitem", { name: "Rename Collection" }));
    field = await nameField();
    await person.clear(field);
    await person.keyboard("{Enter}");
    expect(collection("Ours")).toBeInTheDocument();
  });

  it("will not rename or delete a collection it did not make", async () => {
    const person = user();
    render(<FontBook />);
    await person.dblClick(collection("Fun"));
    expect(screen.queryByRole("textbox", { name: "Collection name" })).not.toBeInTheDocument();
    fireEvent.contextMenu(collection("Fun"));
    expect(await screen.findByRole("menuitem", { name: "Rename Collection" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Delete Collection" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("asks before deleting, leaves it on Cancel, and goes to All Fonts after", async () => {
    const person = user();
    render(<FontBook />);
    await makeCollection(person, "Mine");
    fireEvent.contextMenu(collection("Mine"));
    await person.click(await screen.findByRole("menuitem", { name: "Delete Collection" }));
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("Are you sure you want to delete the collection “Mine”?");
    await person.click(within(alert).getByRole("button", { name: "Cancel" }));
    expect(collection("Mine")).toBeInTheDocument();

    fireEvent.contextMenu(collection("Mine"));
    await person.click(await screen.findByRole("menuitem", { name: "Delete Collection" }));
    await person.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("treeitem", { name: "Mine" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("region")).toHaveAccessibleName("All Fonts (281 Fonts)");
  });

  it("selects a range with Shift and adds to it with Command, and shows each in Sample", async () => {
    const person = user();
    render(<FontBook />);
    await person.click(collection("Fixed Width"));
    press(fontRow("Courier"));
    press(fontRow("Menlo"), { shiftKey: true });
    expect(selectedNames()).toEqual(["Courier", "Courier New", "Menlo"]);
    press(fontRow("PT Mono"), { ctrlKey: true });
    expect(selectedNames()).toEqual(["Courier", "Courier New", "Menlo", "PT Mono"]);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("4 Fonts");
    expect(screen.getAllByRole("heading", { level: 3 }).map((one) => one.textContent)).toEqual([
      "Courier Regular",
      "Courier New Regular",
      "Menlo Regular",
      "PT Mono Regular",
    ]);

    // A press on one of them keeps all four for a drag; let go, it is selected alone.
    fireEvent.pointerDown(fontRow("Menlo"));
    fireEvent.mouseDown(fontRow("Menlo"));
    expect(selectedNames()).toHaveLength(4);
    fireEvent.pointerUp(window);
    expect(selectedNames()).toEqual(["Menlo"]);
  });

  it("turns every selected family off together, leaving one the system needs", async () => {
    const person = user();
    render(<FontBook />);
    await person.click(collection("Fixed Width"));
    press(fontRow("Andale Mono"));
    press(fontRow("Courier"), { ctrlKey: true });
    press(fontRow("Courier New"), { ctrlKey: true });
    await person.click(screen.getByRole("button", { name: "Disable 3 Families" }));
    expect(fontRow(/Andale Mono/)).toHaveTextContent("Off");
    expect(fontRow(/Courier New/)).toHaveTextContent("Off");
    expect(fontRow("Courier")).not.toHaveTextContent("Off");
    await person.click(screen.getByRole("button", { name: "Enable 3 Families" }));
    expect(fontRow("Andale Mono")).not.toHaveTextContent("Off");
  });

  it("adds the selected fonts from the context menu, and Delete takes one back out", async () => {
    const person = user();
    render(<FontBook />);
    await makeCollection(person, "Mine");
    await person.click(collection("Fixed Width"));
    press(fontRow("Courier"));
    press(fontRow("Menlo"), { ctrlKey: true });

    fireEvent.contextMenu(fontRow("Menlo"));
    await person.hover(await screen.findByRole("menuitem", { name: "Add to Collection" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Mine" }));
    await menuGone();
    await person.click(collection("Mine"));
    expect(rows()).toEqual(["Courier", "Menlo"]);

    press(fontRow("Courier"));
    fireEvent.keyDown(fonts(), { key: "Backspace" });
    expect(rows()).toEqual(["Menlo"]);
  });

  it("selects the row under a secondary click, and makes a collection of the selection", async () => {
    const person = user();
    render(<FontBook />);
    await person.click(collection("Fixed Width"));
    fireEvent.contextMenu(fontRow("Monaco"));
    expect(selectedNames()).toEqual(["Monaco"]);
    await person.click(
      await screen.findByRole("menuitem", { name: "New Collection from Selection" }),
    );
    await nameField();
    await menuGone();
    await person.keyboard("{Enter}");
    expect(screen.getByRole("region")).toHaveAccessibleName("New Collection (1 Font)");
    expect(rows()).toEqual(["Monaco"]);
  });

  it("drags fonts to a collection of the person's, and not to a fixed one", async () => {
    const person = user();
    render(<FontBook />);
    await makeCollection(person, "Mine");
    await person.click(collection("Fixed Width"));
    press(fontRow("Courier"));
    press(fontRow("Menlo"), { ctrlKey: true });

    const dragOnto = (name: string) => {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: () => collection(name),
      });
      fireEvent.pointerDown(fontRow("Menlo"));
      fireEvent.mouseDown(fontRow("Menlo"));
      fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
      fireEvent.pointerUp(window);
    };
    dragOnto("Fun");
    expect(selectedNames()).toEqual(["Courier", "Menlo"]);
    await person.click(collection("Fun"));
    expect(rows()).not.toContain("Menlo");

    await person.click(collection("Fixed Width"));
    press(fontRow("Courier"));
    press(fontRow("Menlo"), { ctrlKey: true });
    dragOnto("Mine");
    await person.click(collection("Mine"));
    expect(rows()).toEqual(["Courier", "Menlo"]);
  });

  it("lets Escape take a drag back", async () => {
    const person = user();
    render(<FontBook />);
    await makeCollection(person, "Mine");
    await person.click(collection("Fixed Width"));
    press(fontRow("Courier"));
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => collection("Mine"),
    });
    fireEvent.pointerDown(fontRow("Courier"));
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(window);
    await person.click(collection("Mine"));
    expect(rows()).toEqual([]);
  });
});
