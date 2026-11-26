import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import WindowManagerExample from "./examples/window-manager";
import {
  MissionControl,
  type MissionControlProps,
  MissionControlSpace,
  MissionControlWindow,
} from "./index";

// Two windows side by side on the desktop and a third under them, as their frames say.
const WINDOWS = [
  { title: "Calendar", frame: { x: 100, y: 500, width: 400, height: 300 } },
  { title: "Notes", frame: { x: 0, y: 0, width: 400, height: 300 } },
  { title: "Maps", frame: { x: 300, y: 20, width: 600, height: 300 } },
];

function Overview({
  onChoose,
  onSwitch,
  ...props
}: MissionControlProps & {
  onChoose?: (title: string) => void;
  onSwitch?: (label: string) => void;
}) {
  return (
    <MissionControl
      spaces={["Desktop 1", "Desktop 2"].map((label, index) => (
        <MissionControlSpace
          key={label}
          label={label}
          current={index === 0}
          onClick={() => onSwitch?.(label)}
        >
          <span data-testid={`picture-${label}`} />
        </MissionControlSpace>
      ))}
      {...props}
    >
      {WINDOWS.map((window) => (
        <MissionControlWindow
          key={window.title}
          title={window.title}
          frame={window.frame}
          icon={<span data-testid={`icon-${window.title}`} />}
          onClick={() => onChoose?.(window.title)}
        >
          <span data-testid={`content-${window.title}`} />
        </MissionControlWindow>
      ))}
    </MissionControl>
  );
}

const button = (name: string) => screen.getByRole("button", { name });
const gone = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

