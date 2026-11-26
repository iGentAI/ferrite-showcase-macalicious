import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProgressWindow, ProgressWindowItem, ProgressWindowName } from "./index";

describe("ProgressWindow", () => {
  it("is a key window named Progress, 399 pt wide", () => {
    render(<ProgressWindow data-testid="window" />);
    const frame = screen.getByRole("region", { name: "Progress" });
    expect(frame).toBe(screen.getByTestId("window"));
    expect(frame).toHaveClass("mac-window", "mac-progress-window");
    expect(frame).toHaveAttribute("data-window-state", "key");
    expect(frame).toHaveStyle({ width: "399px" });
  });

  it("takes another name, a labelling element, a state and a width", () => {
    const { unmount } = render(<ProgressWindow aria-label="Copy" state="inactive" width={500} />);
    const frame = screen.getByRole("region", { name: "Copy" });
    expect(frame).toHaveAttribute("data-window-state", "inactive");
    expect(frame).toHaveStyle({ width: "500px" });
    unmount();

    render(
      <>
        <span id="name">Moving files</span>
        <ProgressWindow aria-labelledby="name" />
      </>,
    );
    expect(screen.getByRole("region", { name: "Moving files" })).not.toHaveAttribute("aria-label");
  });

  it("shows the window controls it is given and its items", () => {
    render(
      <ProgressWindow controls={<button type="button">Minimize</button>}>
        <ProgressWindowItem title="Copying" />
      </ProgressWindow>,
    );
    const frame = screen.getByRole("region", { name: "Progress" });
    expect(within(frame).getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(within(frame).getByRole("group", { name: "Copying" })).toBeInTheDocument();
  });

  it("reports a press on the strip that holds the controls, for a window manager", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <ProgressWindow
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const strip = screen
      .getByRole("region", { name: "Progress" })
      .querySelector(".mac-progress-window-header") as HTMLElement;
    await user.pointer({ keys: "[MouseLeft>]", target: strip });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    await user.pointer({ keys: "[/MouseLeft]" });
    await user.dblClick(strip);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("merges className and style and forwards ref and other props", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ProgressWindow ref={ref} className="mine" style={{ left: 10 }} id="copy" />);
    const frame = screen.getByRole("region", { name: "Progress" });
    expect(ref.current).toBe(frame);
    expect(frame).toHaveClass("mac-progress-window", "mine");
    expect(frame).toHaveStyle({ left: "10px", width: "399px" });
    expect(frame).toHaveAttribute("id", "copy");
  });
});

describe("ProgressWindowItem", () => {
  it("is a group named by its title, holding a progress bar named by it too", () => {
    render(<ProgressWindowItem title="Copying “Report.pdf” to “Desktop”" value={40} />);
    const item = screen.getByRole("group", { name: "Copying “Report.pdf” to “Desktop”" });
    expect(item).toHaveClass("mac-progress-window-item");
    const bar = within(item).getByRole("progressbar", {
      name: "Copying “Report.pdf” to “Desktop”",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveClass("mac-progress-bar", "mac-progress-window-bar");
  });

  it("is indeterminate until it has a value", () => {
    render(<ProgressWindowItem title="Preparing to copy…" />);
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });

  it("gives a text status to the bar as its value text", () => {
    render(<ProgressWindowItem title="Copying" value={3} status="192.9 MB of 6 GB" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuetext", "192.9 MB of 6 GB");
    expect(bar).not.toHaveAttribute("aria-describedby");
    expect(screen.getByText("192.9 MB of 6 GB")).toHaveClass("mac-progress-window-status");
  });

  it("describes the bar with a status that is not plain text", () => {
    render(
      <ProgressWindowItem
        title="Copying"
        value={3}
        status={
          <>
            <b>192.9 MB</b> of 6 GB
          </>
        }
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAccessibleDescription("192.9 MB of 6 GB");
  });

  it("has a stop button only when stopping is handled, and reports it", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const { rerender } = render(<ProgressWindowItem title="Copying" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<ProgressWindowItem title="Copying" onStop={onStop} />);
    const stop = screen.getByRole("button", { name: "Stop" });
    expect(stop).toHaveAccessibleDescription("Copying");
    await user.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);

    stop.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onStop).toHaveBeenCalledTimes(3);
  });

  it("names the stop button as told", () => {
    render(<ProgressWindowItem title="Copying" onStop={() => {}} stopLabel="Cancel copy" />);
    expect(screen.getByRole("button", { name: "Cancel copy" })).toBeInTheDocument();
  });

  it("shows its icon as decoration", () => {
    render(<ProgressWindowItem title="Copying" icon={<svg data-testid="icon" />} />);
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("merges className and forwards ref and other props", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ProgressWindowItem title="Copying" ref={ref} className="mine" id="copy-1" />);
    const item = screen.getByRole("group", { name: "Copying" });
    expect(ref.current).toBe(item);
    expect(item).toHaveClass("mac-progress-window-item", "mine");
    expect(item).toHaveAttribute("id", "copy-1");
  });
});

describe("ProgressWindowName", () => {
  it("keeps the whole name in the document, split so that its end always shows", () => {
    render(
      <ProgressWindowName data-testid="name">Holiday in the mountains.mov</ProgressWindowName>,
    );
    const name = screen.getByTestId("name");
    expect(name).toHaveTextContent("Holiday in the mountains.mov");
    expect(name).toHaveClass("mac-progress-window-name");
    expect(name.lastElementChild).toHaveTextContent("ountains.mov");
  });

  it("keeps as many characters as told, counted by grapheme", () => {
    const { rerender } = render(
      <ProgressWindowName data-testid="name" tail={4}>
        Notes.txt
      </ProgressWindowName>,
    );
    expect(screen.getByTestId("name").lastElementChild).toHaveTextContent(".txt");
    rerender(
      <ProgressWindowName data-testid="name" tail={2}>
        {"a😀b"}
      </ProgressWindowName>,
    );
    expect(screen.getByTestId("name").lastElementChild?.textContent).toBe("😀b");
    // A combining mark stays with its letter, and a joined emoji stays whole.
    rerender(
      <ProgressWindowName data-testid="name" tail={1}>
        {"cafe\u0301"}
      </ProgressWindowName>,
    );
    expect(screen.getByTestId("name").lastElementChild?.textContent).toBe("e\u0301");
    rerender(
      <ProgressWindowName data-testid="name" tail={2}>
        {"a\u{1F469}\u200D\u{1F469}\u200D\u{1F467}b"}
      </ProgressWindowName>,
    );
    expect(screen.getByTestId("name").lastElementChild?.textContent).toBe(
      "\u{1F469}\u200D\u{1F469}\u200D\u{1F467}b",
    );
    rerender(
      <ProgressWindowName data-testid="name" tail={40}>
        Notes.txt
      </ProgressWindowName>,
    );
    expect(screen.getByTestId("name").lastElementChild).toHaveTextContent("Notes.txt");
  });
});
