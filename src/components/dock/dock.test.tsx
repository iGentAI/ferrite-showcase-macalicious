import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { Dock, DockItem, DockSeparator } from "./index";

/** A Dock of three applications, a separator and a folder. */
function Example({ children, ...props }: Parameters<typeof Dock>[0] & { children?: ReactNode }) {
  return (
    <Dock {...props}>
      <DockItem label="Files" />
      <DockItem label="Mail" />
      <DockItem label="Notes" />
      <DockSeparator />
      <DockItem label="Downloads" />
      {children}
    </Dock>
  );
}

const item = (name: string) => screen.getByRole("button", { name });

/**
 * Give the tiles the layout a browser gives them, which jsdom does not compute: 64 pt tiles
 * every 68 pt from 6 pt, in the direction the Dock runs.
 */
function layOut(vertical = false) {
  const place = (element: HTMLElement) =>
    6 + 68 * Array.from(element.parentElement?.children ?? []).indexOf(element);
  const along = vertical ? ("offsetTop" as const) : ("offsetLeft" as const);
  const size = vertical ? ("offsetHeight" as const) : ("offsetWidth" as const);
  vi.spyOn(HTMLElement.prototype, along, "get").mockImplementation(function (this: HTMLElement) {
    return place(this);
  });
  vi.spyOn(HTMLElement.prototype, size, "get").mockReturnValue(64);
}

const grow = (name: string) => Number(item(name).style.getPropertyValue("--_grow"));