describe("MissionControl", () => {
  it("renders nothing while closed", () => {
    render(<Overview />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();
  });

  it("is a dialog with a group of spaces and a group of windows, each a named button", async () => {
    render(<Overview defaultOpen />);
    const dialog = await screen.findByRole("dialog", { name: "Mission Control" });
    expect(dialog).toHaveClass("mac-mission-control");
    const spaces = within(dialog).getByRole("group", { name: "Spaces" });
    expect(within(spaces).getAllByRole("button")).toHaveLength(2);
    expect(button("Desktop 1")).toHaveClass("mac-mission-control-space");
    const windows = within(dialog).getByRole("group", { name: "Windows" });
    expect(within(windows).getAllByRole("button")).toHaveLength(3);
    expect(button("Maps")).toHaveClass("mac-mission-control-window");
    // The surface has the focus, so that no thumbnail looks chosen.
    await waitFor(() => expect(dialog).toHaveFocus());
  });

  it("marks the current space", async () => {
    render(<Overview defaultOpen />);
    await screen.findByRole("dialog");
    expect(button("Desktop 1")).toHaveAttribute("aria-current", "true");
    expect(button("Desktop 1")).toHaveAttribute("data-current");
    expect(button("Desktop 2")).not.toHaveAttribute("aria-current");
    expect(button("Desktop 2")).not.toHaveAttribute("data-current");
  });

  it("keeps pictures and window content out of the way of assistive technology", async () => {
    render(<Overview defaultOpen />);
    await screen.findByRole("dialog");
    for (const id of ["picture-Desktop 1", "content-Notes"]) {
      const decoration = screen.getByTestId(id).parentElement;
      expect(decoration).toHaveAttribute("aria-hidden", "true");
      expect(decoration).toHaveAttribute("inert");
    }
    expect(within(button("Notes")).getByTestId("icon-Notes")).toBeInTheDocument();
  });

  it("lays the windows out in rows, in reading order, at their frames' sizes", async () => {
    render(<Overview defaultOpen />);
    const dialog = await screen.findByRole("dialog");
    const windows = within(dialog).getByRole("group", { name: "Windows" });
    // Notes and Maps are higher on the desktop than Calendar, and Notes is left of Maps.
    expect(within(windows).getAllByRole("button")).toEqual([
      button("Notes"),
      button("Maps"),
      button("Calendar"),
    ]);
    // The first row is 400 + 12 + 600 points wide and 320 high; Calendar is under it.
    const slot = (name: string) => button(name).parentElement as HTMLElement;
    expect(slot("Notes")).toHaveStyle({ left: "0%", top: "0%" });
    expect(Number.parseFloat(slot("Notes").style.width)).toBeCloseTo((400 / 1012) * 100);
    expect(Number.parseFloat(slot("Maps").style.left)).toBeCloseTo((412 / 1012) * 100);
    expect(Number.parseFloat(slot("Maps").style.top)).toBeCloseTo((20 / 632) * 100);
    expect(Number.parseFloat(slot("Calendar").style.top)).toBeCloseTo((332 / 632) * 100);
    // Centred in its row.
    expect(Number.parseFloat(slot("Calendar").style.left)).toBeCloseTo((306 / 1012) * 100);
    expect(screen.getByTestId("content-Maps").parentElement).toHaveStyle({
      width: "600px",
      height: "300px",
    });
  });

  it("renders inside the container it is given", async () => {
    function Desktop() {
      const [element, setElement] = useState<HTMLDivElement | null>(null);
      return (
        <div ref={setElement} data-testid="desktop">
          <Overview defaultOpen container={element} />
        </div>
      );
    }
    render(<Desktop />);
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByTestId("desktop")).toContainElement(dialog);
  });

  it("closes on Escape and on a click on the desktop", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Overview defaultOpen onOpenChange={onOpenChange} />);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    await gone();

    rerender(<Overview key="second" defaultOpen onOpenChange={onOpenChange} />);
    await user.click(await screen.findByRole("button", { name: "Close Mission Control" }));
    await gone();
  });

  it("stays open when controlled until the prop changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Overview open onOpenChange={onOpenChange} />);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    await user.click(button("Notes"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Overview open={false} onOpenChange={onOpenChange} />);
    await gone();
  });

  it("calls back for a chosen window and closes", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const onOpenChange = vi.fn();
    render(<Overview defaultOpen onChoose={onChoose} onOpenChange={onOpenChange} />);
    await screen.findByRole("dialog");
    await user.click(button("Maps"));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("Maps");
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    await gone();
  });

  it("calls back for a chosen space and closes", async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(<Overview defaultOpen onSwitch={onSwitch} />);
    await screen.findByRole("dialog");
    await user.click(button("Desktop 2"));
    expect(onSwitch).toHaveBeenCalledExactlyOnceWith("Desktop 2");
    await gone();
  });

  it("stays open for a space or window with closeOnClick off or a prevented click", async () => {
    const user = userEvent.setup();
    const frame = { x: 0, y: 0, width: 300, height: 200 };
    render(
      <MissionControl
        defaultOpen
        spaces={
          <>
            <MissionControlSpace label="Stay" closeOnClick={false} />
            <MissionControlSpace label="Prevent" onClick={(event) => event.preventDefault()} />
          </>
        }
      >
        <MissionControlWindow title="Pinned" frame={frame} closeOnClick={false} />
        <MissionControlWindow
          title="Held"
          frame={frame}
          onClick={(event) => event.preventDefault()}
        />
      </MissionControl>,
    );
    await screen.findByRole("dialog");
    for (const name of ["Stay", "Prevent", "Pinned", "Held"]) await user.click(button(name));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("moves among the windows with the arrow keys and chooses one with Return or Space", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const { rerender } = render(<Overview defaultOpen onChoose={onChoose} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(button("Notes")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button("Maps")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(button("Calendar")).toHaveFocus();
    // The last window: there is nowhere further to go.
    await user.keyboard("{ArrowRight}");
    expect(button("Calendar")).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(button("Notes")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenLastCalledWith("Notes");
    await gone();

    rerender(<Overview key="second" defaultOpen onChoose={onChoose} />);
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
    await user.keyboard("{ArrowDown}{ArrowRight} ");
    expect(onChoose).toHaveBeenLastCalledWith("Maps");
    await gone();
  });

  it("moves along the bar with the arrow keys, and down from it to the windows", async () => {
    const user = userEvent.setup();
    const onAddSpace = vi.fn();
    render(<Overview defaultOpen onAddSpace={onAddSpace} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toHaveFocus());
    // Tab goes through every button: the bar first.
    await user.tab();
    expect(button("Desktop 1")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button("Desktop 2")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button("Add Desktop")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onAddSpace).toHaveBeenCalledTimes(1);
    expect(dialog).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}{ArrowDown}");
    expect(button("Notes")).toHaveFocus();
    await user.tab();
    expect(button("Maps")).toHaveFocus();
  });

  it("leaves a key alone that its own handler has taken", async () => {
    const user = userEvent.setup();
    render(<Overview defaultOpen onKeyDown={(event) => event.preventDefault()} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(dialog).toHaveFocus();
  });

  it("shows the add button only with a handler, and no bar without spaces or handler", async () => {
    const user = userEvent.setup();
    const onAddSpace = vi.fn();
    const { rerender } = render(<Overview defaultOpen />);
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Add Desktop" })).not.toBeInTheDocument();

    rerender(<Overview defaultOpen spaces={undefined} onAddSpace={onAddSpace} />);
    await user.click(button("Add Desktop"));
    expect(onAddSpace).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<Overview defaultOpen spaces={undefined} />);
    expect(screen.queryByRole("group", { name: "Spaces" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Windows" })).toBeInTheDocument();
  });

  it("has no group of windows when there are none", async () => {
    render(<MissionControl defaultOpen spaces={<MissionControlSpace label="Desktop 1" />} />);
    await screen.findByRole("dialog");
    expect(screen.queryByRole("group", { name: "Windows" })).not.toBeInTheDocument();
  });

  it("takes its labels from props", async () => {
    render(
      <Overview
        defaultOpen
        onAddSpace={() => {}}
        addLabel="Neuer Schreibtisch"
        spacesLabel="Schreibtische"
        windowsLabel="Fenster"
        closeLabel="Schließen"
      />,
    );
    await screen.findByRole("dialog");
    expect(button("Neuer Schreibtisch")).toBeInTheDocument();
    expect(button("Schließen")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Schreibtische" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Fenster" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and other attributes to the overlay", async () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Overview
        defaultOpen
        ref={ref}
        className="overview"
        style={{ order: 2 }}
        data-desktop="1"
        aria-label="Alle Fenster"
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Alle Fenster" });
    expect(ref.current).toBe(dialog);
    expect(dialog).toHaveClass("mac-mission-control", "overview");
    expect(dialog).toHaveStyle({ order: "2" });
    expect(dialog).toHaveAttribute("data-desktop", "1");
  });
});

describe("MissionControlSpace and MissionControlWindow", () => {
  const frame = { x: 0, y: 0, width: 300, height: 200 };

  it("forward ref, className, style and other attributes to their buttons", async () => {
    const space = createRef<HTMLButtonElement>();
    const window = createRef<HTMLButtonElement>();
    render(
      <MissionControl
        defaultOpen
        spaces={
          <MissionControlSpace
            ref={space}
            label="Desktop 1"
            className="mine"
            style={{ order: 1 }}
            data-space="1"
          />
        }
      >
        <MissionControlWindow
          ref={window}
          title="Notes"
          frame={frame}
          className="yours"
          style={{ order: 2 }}
          data-window="notes"
        />
      </MissionControl>,
    );
    await screen.findByRole("dialog");
    expect(space.current).toBe(button("Desktop 1"));
    expect(space.current).toHaveClass("mac-mission-control-space", "mine");
    expect(space.current).toHaveStyle({ order: "1" });
    expect(space.current).toHaveAttribute("data-space", "1");
    expect(window.current).toBe(button("Notes"));
    expect(window.current).toHaveClass("mac-mission-control-window", "yours");
    expect(window.current).toHaveStyle({ order: "2" });
    expect(window.current).toHaveAttribute("data-window", "notes");
  });

  it("are buttons outside a Mission Control too, and render another element through render", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <MissionControlSpace label="Desktop 1" onClick={onClick} />
        <MissionControlWindow title="Notes" frame={frame} onClick={onClick} />
        <MissionControlSpace label="Desktop 2" render={<a href="#two" />} />
      </>,
    );
    expect(button("Desktop 1")).toHaveAttribute("type", "button");
    await user.click(button("Desktop 1"));
    await user.click(button("Notes"));
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("link", { name: "Desktop 2" })).toHaveClass(
      "mac-mission-control-space",
    );
  });
});

describe("MissionControl with a WindowManager", () => {
  it("shows the manager's windows and brings the chosen one to the front", async () => {
    const user = userEvent.setup();
    render(<WindowManagerExample />);
    const region = (name: string) => screen.getByRole("region", { name });
    // The window opened last is key.
    expect(region("Calendar")).toHaveAttribute("data-window-state", "key");

    await user.click(button("Mission Control"));
    const dialog = await screen.findByRole("dialog", { name: "Mission Control" });
    const windows = within(dialog).getByRole("group", { name: "Windows" });
    expect(within(windows).getAllByRole("button")).toHaveLength(3);

    await user.click(within(windows).getByRole("button", { name: "Notes" }));
    await gone();
    expect(region("Notes")).toHaveAttribute("data-window-state", "key");
    expect(region("Calendar")).toHaveAttribute("data-window-state", "inactive");
    await waitFor(() =>
      expect(region("Notes")).toContainElement(document.activeElement as HTMLElement),
    );

    // Closed without a choice, the focus goes back to where it was.
    await user.click(button("Mission Control"));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await gone();
    await waitFor(() => expect(button("Mission Control")).toHaveFocus());
    expect(region("Notes")).toHaveAttribute("data-window-state", "key");
  });
});
