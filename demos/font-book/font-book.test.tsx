import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { changeDesktopValue } from "../desktop/desktop-personal";
import { app, fontBookApp } from "./app";
import { FontBook } from "./font-book";
import { FONT_BOOK_VALIDATE } from "./font-book-preferences";

const frame = () => screen.getByRole("region");
const button = (name: string) => screen.getByRole("button", { name });
const collection = (name: string) => screen.getByRole("treeitem", { name });
const fonts = () => screen.getByRole("treegrid", { name: "Fonts" });
/** The names in the font list, in order: families and the styles of the expanded ones. */
const rows = () =>
  within(fonts())
    .getAllByRole("row")
    .map((row) => row.textContent);
const fontRow = (name: string) =>
  within(fonts())
    .getAllByRole("row")
    .find((row) => row.textContent === name) as HTMLElement;
/** The name of the font above the preview. */
const previewed = () => screen.getByRole("heading", { level: 2 }).textContent;
const sizeField = () => screen.getByRole("combobox", { name: "Size:" });
const sizeSlider = () => screen.getByRole("slider", { name: "Size:" });
const sample = () => screen.getByRole("textbox", { name: "Sample" });
const search = () => screen.getByRole("searchbox", { name: "Search" });
/** The title bar with its toolbar: the window's drag region. */
const bar = () => frame().querySelector("[data-window-drag-region]") as HTMLElement;

/**
 * The list renders the rows in view only, and the test environment lays nothing out: give the
 * view the height it has in the captured window and tell it that it was scrolled.
 */
