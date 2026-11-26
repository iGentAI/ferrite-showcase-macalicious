import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DesktopIcon } from "../desktop-icon";
import { Desktop } from "./index";

function Icons() {
  return (
    <>
      <DesktopIcon icon={null}>Budget.numbers</DesktopIcon>
      <DesktopIcon icon={null}>Holiday.jpg</DesktopIcon>
      <DesktopIcon icon={null}>Letter.rtf</DesktopIcon>
      <DesktopIcon icon={null}>Lists.txt</DesktopIcon>
    </>
  );
}

const icon = (name: string) => screen.getByRole("button", { name });
const selected = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.hasAttribute("data-selected"))
    .map((button) => button.textContent);

describe("Desktop", () => {
  it("is a group named Desktop that holds its icons", () => {
    render(
      <Desktop>
        <Icons />
      </Desktop>,
    );
    const desktop = screen.getByRole("group", { name: "Desktop" });
    expect(desktop).toHaveClass("mac-desktop");
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(selected()).toEqual([]);
  });

  it("takes another name", () => {
    render(<Desktop aria-label="Schreibtisch" />);
    expect(screen.getByRole("group", { name: "Schreibtisch" })).toBeInTheDocument();
  });

  it("draws the picture behind the icons, hidden from assistive technology", () => {
    render(
      <Desktop picture={<img src="data:," alt="" data-testid="picture" />}>
        <Icons />
      </Desktop>,
    );
    const layer = screen.getByTestId("picture").parentElement;
    expect(layer).toHaveClass("mac-desktop-picture");
    expect(layer).toHaveAttribute("aria-hidden", "true");
  });

  it("has no picture layer without a picture", () => {
    const { container } = render(<Desktop />);
    expect(container.querySelector(".mac-desktop-picture")).toBeNull();
  });

  it("selects the clicked icon alone", async () => {
    const user = userEvent.setup();
    render(
      <Desktop defaultValue={["Budget.numbers"]}>
        <Icons />
      </Desktop>,
    );
    expect(selected()).toEqual(["Budget.numbers"]);
    await user.click(icon("Letter.rtf"));
    expect(selected()).toEqual(["Letter.rtf"]);
    expect(icon("Letter.rtf")).toHaveAttribute("aria-pressed", "true");
    expect(icon("Budget.numbers")).toHaveAttribute("aria-pressed", "false");
  });

  it("adds to the selection and takes from it with Command or Shift held", async () => {
    const user = userEvent.setup();
    render(
      <Desktop>
        <Icons />
      </Desktop>,
    );
    await user.click(icon("Budget.numbers"));
    await user.keyboard("{Meta>}");
    await user.click(icon("Letter.rtf"));
    await user.keyboard("{/Meta}");
    expect(selected()).toEqual(["Budget.numbers", "Letter.rtf"]);
    await user.keyboard("{Shift>}");
    await user.click(icon("Budget.numbers"));
    await user.keyboard("{/Shift}");
    expect(selected()).toEqual(["Letter.rtf"]);
  });

  it("deselects everything when the picture is pressed, not when an icon is", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Desktop defaultValue={["Holiday.jpg"]} onValueChange={onValueChange}>
        <Icons />
      </Desktop>,
    );
    await user.pointer({ keys: "[MouseLeft>]", target: icon("Holiday.jpg") });
    expect(selected()).toEqual(["Holiday.jpg"]);
    await user.pointer([{ keys: "[/MouseLeft]" }]);
    onValueChange.mockClear();
    await user.pointer({ keys: "[MouseLeft]", target: screen.getByRole("group") });
    expect(selected()).toEqual([]);
    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it("reports changes and leaves a controlled selection to its owner", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Desktop value={["Holiday.jpg"]} onValueChange={onValueChange}>
        <Icons />
      </Desktop>,
    );
    await user.click(icon("Letter.rtf"));
    expect(onValueChange).toHaveBeenLastCalledWith(["Letter.rtf"]);
    expect(selected()).toEqual(["Holiday.jpg"]);
  });

  it("follows a controlled selection", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<readonly string[]>([]);
      return (
        <Desktop value={value} onValueChange={setValue}>
          <Icons />
        </Desktop>
      );
    }
    render(<Controlled />);
    await user.click(icon("Lists.txt"));
    expect(selected()).toEqual(["Lists.txt"]);
  });

  it("moves the focus and the selection with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    render(
      <Desktop>
        <Icons />
      </Desktop>,
    );
    await user.tab();
    expect(icon("Budget.numbers")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(icon("Holiday.jpg")).toHaveFocus();
    expect(selected()).toEqual(["Holiday.jpg"]);
    await user.keyboard("{End}");
    expect(icon("Lists.txt")).toHaveFocus();
    expect(selected()).toEqual(["Lists.txt"]);
    await user.keyboard("{ArrowDown}");
    expect(icon("Lists.txt")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(icon("Letter.rtf")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(icon("Budget.numbers")).toHaveFocus();
    expect(selected()).toEqual(["Budget.numbers"]);
  });

  it("goes to the icon whose name starts with what is typed", async () => {
    const user = userEvent.setup();
    render(
      <Desktop>
        <Icons />
      </Desktop>,
    );
    await user.tab();
    await user.keyboard("li");
    expect(icon("Lists.txt")).toHaveFocus();
    expect(selected()).toEqual(["Lists.txt"]);
  });

  it("skips a disabled icon with the arrow keys, Home, End and typing", async () => {
    const user = userEvent.setup();
    render(
      <Desktop>
        <DesktopIcon icon={null} disabled>
          Archive.zip
        </DesktopIcon>
        <DesktopIcon icon={null}>Budget.numbers</DesktopIcon>
        <DesktopIcon icon={null} disabled>
          Holiday.jpg
        </DesktopIcon>
        <DesktopIcon icon={null}>Letter.rtf</DesktopIcon>
        <DesktopIcon icon={null} disabled>
          Lists.txt
        </DesktopIcon>
      </Desktop>,
    );
    await user.tab();
    expect(icon("Budget.numbers")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(icon("Letter.rtf")).toHaveFocus();
    expect(selected()).toEqual(["Letter.rtf"]);
    await user.keyboard("{ArrowDown}");
    expect(icon("Letter.rtf")).toHaveFocus();
    expect(selected()).toEqual(["Letter.rtf"]);
    await user.keyboard("{ArrowUp}");
    expect(icon("Budget.numbers")).toHaveFocus();
    await user.keyboard("{End}");
    expect(icon("Letter.rtf")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(icon("Budget.numbers")).toHaveFocus();
    await user.keyboard("ho");
    expect(icon("Budget.numbers")).toHaveFocus();
    expect(selected()).toEqual(["Budget.numbers"]);
  });

  it("moves along a row with the left and right arrow keys, as the grid is laid out", async () => {
    const user = userEvent.setup();
    render(
      <Desktop>
        <Icons />
      </Desktop>,
    );
    // Two columns of two, filled from the trailing edge: the first column is on the right.
    const place = (name: string, left: number, top: number) => {
      icon(name).getBoundingClientRect = () => new DOMRect(left, top, 100, 100);
    };
    place("Budget.numbers", 200, 0);
    place("Holiday.jpg", 200, 112);
    place("Letter.rtf", 100, 0);
    place("Lists.txt", 100, 112);
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(icon("Letter.rtf")).toHaveFocus();
    expect(selected()).toEqual(["Letter.rtf"]);
    await user.keyboard("{ArrowLeft}");
    expect(icon("Letter.rtf")).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowRight}");
    expect(icon("Holiday.jpg")).toHaveFocus();
    expect(selected()).toEqual(["Holiday.jpg"]);
    await user.keyboard("{ArrowRight}");
    expect(icon("Holiday.jpg")).toHaveFocus();
  });

  it("leaves the keys of a window or a Dock on the desktop to them", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      <Desktop onKeyDown={onKeyDown}>
        <Icons />
        <button type="button">Dock item</button>
        <div>
          <button type="button">Window control</button>
        </div>
      </Desktop>,
    );
    for (const name of ["Dock item", "Window control"]) {
      icon(name).focus();
      onKeyDown.mockClear();
      await user.keyboard("{ArrowUp}{Home}{End}b");
      expect(icon(name)).toHaveFocus();
      expect(selected()).toEqual([]);
      expect(onKeyDown).toHaveBeenCalledTimes(4);
      for (const [event] of onKeyDown.mock.calls) expect(event.defaultPrevented).toBe(false);
    }
    await user.click(icon("Lists.txt"));
    await user.keyboard("{ArrowDown}");
    expect(icon("Lists.txt")).toHaveFocus();
  });

  it("toggles the focused icon in the selection with Space", async () => {
    const user = userEvent.setup();
    render(
      <Desktop defaultValue={["Budget.numbers", "Letter.rtf"]}>
        <Icons />
      </Desktop>,
    );
    icon("Letter.rtf").focus();
    await user.keyboard(" ");
    expect(selected()).toEqual(["Budget.numbers"]);
    await user.keyboard(" ");
    expect(selected()).toEqual(["Budget.numbers", "Letter.rtf"]);
  });

  it("keeps the selection on a secondary press and when the application prevented the press", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Desktop defaultValue={["Holiday.jpg"]}>
        <Icons />
      </Desktop>,
    );
    await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("group") });
    expect(selected()).toEqual(["Holiday.jpg"]);
    rerender(
      <Desktop defaultValue={["Holiday.jpg"]} onPointerDown={(event) => event.preventDefault()}>
        <Icons />
      </Desktop>,
    );
    await user.pointer({ keys: "[MouseLeft]", target: screen.getByRole("group") });
    expect(selected()).toEqual(["Holiday.jpg"]);
  });

  it("leaves a key alone when the application's handler prevented it", async () => {
    const user = userEvent.setup();
    render(
      <Desktop onKeyDown={(event) => event.preventDefault()}>
        <Icons />
      </Desktop>,
    );
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(icon("Budget.numbers")).toHaveFocus();
    expect(selected()).toEqual([]);
  });

  it("forwards ref, className, style and other attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Desktop ref={ref} className="screen" style={{ height: 300 }} id="desktop" />);
    const desktop = screen.getByRole("group");
    expect(ref.current).toBe(desktop);
    expect(desktop).toHaveClass("mac-desktop", "screen");
    expect(desktop).toHaveStyle({ height: "300px" });
    expect(desktop).toHaveAttribute("id", "desktop");
  });
});
