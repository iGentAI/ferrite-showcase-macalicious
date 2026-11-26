import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { TimeMachineBrowser, type TimeMachineBrowserProps } from "./index";

const backups = [
  { value: "mon", label: "Monday at 6:02 PM", mark: "Monday" },
  { value: "tue", label: "Yesterday at 10:17 AM", mark: "Yesterday" },
  { value: "wed", label: "Today at 3:34 PM", mark: "Today" },
  { value: "now", label: "Now", caption: "Now" },
];

const timeline = () => screen.getByRole("listbox", { name: "Backups" });
const selected = () => within(timeline()).getByRole("option", { selected: true });
const older = () => screen.getByRole("button", { name: "Older backup" });
const newer = () => screen.getByRole("button", { name: "Newer backup" });

describe("TimeMachineBrowser", () => {
  it("shows the newest backup in a dialog around the front window", () => {
    render(
      <TimeMachineBrowser backups={backups}>
        <p>Front window</p>
      </TimeMachineBrowser>,
    );
    const dialog = screen.getByRole("dialog", { name: "Time Machine" });
    expect(dialog).toHaveClass("mac-time-machine-browser");
    expect(dialog).toHaveTextContent("Front window");
    expect(within(timeline()).getAllByRole("option")).toHaveLength(4);
    expect(selected()).toHaveAccessibleName("Now");
    expect(timeline()).toHaveAttribute("aria-activedescendant", selected().id);
    expect(screen.getByRole("status")).toHaveTextContent("Now");
    // Nothing is newer than now, and Restore waits for something to restore.
    expect(newer()).toHaveAttribute("aria-disabled", "true");
    expect(older()).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  });

  it("starts at defaultValue and steps with the arrow buttons", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TimeMachineBrowser backups={backups} defaultValue="tue" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Yesterday at 10:17 AM");
    await user.click(newer());
    expect(onValueChange).toHaveBeenLastCalledWith("wed");
    expect(selected()).toHaveAccessibleName("Today at 3:34 PM");
    await user.click(older());
    await user.click(older());
    expect(onValueChange).toHaveBeenLastCalledWith("mon");
    // At the oldest backup the up arrow is disabled and keeps the keyboard.
    expect(older()).toHaveAttribute("aria-disabled", "true");
    expect(older()).toHaveFocus();
    await user.click(older());
    expect(onValueChange).toHaveBeenCalledTimes(3);
  });

  it("steps with the arrow buttons from the keyboard", async () => {
    const user = userEvent.setup();
    render(<TimeMachineBrowser backups={backups} />);
    older().focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(selected()).toHaveAccessibleName("Yesterday at 10:17 AM");
  });

  it("moves along the timeline with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TimeMachineBrowser backups={backups} onValueChange={onValueChange} />);
    timeline().focus();
    await user.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith("wed");
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("mon");
    await user.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenCalledTimes(2);
    await user.keyboard("{ArrowDown}");
    expect(onValueChange).toHaveBeenLastCalledWith("tue");
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith("now");
    expect(timeline()).toHaveFocus();
    expect(timeline()).toHaveAttribute("aria-activedescendant", selected().id);
  });

  it("selects a backup that is clicked on the timeline", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TimeMachineBrowser backups={backups} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("option", { name: "Monday at 6:02 PM" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("mon");
    expect(selected()).toHaveAccessibleName("Monday at 6:02 PM");
  });

  it("can be controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const props: TimeMachineBrowserProps = { backups, onValueChange };
    const { rerender } = render(<TimeMachineBrowser {...props} value="wed" />);
    await user.click(older());
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("tue");
    // Nothing moves until the owner says so.
    expect(selected()).toHaveAccessibleName("Today at 3:34 PM");
    rerender(<TimeMachineBrowser {...props} value="tue" />);
    expect(selected()).toHaveAccessibleName("Yesterday at 10:17 AM");
  });

  it("cancels with the button and with Escape", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<TimeMachineBrowser backups={backups} onCancel={onCancel} cancelLabel="Leave" />);
    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(onCancel).toHaveBeenCalledOnce();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("restores the backup shown once something can be restored", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const { rerender } = render(
      <TimeMachineBrowser backups={backups} defaultValue="tue" onRestore={onRestore} />,
    );
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(onRestore).not.toHaveBeenCalled();
    rerender(
      <TimeMachineBrowser
        backups={backups}
        defaultValue="tue"
        onRestore={onRestore}
        restorable
        restoreLabel="Restore File"
      />,
    );
    const restore = screen.getByRole("button", { name: "Restore File" });
    restore.focus();
    await user.keyboard("{Enter}");
    expect(onRestore).toHaveBeenCalledExactlyOnceWith("tue");
  });

  it("draws one window per older backup in the stack, and blank ones beyond", () => {
    const { container, rerender } = render(
      <TimeMachineBrowser backups={backups} defaultValue="wed" title="Downloads" stack={3} />,
    );
    const layers = () => Array.from(container.querySelectorAll(".mac-time-machine-browser-layer"));
    // Farthest first: one blank window, then the two older backups.
    expect(layers().map((layer) => layer.textContent)).toEqual(["", "Downloads", "Downloads"]);
    expect(layers().map((layer) => layer.hasAttribute("data-empty"))).toEqual([true, false, false]);
    // The stack is decoration.
    expect(layers()[0]?.parentElement).toHaveAttribute("aria-hidden", "true");
    rerender(<TimeMachineBrowser backups={backups} defaultValue="wed" />);
    expect(layers()).toHaveLength(8);
  });

  it("names its parts as asked", () => {
    render(
      <TimeMachineBrowser
        backups={backups}
        aria-label="Restore from backup"
        olderLabel="Back"
        newerLabel="Forward"
        timelineLabel="History"
      />,
    );
    expect(screen.getByRole("dialog", { name: "Restore from backup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forward" })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "History" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <TimeMachineBrowser
        backups={backups}
        ref={ref}
        className="extra"
        id="tm"
        style={{ height: 600 }}
      />,
    );
    expect(ref.current).toBe(screen.getByRole("dialog"));
    expect(ref.current).toHaveClass("mac-time-machine-browser", "extra");
    expect(ref.current).toHaveAttribute("id", "tm");
    expect(ref.current?.style.height).toBe("600px");
  });
});