function renderAtCapturedHeight() {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(548);
  const result = render(<FontBook />);
  fireEvent.scroll(within(fonts()).getByRole("rowgroup"));
  return result;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FontBook", () => {
  it("opens as the reference capture: all fonts, the list at its end, Zapf Dingbats at 42 pt", () => {
    renderAtCapturedHeight();
    expect(frame()).toHaveAccessibleName("All Fonts (281 Fonts)");
    expect(frame()).toHaveClass("mac-window", "mac-font-book");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveStyle({ width: "1017px", height: "603px" });

    const views = within(screen.getByRole("group", { name: "Preview" })).getAllByRole("button");
    expect(views.map((view) => [view.getAttribute("aria-label"), view.ariaPressed])).toEqual([
      ["Sample", "true"],
      ["Repertoire", "false"],
      ["Custom", "false"],
      ["Info", "false"],
    ]);

    const sidebar = within(screen.getByRole("tree", { name: "Collections" }));
    expect(sidebar.getAllByRole("treeitem").map((item) => item.textContent)).toEqual([
      "All Fonts",
      "English",
      "Fixed Width",
      "Fun",
      "Modern",
      "PDF",
      "Traditional",
      "Web",
    ]);
    expect(collection("All Fonts")).toHaveAttribute("aria-selected", "true");
    expect(sidebar.getByRole("group", { name: "Smart Collection" })).toBeInTheDocument();
    expect(sidebar.getByRole("group", { name: "Collection" })).toBeInTheDocument();

    // The end of the list, as the capture has it: the 94 rows of 18 pt less the view's height.
    expect(within(fonts()).getByRole("rowgroup").scrollTop).toBe(94 * 18 - 548);
    expect(rows().slice(-5)).toEqual([
      "Yuppy SC",
      "Yuppy TC",
      "Zapf Dingbats",
      "Regular",
      "Zapfino",
    ]);
    expect(fontRow("Zapf Dingbats")).toHaveAttribute("aria-expanded", "true");
    expect(fontRow("Regular")).toHaveAttribute("aria-selected", "true");
    // A font that is not downloaded is listed in grey; an installed one is not.
    expect(fontRow("Yuppy SC")).toHaveClass("mac-outline-view-row-dimmed");
    expect(fontRow("Zapfino")).not.toHaveClass("mac-outline-view-row-dimmed");

    expect(previewed()).toBe("Zapf Dingbats Regular");
    expect(sample().textContent?.split("\n")).toHaveLength(6);
    expect(sample()).toHaveAttribute("aria-readonly", "true");
    expect(sample()).toHaveStyle({ fontSize: "42px" });
    expect(sizeField()).toHaveValue("42");
    expect(sizeSlider()).toHaveValue("42");
    // The system needs this font: it cannot be disabled. A toolbar keeps a disabled button
    // reachable, so it says so with aria-disabled.
    expect(button("Disable “Zapf Dingbats”")).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the fonts of the chosen collection, counts them in the title and previews one", async () => {
    const user = userEvent.setup();
    render(<FontBook />);

    await user.click(collection("Fixed Width"));
    expect(collection("Fixed Width")).toHaveAttribute("aria-selected", "true");
    expect(frame()).toHaveAccessibleName("Fixed Width (16 Fonts)");
    expect(rows()).toEqual(["Andale Mono", "Courier", "Courier New", "Menlo", "Monaco", "PT Mono"]);
    // The font that was selected is not in this collection: its first family is shown.
    expect(fontRow("Andale Mono")).toHaveAttribute("aria-selected", "true");
    expect(previewed()).toBe("Andale Mono Regular");
    expect(sample()).toHaveTextContent("ABCDEFGHIJKLM");
    expect(sample().style.fontFamily).toMatch(/^"Andale Mono", .*monospace$/);

    await user.click(collection("PDF"));
    expect(frame()).toHaveAccessibleName("PDF (16 Fonts)");
    expect(rows()).toEqual(["Courier", "Helvetica", "Symbol", "Times", "Zapf Dingbats", "Regular"]);
    // The selection survives a collection that holds it.
    expect(previewed()).toBe("Zapf Dingbats Regular");

    await user.click(collection("All Fonts"));
    expect(frame()).toHaveAccessibleName("All Fonts (281 Fonts)");
  });

  it("expands a family to its styles and previews the family or the style that is selected", async () => {
    const user = userEvent.setup();
    render(<FontBook />);
    await user.click(collection("Fixed Width"));

    // A family stands for its first style.
    await user.click(fontRow("Courier"));
    expect(previewed()).toBe("Courier Regular");
    expect(sample()).toHaveStyle({ fontWeight: "400", fontStyle: "normal" });
    expect(fontRow("Courier")).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{ArrowRight}");
    expect(fontRow("Courier")).toHaveAttribute("aria-expanded", "true");
    expect(rows().slice(1, 6)).toEqual(["Courier", "Regular", "Oblique", "Bold", "Bold Oblique"]);

    await user.click(fontRow("Bold Oblique"));
    expect(previewed()).toBe("Courier Bold Oblique");
    expect(sample()).toHaveStyle({ fontWeight: "700", fontStyle: "italic" });
    expect(sample().style.fontFamily).toMatch(/^Courier, /);

    // The keyboard moves the selection, and the preview with it.
    await user.keyboard("{ArrowUp}");
    expect(previewed()).toBe("Courier Bold");
    expect(sample()).toHaveStyle({ fontWeight: "700", fontStyle: "normal" });

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(fontRow("Courier")).toHaveAttribute("aria-expanded", "false");
    expect(previewed()).toBe("Courier Regular");
  });

  it("keeps one size in the combo box, the slider and the sample", async () => {
    const user = userEvent.setup();
    render(<FontBook />);

    await user.clear(sizeField());
    await user.type(sizeField(), "72");
    // Typed text is entered with Return, as in a combo box of AppKit.
    expect(sample()).toHaveStyle({ fontSize: "42px" });
    await user.keyboard("{Enter}");
    expect(sizeField()).toHaveValue("72");
    expect(sizeSlider()).toHaveValue("72");
    expect(sample()).toHaveStyle({ fontSize: "72px" });

    fireEvent.change(sizeSlider(), { target: { value: "120" } });
    expect(sizeField()).toHaveValue("120");
    expect(sample()).toHaveStyle({ fontSize: "120px" });

    // A size from the list.
    await user.click(button("Show choices"));
    await user.click(await screen.findByRole("option", { name: "24" }));
    expect(sizeField()).toHaveValue("24");
    expect(sizeSlider()).toHaveValue("24");
    expect(sample()).toHaveStyle({ fontSize: "24px" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    // Leaving the field enters it too, and brings a size outside the slider's range into it.
    await user.clear(sizeField());
    await user.type(sizeField(), "500");
    await user.tab();
    expect(sizeField()).toHaveValue("288");
    expect(sizeSlider()).toHaveValue("288");
    expect(sample()).toHaveStyle({ fontSize: "288px" });

    // Text that is no number is dropped.
    await user.clear(sizeField());
    await user.type(sizeField(), "big{Enter}");
    expect(sizeField()).toHaveValue("288");
  });

  it("switches the preview between the four views", async () => {
    const user = userEvent.setup();
    render(<FontBook />);
    await user.click(collection("Fixed Width"));
    await user.click(fontRow("Menlo"));

    await user.click(button("Repertoire"));
    expect(button("Repertoire")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("textbox", { name: "Sample" })).toBeNull();
    const repertoire = screen.getByRole("group", { name: "Repertoire" });
    expect(repertoire).toHaveTextContent(/^!"#\$%&'\(\)\*\+,-\.\/0123456789/);
    expect(repertoire).toHaveStyle({ fontSize: "42px" });
    expect(repertoire.style.fontFamily).toMatch(/^Menlo, /);

    await user.click(button("Custom"));
    const text = screen.getByRole("textbox", { name: "Custom text" });
    expect(text).toHaveValue("The quick brown fox jumps over the lazy dog.");
    await user.clear(text);
    await user.type(text, "Hamburgefonstiv");
    // What was typed is set in whichever font is chosen next.
    await user.click(fontRow("Monaco"));
    const kept = screen.getByRole("textbox", { name: "Custom text" });
    expect(kept).toHaveValue("Hamburgefonstiv");
    expect(kept.style.fontFamily).toMatch(/^Monaco, /);
    expect(previewed()).toBe("Monaco Regular");

    await user.click(button("Info"));
    const facts = screen
      .getAllByRole("term")
      .map((term, at) => [term.textContent, screen.getAllByRole("definition")[at]?.textContent]);
    expect(facts).toEqual([
      ["PostScript name", "Monaco"],
      ["Full name", "Monaco Regular"],
      ["Family", "Monaco"],
      ["Style", "Regular"],
      ["Language", "Latin"],
      ["Fixed width", "Yes"],
      ["Enabled", "Yes"],
      ["Collections", "English, Fixed Width"],
      ["Version", "Not known: this desktop has no file for this font"],
      ["Designer", "Not known: this desktop has no file for this font"],
      ["Copyright", "Not known: this desktop has no file for this font"],
      ["Location", "None: this desktop only names this font"],
      ["Drawn with", 'Monaco, "Courier New", Courier, monospace'],
    ]);

    await user.click(button("Sample"));
    expect(sample()).toHaveTextContent("ABCDEFGHIJKLM");
  });

  it("searches the list by name", async () => {
    const user = userEvent.setup();
    render(<FontBook />);

    await user.type(search(), "gothic");
    expect(rows()).toEqual([
      "Toppan Bunkyu Midashi Gothic",
      "Tsukushi A Round Gothic",
      "Tsukushi B Round Gothic",
      "YuGothic",
    ]);
    expect(previewed()).toBe("Toppan Bunkyu Midashi Gothic Extrabold");
    // The title counts the collection, not the matches.
    expect(frame()).toHaveAccessibleName("All Fonts (281 Fonts)");

    // A style's name finds its family, within the chosen collection.
    await user.clear(search());
    await user.click(collection("Modern"));
    await user.type(search(), "condensed bold");
    expect(rows()).toEqual(["Helvetica Neue"]);

    await user.clear(search());
    await user.type(search(), "no such font");
    expect(within(fonts()).queryAllByRole("row")).toHaveLength(0);
    expect(screen.getByText("No Fonts")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();

    await user.keyboard("{Escape}");
    expect(search()).toHaveValue("");
    expect(rows()[0]).toBe("Avenir");
  });

  it("searches in what the menu of the field's magnifier names", async () => {
    const user = userEvent.setup();
    render(<FontBook />);
    const searchIn = async (name: string) => {
      await user.click(button("Search in"));
      await user.click(await screen.findByRole("menuitemradio", { name }));
    };

    // Everywhere, a style's name finds its family.
    await user.type(search(), "extrabold");
    expect(rows()).toContain("Toppan Bunkyu Midashi Gothic");

    // In family names only it does not; the field says what it searches while it is empty.
    await searchIn("Family");
    expect(within(fonts()).queryAllByRole("row")).toHaveLength(0);
    await user.clear(search());
    expect(search()).toHaveAttribute("placeholder", "Family");
    await user.type(search(), "gothic");
    expect(rows()).toEqual([
      "Toppan Bunkyu Midashi Gothic",
      "Tsukushi A Round Gothic",
      "Tsukushi B Round Gothic",
      "YuGothic",
    ]);

    await searchIn("Style");
    await user.clear(search());
    await user.type(search(), "extrabold");
    expect(rows()).toContain("Toppan Bunkyu Midashi Gothic");
    expect(rows()).not.toContain("YuGothic");

    // A PostScript name has no spaces, so no family or font name contains it: its own scope
    // finds it, and so does Everything, which leaves out nothing that one scope finds.
    await searchIn("PostScript Name");
    await user.clear(search());
    await user.click(search());
    await user.paste("ToppanBunkyuMidashiGothic-Extrabold");
    expect(rows()).toEqual(["Toppan Bunkyu Midashi Gothic"]);
    await searchIn("Family");
    expect(within(fonts()).queryAllByRole("row")).toHaveLength(0);
    await searchIn("Everything");
    expect(search()).toHaveValue("ToppanBunkyuMidashiGothic-Extrabold");
    expect(rows()).toEqual(["Toppan Bunkyu Midashi Gothic"]);
    // Everything is the field as captured: it says "Search".
    await user.clear(search());
    expect(search()).toHaveAttribute("placeholder", "Search");
    // Five menus and four queries: longer than the default on a busy machine.
  }, 20_000);

  it("disables and enables a font the system does not need", async () => {
    const user = userEvent.setup();
    render(<FontBook />);
    await user.click(collection("Web"));

    await user.click(fontRow("Verdana"));
    await user.click(button("Disable “Verdana”"));
    const row = within(fonts())
      .getAllByRole("row")
      .find((candidate) => candidate.textContent?.includes("Verdana"));
    expect(row).toHaveTextContent("Off");
    expect(row).toHaveClass("mac-outline-view-row-dimmed");
    expect(row).toHaveAttribute("aria-selected", "true");
    await user.click(button("Info"));
    expect(screen.getByText("Enabled").closest("dt")?.nextElementSibling).toHaveTextContent(/^No$/);

    await user.click(button("Enable “Verdana”"));
    expect(fontRow("Verdana")).not.toHaveClass("mac-outline-view-row-dimmed");
    expect(button("Disable “Verdana”")).toHaveAttribute("aria-disabled", "false");

    // A font that is not downloaded cannot be enabled here.
    await user.click(collection("All Fonts"));
    await user.type(search(), "Yuppy");
    expect(button("Disable “Yuppy SC”")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Enabled").closest("dt")?.nextElementSibling).toHaveTextContent(
      "No, not downloaded",
    );
  });

  it("adds an empty collection with the plus under the sidebar", async () => {
    const user = userEvent.setup();
    render(<FontBook />);

    await user.click(button("Add Collection"));
    await screen.findByRole("textbox", { name: "Collection name" });
    await user.keyboard("{Enter}");
    expect(collection("New Collection")).toHaveAttribute("aria-selected", "true");
    expect(frame()).toHaveAccessibleName("New Collection (0 Fonts)");
    expect(within(fonts()).queryAllByRole("row")).toHaveLength(0);
    expect(screen.getByText("No Fonts")).toBeInTheDocument();
    expect(button("Disable")).toHaveAttribute("aria-disabled", "true");

    await user.click(button("Add Collection"));
    await screen.findByRole("textbox", { name: "Collection name" });
    await user.keyboard("{Enter}");
    expect(collection("New Collection 2")).toHaveAttribute("aria-selected", "true");
    expect(collection("New Collection")).toHaveAttribute("aria-selected", "false");
  });

  it("adds the font files the browser can load, and shows the first", async () => {
    const user = userEvent.setup();
    // The test environment has no FontFace and no document.fonts: these stand in for the
    // browser's, and refuse the file named "broken" as a browser refuses a file that is no font.
    // The file named "Capybara" loads only when the test lets it.
    const registered: string[] = [];
    const loaded: string[] = [];
    let release: (() => void) | undefined;
    class FakeFontFace {
      constructor(public family: string) {}
      load(): Promise<FakeFontFace> {
        loaded.push(this.family);
        if (this.family === "broken") return Promise.reject(new Error("not a font"));
        if (this.family !== "Capybara") return Promise.resolve(this);
        return new Promise((resolve) => {
          release = () => resolve(this);
        });
      }
    }
    vi.stubGlobal("FontFace", FakeFontFace);
    // These files hold no font, and this test is not about validating them.
    changeDesktopValue(FONT_BOOK_VALIDATE, false);
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        add: (face: FakeFontFace) => registered.push(face.family),
        delete: (face: FakeFontFace) => registered.splice(registered.indexOf(face.family), 1),
      },
    });
    try {
      const { unmount } = render(<FontBook />);
      await user.click(collection("Web"));

      await user.upload(screen.getByLabelText("Choose font files"), [
        new File(["0"], "broken.ttf"),
        new File(["1"], "Aardvark Sans.otf"),
      ]);
      await waitFor(() => expect(previewed()).toBe("Aardvark Sans Regular"));
      expect(registered).toEqual(["Aardvark Sans"]);
      // The library is shown, with the new family in its place by name and selected.
      expect(collection("All Fonts")).toHaveAttribute("aria-selected", "true");
      expect(frame()).toHaveAccessibleName("All Fonts (282 Fonts)");
      expect(rows().slice(0, 2)).toEqual(["Aardvark Sans", "Al Bayan"]);
      expect(fontRow("Aardvark Sans")).toHaveAttribute("aria-selected", "true");
      expect(sample().style.fontFamily).toMatch(/^"Aardvark Sans", /);
      expect(rows()).not.toContain("broken");

      // A family that is already listed is not added twice.
      await user.upload(
        screen.getByLabelText("Choose font files"),
        new File(["1"], "Aardvark Sans.otf"),
      );
      await waitFor(() => expect(registered).toHaveLength(1));
      expect(frame()).toHaveAccessibleName("All Fonts (282 Fonts)");

      // Nor is a file that is chosen again while it is still loading.
      const input = screen.getByLabelText("Choose font files");
      fireEvent.change(input, { target: { files: [new File(["2"], "Bandicoot.ttf")] } });
      fireEvent.change(input, { target: { files: [new File(["2"], "Bandicoot.ttf")] } });
      await waitFor(() => expect(previewed()).toBe("Bandicoot Regular"));
      expect(registered).toEqual(["Aardvark Sans", "Bandicoot"]);
      expect(frame()).toHaveAccessibleName("All Fonts (283 Fonts)");
      expect(rows().filter((name) => name === "Bandicoot")).toHaveLength(1);

      // A window that closes takes the fonts it added off the page. A file still loading then
      // does not stay either, and the files after it are not loaded at all.
      fireEvent.change(input, {
        target: { files: [new File(["3"], "Capybara.ttf"), new File(["4"], "Dormouse.ttf")] },
      });
      await waitFor(() => expect(release).toBeDefined());
      unmount();
      expect(registered).toEqual([]);
      release?.();
      await new Promise((resolve) => setTimeout(resolve));
      expect(registered).toEqual([]);
      expect(loaded).toContain("Capybara");
      expect(loaded).not.toContain("Dormouse");
    } finally {
      Reflect.deleteProperty(document, "fonts");
    }
  });

  it("passes the window's props to the window", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <FontBook
        ref={ref}
        state="inactive"
        width={800}
        height={500}
        className="mine"
        style={{ left: 12 }}
        data-testid="font-book"
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-font-book", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-testid", "font-book");
    expect(frame()).toHaveStyle({ width: "800px", height: "500px", left: "12px" });
  });

  it("hands the window controls their callbacks and states", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = render(
      <FontBook onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} zoomRole="zoom" />,
    );
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    // The window controls' props are not attributes of the window.
    expect(frame()).not.toHaveAttribute("zoomrole");

    rerender(<FontBook minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
    expect(button("Close")).toBeEnabled();
  });

  it("reports a press and a double click on the title bar, its drag region", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <FontBook
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(bar()).toContainElement(button("Add Fonts"));

    fireEvent.pointerDown(bar(), { button: 2 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar(), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // The toolbar's controls and the content are not part of the drag region.
    fireEvent.pointerDown(button("Add Fonts"), { button: 0 });
    fireEvent.pointerDown(search(), { button: 0 });
    fireEvent.pointerDown(sample(), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(bar());
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(fontBookApp);
    expect(app).toMatchObject({
      id: "font-book",
      name: "Font Book",
      component: FontBook,
      defaultSize: { width: 1017, height: 603 },
      minSize: { width: 640, height: 320 },
      resizable: true,
    });
    expect(app.menus).toEqual(["Font Book", "File", "Edit", "View", "Window", "Help"]);

    render(
      <WindowManager style={{ height: 900 }}>
        <ManagedWindow
          id={app.id}
          title={app.name}
          resizable={app.resizable}
          minWidth={app.minSize.width}
          minHeight={app.minSize.height}
          defaultFrame={{ x: 20, y: 30, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    const host = frame().parentElement as HTMLElement;
    expect(host).toHaveAttribute("data-window-id", "font-book");
    expect(host).toHaveStyle({ width: "1017px", height: "603px" });
    // The manager sizes the wrapper; the window fills it.
    expect(frame()).toHaveStyle({ width: "100%", height: "100%" });
    expect(frame()).toHaveAttribute("data-window-state", "key");

    // The manager moves the window by its title bar.
    const before = host.style.transform;
    fireEvent.pointerDown(bar(), { button: 0, pointerId: 1, clientX: 300, clientY: 10 });
    fireEvent.pointerMove(bar(), { pointerId: 1, clientX: 340, clientY: 40 });
    fireEvent.pointerUp(bar(), { pointerId: 1, clientX: 340, clientY: 40 });
    expect(host.style.transform).not.toBe(before);

    // The app still works in there.
    await user.click(collection("Fun"));
    expect(frame()).toHaveAccessibleName("Fun (28 Fonts)");

    await user.click(button("Close"));
    expect(screen.queryByRole("region")).toBeNull();
  });
});
