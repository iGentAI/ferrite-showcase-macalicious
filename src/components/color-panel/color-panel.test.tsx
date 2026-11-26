import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorPanel, ColorPanelWell } from "./index";

const tab = (name: string) => screen.getByRole("tab", { name });
const slider = (name: string) => screen.getByRole("slider", { name });
const field = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;
const swatch = () => screen.getByRole("img", { name: /^Current color/ });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ColorPanel", () => {
  it("renders a panel window titled Colors with a toolbar of five pickers, the wheel shown", () => {
    render(<ColorPanel data-testid="panel" />);
    const panel = screen.getByTestId("panel");
    expect(panel).toHaveClass("mac-window", "mac-color-panel");
    expect(panel).toHaveAttribute("data-variant", "panel");
    expect(panel).toHaveAttribute("data-window-state", "key");
    expect(panel).toHaveAccessibleName("Colors");
    expect(panel).toHaveStyle({ width: "228px" });
    const tabs = within(screen.getByRole("tablist", { name: "Color pickers" })).getAllByRole("tab");
    expect(tabs.map((element) => element.getAttribute("aria-label"))).toEqual([
      "Color Wheel",
      "Color Sliders",
      "Color Palettes",
      "Image Palettes",
      "Pencils",
    ]);
    expect(tab("Color Wheel")).toHaveAttribute("aria-selected", "true");
    expect(slider("Hue and saturation")).toBeInTheDocument();
    expect(slider("Brightness")).toBeInTheDocument();
    expect(swatch()).toHaveAccessibleName("Current color #000000");
    expect(screen.queryByRole("slider", { name: "Opacity" })).not.toBeInTheDocument();
  });

  it("closes from its close button, and dims Minimize and Enter Full Screen with the reason", async () => {
    const onClose = vi.fn();
    render(<ColorPanel onClose={onClose} />);
    const controls = screen.getByRole("group", { name: "Window controls" });
    expect(within(controls).getByRole("button", { name: "Minimize" })).toBeDisabled();
    expect(within(controls).getByRole("button", { name: /Full Screen|Zoom/ })).toBeDisabled();
    expect(controls).toHaveAttribute(
      "title",
      "A panel closes; it does not minimize or go full screen",
    );
    await userEvent.click(within(controls).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the picker chosen in the toolbar, with the pointer and with the keyboard", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<ColorPanel defaultValue="#ff8000" onModeChange={onModeChange} />);

    await user.click(tab("Color Palettes"));
    expect(onModeChange).toHaveBeenLastCalledWith("palettes");
    expect(screen.getByRole("radiogroup", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Orange" })).toBeChecked();
    expect(screen.queryByRole("slider", { name: "Brightness" })).not.toBeInTheDocument();

    // The toolbar is one tab stop; arrows move within it and Return chooses.
    tab("Color Palettes").focus();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onModeChange).toHaveBeenLastCalledWith("image");
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onModeChange).toHaveBeenLastCalledWith("pencils");
    expect(screen.getAllByRole("radio")).toHaveLength(48);
    await user.keyboard("{Home}{Enter}");
    expect(tab("Color Wheel")).toHaveAttribute("aria-selected", "true");
  });

  it("is controlled by mode and onModeChange", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const { rerender } = render(<ColorPanel mode="sliders" onModeChange={onModeChange} />);
    expect(tab("Color Sliders")).toHaveAttribute("aria-selected", "true");
    await user.click(tab("Pencils"));
    expect(onModeChange).toHaveBeenLastCalledWith("pencils");
    expect(tab("Color Sliders")).toHaveAttribute("aria-selected", "true");
    rerender(<ColorPanel mode="pencils" onModeChange={onModeChange} />);
    expect(screen.getByRole("radiogroup", { name: "Pencils" })).toBeInTheDocument();
  });

  it("reports the colour chosen in a palette and shows it as the current colour", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPanel defaultMode="pencils" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("radio", { name: "Maraschino" }));
    expect(onValueChange).toHaveBeenLastCalledWith("#ff2600");
    expect(swatch()).toHaveAccessibleName("Current color #ff2600");
    expect(swatch()).toHaveStyle({ color: "#ff2600" });
  });

  it("edits the colour with the sliders picker and shows the result as the current colour", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorPanel defaultMode="sliders" defaultValue="#ff9300" onValueChange={onValueChange} />,
    );
    expect(slider("Green")).toHaveValue("147");
    slider("Blue").focus();
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith("#ff93ff");
    expect(swatch()).toHaveAccessibleName("Current color #ff93ff");
    expect(field("Hex Color #")).toHaveValue("FF93FF");
  });

  it("keeps the hue through black across a change of picker", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPanel defaultValue="#0000ff" onValueChange={onValueChange} />);
    slider("Brightness").focus();
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("#000000");
    // Another picker, and back: the wheel is a new one, and the colour is still a blue.
    await user.click(tab("Image Palettes"));
    await user.click(tab("Color Wheel"));
    slider("Brightness").focus();
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith("#0000ff");
  });

  it("has an opacity slider only with showsAlpha, and then reports #rrggbbaa", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPanel showsAlpha defaultValue="#ff0000" onValueChange={onValueChange} />);
    expect(slider("Opacity")).toHaveValue("100");
    await user.clear(field("Opacity value"));
    await user.type(field("Opacity value"), "50");
    expect(onValueChange).toHaveBeenLastCalledWith("#ff000080");
    expect(swatch()).toHaveAccessibleName("Current color #ff0000, opacity 50%");
    // A colour from a palette keeps the opacity.
    await user.click(tab("Color Palettes"));
    await user.click(screen.getByRole("radio", { name: "Blue" }));
    expect(onValueChange).toHaveBeenLastCalledWith("#0000ff80");
  });

  it("reports opaque colours without showsAlpha, whatever the value's opacity", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorPanel defaultMode="palettes" defaultValue="#ff000080" onValueChange={onValueChange} />,
    );
    expect(swatch()).toHaveAccessibleName("Current color #ff0000");
    await user.click(screen.getByRole("radio", { name: "Green" }));
    expect(onValueChange).toHaveBeenLastCalledWith("#00ff00");
  });

  it("is controlled by value and onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <ColorPanel mode="palettes" value="#ff0000" onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("radio", { name: "Blue" }));
    expect(onValueChange).toHaveBeenLastCalledWith("#0000ff");
    expect(screen.getByRole("radio", { name: "Red" })).toBeChecked();
    rerender(<ColorPanel mode="palettes" value="#0000ff" onValueChange={onValueChange} />);
    expect(screen.getByRole("radio", { name: "Blue" })).toBeChecked();
  });

  it("disables the eyedropper where the browser cannot pick from the screen", () => {
    render(<ColorPanel />);
    const eyedropper = screen.getByRole("button", { name: "Pick a color from the screen" });
    expect(eyedropper).toBeDisabled();
    expect(screen.getByText("This browser cannot pick from the screen.")).toBeVisible();
  });

  it("picks a colour from the screen with the browser's EyeDropper", async () => {
    const user = userEvent.setup();
    const open = vi.fn().mockResolvedValue({ sRGBHex: "#34C759" });
    vi.stubGlobal(
      "EyeDropper",
      class {
        open = open;
      },
    );
    const onValueChange = vi.fn();
    render(<ColorPanel onValueChange={onValueChange} />);
    const eyedropper = screen.getByRole("button", { name: "Pick a color from the screen" });
    expect(eyedropper).toBeEnabled();
    expect(screen.queryByText("This browser cannot pick from the screen.")).toBeNull();
    await user.click(eyedropper);
    expect(open).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("img", { name: "Current color #34c759" })).toBeInTheDocument();
    expect(onValueChange).toHaveBeenLastCalledWith("#34c759");
  });

  it("keeps the colour when picking from the screen is cancelled", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "EyeDropper",
      class {
        open = () => Promise.reject(new DOMException("cancelled", "AbortError"));
      },
    );
    const onValueChange = vi.fn();
    render(<ColorPanel defaultValue="#ff0000" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "Pick a color from the screen" }));
    expect(swatch()).toHaveAccessibleName("Current color #ff0000");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("calls onClose from the close button, and takes other controls or none", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<ColorPanel onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<ColorPanel controls={null} />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("forwards ref, className, title, width, state and native attributes to the window", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ColorPanel
        ref={ref}
        className="extra"
        id="colors"
        title="Fill"
        width={260}
        state="inactive"
      />,
    );
    expect(ref.current).toHaveClass("mac-color-panel", "extra");
    expect(ref.current).toHaveAttribute("id", "colors");
    expect(ref.current).toHaveAttribute("data-window-state", "inactive");
    expect(ref.current).toHaveAccessibleName("Fill");
    expect(ref.current).toHaveStyle({ width: "260px" });
  });
});