describe("Dock", () => {
  it("renders a toolbar named Dock at the bottom", () => {
    render(<Example />);
    const dock = screen.getByRole("toolbar", { name: "Dock" });
    expect(dock).toHaveClass("mac-dock");
    expect(dock).toHaveAttribute("data-position", "bottom");
    expect(dock).toHaveAttribute("aria-orientation", "horizontal");
    expect(dock).not.toHaveAttribute("data-magnification");
  });

  it("takes another name", () => {
    render(<Example aria-label="Applications" />);
    expect(screen.getByRole("toolbar", { name: "Applications" })).toBeInTheDocument();
  });

  it("marks itself as the place minimizing windows shrink to", () => {
    render(<Example />);
    expect(screen.getByRole("toolbar")).toHaveAttribute("data-window-minimize-target");
  });

  it.each(["left", "right"] as const)("is a column on the %s", (position) => {
    render(<Example position={position} />);
    const dock = screen.getByRole("toolbar");
    expect(dock).toHaveAttribute("data-position", position);
    expect(dock).toHaveAttribute("aria-orientation", "vertical");
  });

  it("is one tab stop, with the arrow keys between its items", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Example />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(item("Files")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(item("Mail")).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(item("Downloads")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(item("Notes")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(item("Notes")).toHaveFocus();
  });

  it("goes to the first and the last item with Home and End", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    await user.keyboard("{End}");
    expect(item("Downloads")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(item("Files")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(item("Mail")).toHaveFocus();
  });

  it("moves with Up and Down, not Left and Right, when it is a column", async () => {
    const user = userEvent.setup();
    render(<Example position="left" />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(item("Files")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("Mail")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(item("Files")).toHaveFocus();
  });

  it("calls the caller's key handler as well as its own", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(<Example onKeyDown={onKeyDown} />);
    await user.tab();
    await user.keyboard("{End}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(item("Downloads")).toHaveFocus();
  });

  it("grows the tile under the pointer and its neighbours, and lets go when the pointer leaves", () => {
    layOut();
    render(<Example magnification={96} />);
    const dock = screen.getByRole("toolbar");
    expect(dock).toHaveAttribute("data-magnification");

    // The pointer over the middle of the first tile.
    fireEvent.pointerMove(dock, { clientX: 38 });
    expect(grow("Files")).toBeCloseTo(1.5);
    expect(grow("Mail")).toBeGreaterThan(grow("Notes"));
    expect(grow("Mail")).toBeLessThan(grow("Files"));
    expect(grow("Notes")).toBeGreaterThan(1);
    // Further than two and a half tiles away nothing grows, and a separator never does.
    expect(grow("Downloads")).toBe(1);
    expect(screen.getByRole("separator").style.getPropertyValue("--_grow")).toBe("1");
    // What is after the pointer moves away from it to make room; the tile under it stays.
    const shift = (name: string) =>
      Number.parseFloat(item(name).style.getPropertyValue("--_shift"));
    expect(shift("Files")).toBeCloseTo(0);
    expect(shift("Mail")).toBeGreaterThan(16);
    expect(shift("Downloads")).toBeGreaterThan(shift("Mail"));

    fireEvent.pointerLeave(dock);
    expect(item("Files").style.getPropertyValue("--_grow")).toBe("");
    expect(item("Mail").style.getPropertyValue("--_shift")).toBe("");
  });

  it("puts the tiles back at rest when magnification is taken away or the edge changes", () => {
    layOut();
    const { rerender } = render(<Example magnification={96} />);
    fireEvent.pointerMove(screen.getByRole("toolbar"), { clientX: 38 });
    expect(grow("Files")).toBeCloseTo(1.5);
    rerender(<Example />);
    expect(item("Files").style.getPropertyValue("--_grow")).toBe("");
    expect(item("Mail").style.getPropertyValue("--_shift")).toBe("");

    rerender(<Example magnification={96} />);
    fireEvent.pointerMove(screen.getByRole("toolbar"), { clientX: 38 });
    expect(grow("Files")).toBeCloseTo(1.5);
    rerender(<Example magnification={96} position="left" />);
    expect(item("Files").style.getPropertyValue("--_grow")).toBe("");
  });

  it("does not magnify for a pointer in a popup that is rendered elsewhere", () => {
    layOut();
    render(
      <Example magnification={96}>
        {createPortal(<div data-testid="popup" />, document.body)}
      </Example>,
    );
    fireEvent.pointerMove(screen.getByTestId("popup"), { clientX: 38 });
    expect(item("Files").style.getPropertyValue("--_grow")).toBe("");
  });

  it("does no magnification work for a visitor who prefers reduced motion", () => {
    layOut();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    render(<Example magnification={96} />);
    fireEvent.pointerMove(screen.getByRole("toolbar"), { clientX: 38 });
    expect(item("Files").style.getPropertyValue("--_grow")).toBe("");
    vi.unstubAllGlobals();
  });

  it("leaves Home and End alone when the caller's handler prevented them", async () => {
    const user = userEvent.setup();
    render(<Example onKeyDown={(event) => event.preventDefault()} />);
    await user.tab();
    await user.keyboard("{End}");
    expect(item("Files")).toHaveFocus();
  });

  it("magnifies along a column", () => {
    layOut(true);
    render(<Example position="right" magnification={128} />);
    fireEvent.pointerMove(screen.getByRole("toolbar"), { clientX: 500, clientY: 38 + 68 });
    expect(grow("Mail")).toBeCloseTo(2);
    expect(grow("Files")).toBeCloseTo(grow("Notes"));
  });

  it("does not magnify without the prop, or to a size no larger than the tiles", () => {
    layOut();
    const onPointerMove = vi.fn();
    const { rerender } = render(<Example onPointerMove={onPointerMove} />);
    fireEvent.pointerMove(screen.getByRole("toolbar"), { clientX: 38 });
    expect(onPointerMove).toHaveBeenCalledTimes(1);
    expect(item("Files").style.getPropertyValue("--_grow")).toBe("");

    rerender(<Example magnification={48} />);
    fireEvent.pointerMove(screen.getByRole("toolbar"), { clientX: 38 });
    expect(grow("Files")).toBe(1);
  });

  it("forwards ref, className, style and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Dock ref={ref} id="dock" className="extra" style={{ left: 12 }} data-testid="dock">
        <DockItem label="Files" />
      </Dock>,
    );
    expect(ref.current).toBe(screen.getByRole("toolbar"));
    expect(ref.current).toHaveClass("mac-dock", "extra");
    expect(ref.current).toHaveAttribute("id", "dock");
    expect(ref.current).toHaveAttribute("data-testid", "dock");
    expect(ref.current).toHaveStyle({ left: "12px" });
  });
});

describe("DockItem", () => {
  it("is a button named by its label, with the label and the icon hidden from assistive technology", () => {
    render(
      <Dock>
        <DockItem label="Files" icon={<span data-testid="icon" />} />
      </Dock>,
    );
    const button = item("Files");
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("mac-dock-item");
    // The visible label repeats the name, so it is not read a second time.
    expect(screen.getByText("Files")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(button).not.toHaveAttribute("data-running");
    expect(button).not.toHaveAccessibleDescription();
  });

  it("tells assistive technology that an application is running", () => {
    const { rerender } = render(
      <Dock>
        <DockItem label="Files" running />
      </Dock>,
    );
    expect(item("Files")).toHaveAttribute("data-running");
    expect(item("Files")).toHaveAccessibleDescription("running");

    rerender(
      <Dock>
        <span id="note">3 new</span>
        <DockItem label="Files" running runningLabel="en cours" aria-describedby="note" />
      </Dock>,
    );
    expect(item("Files")).toHaveAccessibleDescription("3 new en cours");

    rerender(
      <Dock>
        <span id="note">3 new</span>
        <DockItem label="Files" aria-describedby="note" />
      </Dock>,
    );
    expect(item("Files")).toHaveAccessibleDescription("3 new");
  });

  it("takes a longer accessible name than its visible label", () => {
    render(
      <Dock>
        <DockItem label="Notes" aria-label="Notes, minimized window" />
      </Dock>,
    );
    expect(item("Notes, minimized window")).toHaveTextContent("Notes");
  });

  it("opens with a click, Return and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Dock>
        <DockItem label="Files" onClick={onClick} />
      </Dock>,
    );
    await user.click(item("Files"));
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does not open when disabled, and stays reachable with the arrow keys", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Dock>
        <DockItem label="Files" />
        <DockItem label="Mail" disabled onClick={onClick} />
      </Dock>,
    );
    const mail = item("Mail");
    expect(mail).toHaveAttribute("aria-disabled", "true");
    expect(mail).toHaveAttribute("data-disabled");
    await user.click(mail);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(mail).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("draws its children over the tile", () => {
    render(
      <Dock>
        <DockItem label="Mail">
          <span data-testid="badge">3</span>
        </DockItem>
      </Dock>,
    );
    expect(item("Mail")).toContainElement(screen.getByTestId("badge"));
  });

  it("works outside a Dock, as a button of its own", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<DockItem label="Files" running onClick={onClick} />);
    const button = item("Files");
    expect(button).toHaveAccessibleDescription("running");
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <Dock>
        <DockItem ref={ref} label="Files" id="files" className="extra" data-app="files" />
      </Dock>,
    );
    expect(ref.current).toBe(item("Files"));
    expect(ref.current).toHaveClass("mac-dock-item", "extra");
    expect(ref.current).toHaveAttribute("id", "files");
    expect(ref.current).toHaveAttribute("data-app", "files");
  });
});

describe("DockSeparator", () => {
  it("is a separator across the Dock that the arrow keys skip", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    render(
      <Dock>
        <DockItem label="Notes" />
        <DockSeparator ref={ref} className="extra" id="line" />
        <DockItem label="Downloads" />
      </Dock>,
    );
    const separator = screen.getByRole("separator");
    expect(ref.current).toBe(separator);
    expect(separator).toHaveClass("mac-dock-separator", "extra");
    expect(separator).toHaveAttribute("id", "line");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(item("Downloads")).toHaveFocus();
  });
});