describe("ColorPanelWell", () => {
  const well = () => screen.getByLabelText("Text colour") as HTMLInputElement;

  it("renders a colour well with its colour and no panel", () => {
    render(<ColorPanelWell aria-label="Text colour" defaultValue="#ff9300" variant="toolbar" />);
    expect(well()).toHaveClass("mac-color-well");
    expect(well()).toHaveAttribute("type", "color");
    expect(well()).toHaveAttribute("data-variant", "toolbar");
    expect(well()).toHaveValue("#ff9300");
    expect(well()).not.toHaveAttribute("data-active");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the panel on a click instead of the browser's chooser, and draws the well active", async () => {
    const user = userEvent.setup();
    render(<ColorPanelWell aria-label="Text colour" defaultValue="#ff9300" />);
    // A click that is not cancelled would open the browser's own chooser.
    expect(fireEvent.click(well())).toBe(false);
    const panel = await screen.findByRole("dialog", { name: "Colors" });
    expect(panel).toHaveClass("mac-color-panel");
    expect(well()).toHaveAttribute("data-active");
    expect(well()).toHaveAttribute("aria-haspopup", "dialog");
    // The well stays what it is: a colour input, with no role laid over it.
    expect(well()).not.toHaveAttribute("role");
    expect(swatch()).toHaveAccessibleName("Current color #ff9300");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(well()).not.toHaveAttribute("data-active");
    expect(well()).toHaveFocus();
  });

  it("opens and closes from the keyboard, and closes from the panel's close button", async () => {
    const user = userEvent.setup();
    render(<ColorPanelWell aria-label="Text colour" />);
    await user.tab();
    expect(well()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    well().focus();
    await user.keyboard(" ");
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
  });

  it("closes on a second click on the well, and on a click outside the panel", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ColorPanelWell aria-label="Text colour" />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(well());
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
    await user.click(well());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(well()).not.toHaveAttribute("data-active");

    await user.click(well());
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls the consumer's click and key handlers, which can keep the panel closed", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    const { rerender } = render(
      <ColorPanelWell aria-label="Text colour" onClick={onClick} onKeyDown={onKeyDown} />,
    );
    await user.click(well());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
    await user.click(well());
    well().focus();
    await user.keyboard("a");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <ColorPanelWell aria-label="Text colour" onClick={(event) => event.preventDefault()} />,
    );
    await user.click(well());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape while the focus is on the well, and toggles once for a held key", async () => {
    const user = userEvent.setup();
    render(<ColorPanelWell aria-label="Text colour" />);
    await user.click(well());
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
    well().focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // The first keydown opens; the repeats of a held key change nothing.
    fireEvent.keyDown(well(), { key: "Enter" });
    expect(fireEvent.keyDown(well(), { key: "Enter", repeat: true })).toBe(false);
    fireEvent.keyDown(well(), { key: "Enter", repeat: true });
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
  });

  it("leaves Escape to the page while the panel is closed, and keeps it while it is open", async () => {
    const user = userEvent.setup();
    const seen: [string, boolean][] = [];
    const listen = (event: KeyboardEvent) => seen.push([event.key, event.defaultPrevented]);
    document.addEventListener("keydown", listen);
    try {
      render(<ColorPanelWell aria-label="Text colour" />);
      // Closed: Escape is not the well's, so a sheet or a dialog around it still gets it.
      well().focus();
      await user.keyboard("{Escape}");
      expect(seen).toEqual([["Escape", false]]);

      // Open: Escape closes the panel and nothing else.
      await user.click(well());
      expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
      seen.length = 0;
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(seen).toEqual([]);
      expect(well()).toHaveFocus();
    } finally {
      document.removeEventListener("keydown", listen);
    }
  });

  it("runs the cleanup of a callback ref given to the panel when the panel closes", async () => {
    const user = userEvent.setup();
    const cleanup = vi.fn();
    const callback = vi.fn((_element: HTMLDivElement | null) => cleanup);
    render(<ColorPanelWell aria-label="Text colour" panel={{ ref: callback }} />);
    await user.click(well());
    const dialog = await screen.findByRole("dialog", { name: "Colors" });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(dialog);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cleanup).toHaveBeenCalledTimes(1);
    // A ref with a cleanup is not called again with null.
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("gives the well's element to a ref, and runs a callback ref's cleanup", () => {
    const ref = createRef<HTMLElement>();
    const { rerender, unmount } = render(<ColorPanelWell aria-label="Text colour" ref={ref} />);
    expect(ref.current).toBe(well());

    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    rerender(<ColorPanelWell aria-label="Text colour" ref={callback} />);
    expect(callback).toHaveBeenLastCalledWith(well());
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("shows the colour the panel picks and reports it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorPanelWell
        aria-label="Text colour"
        onValueChange={onValueChange}
        panel={{ defaultMode: "palettes", showsAlpha: true }}
      />,
    );
    await user.click(well());
    await user.click(await screen.findByRole("radio", { name: "Red" }));
    expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");
    expect(well()).toHaveValue("#ff0000");
    // The well holds #rrggbb only: it shows the colour without its opacity.
    await user.clear(field("Opacity value"));
    await user.type(field("Opacity value"), "50");
    expect(onValueChange).toHaveBeenLastCalledWith("#ff000080");
    expect(well()).toHaveValue("#ff0000");
  });

  it("is controlled by value and onValueChange", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState("#0000ff");
      return (
        <>
          <ColorPanelWell
            aria-label="Text colour"
            value={value}
            onValueChange={setValue}
            panel={{ defaultMode: "palettes" }}
          />
          <output>{value}</output>
        </>
      );
    }
    render(<Controlled />);
    await user.click(well());
    expect(await screen.findByRole("radio", { name: "Blue" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Green" }));
    expect(screen.getByRole("status")).toHaveTextContent("#00ff00");
    expect(well()).toHaveValue("#00ff00");
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    render(<ColorPanelWell aria-label="Text colour" disabled />);
    expect(well()).toBeDisabled();
    await user.click(well());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
