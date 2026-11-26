import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  NotificationCenter,
  NotificationCenterEmpty,
  NotificationCenterGroup,
  type NotificationCenterProps,
  NotificationCenterView,
} from "./index";

function Panel(props: NotificationCenterProps) {
  return (
    <NotificationCenter {...props}>
      <NotificationCenterView value="today">Widgets</NotificationCenterView>
      <NotificationCenterView value="notifications">Delivered</NotificationCenterView>
    </NotificationCenter>
  );
}

describe("NotificationCenter", () => {
  it("is a named landmark with two tabs and shows the Today view first", () => {
    render(<Panel />);
    const panel = screen.getByRole("complementary", { name: "Notification Center" });
    expect(panel).toHaveClass("mac-notification-center");
    expect(panel).toHaveAttribute("data-open");
    expect(panel).not.toHaveAttribute("inert");
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Today", "Notifications"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Widgets");
  });

  it("switches views on a click and reports it", async () => {
    const onValueChange = vi.fn();
    render(<Panel onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Notifications" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("notifications");
    expect(screen.getByRole("tab", { name: "Notifications" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Delivered");
  });

  it("starts with the view it is given", () => {
    render(<Panel defaultValue="notifications" />);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Delivered");
  });

  it("shows the view it is given when controlled", async () => {
    const onValueChange = vi.fn();
    render(<Panel value="today" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Notifications" }));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("notifications");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Widgets");
  });

  it("moves between the segments with the arrow keys and selects with Return", async () => {
    render(<Panel />);
    await userEvent.tab();
    expect(screen.getByRole("tab", { name: "Today" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Notifications" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Delivered");
  });

  it("hides a view that is kept mounted while the other is shown", async () => {
    render(
      <NotificationCenter>
        <NotificationCenterView value="today" keepMounted data-testid="today">
          Widgets
        </NotificationCenterView>
        <NotificationCenterView value="notifications" keepMounted data-testid="notifications">
          Delivered
        </NotificationCenterView>
      </NotificationCenter>,
    );
    expect(screen.getByTestId("today")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("notifications")).toHaveAttribute("hidden");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    await userEvent.click(screen.getByRole("tab", { name: "Notifications" }));
    expect(screen.getByTestId("today")).toHaveAttribute("hidden");
    expect(screen.getByTestId("notifications")).not.toHaveAttribute("hidden");
  });

  it("takes the titles of the segments and its own name", () => {
    render(
      <Panel
        todayLabel="Heute"
        notificationsLabel="Mitteilungen"
        aria-label="Mitteilungszentrale"
      />,
    );
    expect(screen.getByRole("complementary", { name: "Mitteilungszentrale" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Heute" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mitteilungen" })).toBeInTheDocument();
  });

  it("has the footer button in the Today view only", async () => {
    const onEdit = vi.fn();
    render(<Panel editLabel="Edit" onEdit={onEdit} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("tab", { name: "Notifications" }));
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("has no footer buttons unless asked for", () => {
    render(<Panel />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has a named gear button when it can open the preferences", async () => {
    const onSettings = vi.fn();
    render(<Panel onSettings={onSettings} settingsLabel="Preferences" />);
    const gear = screen.getByRole("button", { name: "Preferences" });
    gear.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onSettings).toHaveBeenCalledTimes(2);
  });

  it("takes no input and is hidden from assistive technology while closed", () => {
    render(<Panel open={false} data-testid="panel" />);
    const panel = screen.getByTestId("panel");
    expect(panel).toHaveAttribute("inert");
    expect(panel).not.toHaveAttribute("data-open");
  });

  it("forwards ref, className, style and attributes to the root and to a view", () => {
    const ref = createRef<HTMLElement>();
    const viewRef = createRef<HTMLDivElement>();
    render(
      <NotificationCenter ref={ref} className="extra" id="nc" style={{ top: 22 }}>
        <NotificationCenterView ref={viewRef} value="today" className="view" data-kind="today" />
      </NotificationCenter>,
    );
    expect(ref.current?.tagName).toBe("ASIDE");
    expect(ref.current).toHaveClass("mac-notification-center", "extra");
    expect(ref.current).toHaveAttribute("id", "nc");
    expect(ref.current).toHaveStyle({ top: "22px" });
    expect(viewRef.current).toHaveClass("mac-notification-center-view", "view");
    expect(viewRef.current).toHaveAttribute("data-kind", "today");
  });
});

describe("NotificationCenterGroup", () => {
  it("is a region named by its heading", () => {
    render(<NotificationCenterGroup heading="Yesterday">Cards</NotificationCenterGroup>);
    const group = screen.getByRole("region", { name: "Yesterday" });
    expect(group).toHaveClass("mac-notification-center-group");
    expect(within(group).getByRole("heading", { level: 2, name: "Yesterday" })).toBeInTheDocument();
    expect(group).toHaveTextContent("Cards");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has a clear button, described by the heading, when it can clear", async () => {
    const onClear = vi.fn();
    render(<NotificationCenterGroup heading="Today" onClear={onClear} />);
    const clear = screen.getByRole("button", { name: "Clear" });
    expect(clear).toHaveAccessibleDescription("Today");
    await userEvent.click(clear);
    clear.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it("takes the name of the clear button", () => {
    render(<NotificationCenterGroup heading="Today" onClear={() => {}} clearLabel="Clear all" />);
    expect(screen.getByRole("button", { name: "Clear all" })).toBeInTheDocument();
  });

  it("forwards ref, className and attributes", () => {
    const ref = createRef<HTMLElement>();
    render(<NotificationCenterGroup ref={ref} heading="Today" className="extra" id="today" />);
    expect(ref.current).toHaveClass("mac-notification-center-group", "extra");
    expect(ref.current).toHaveAttribute("id", "today");
  });
});

describe("NotificationCenterEmpty", () => {
  it("is a paragraph that takes className and ref", () => {
    const ref = createRef<HTMLParagraphElement>();
    render(
      <NotificationCenterEmpty ref={ref} className="extra">
        No Notifications
      </NotificationCenterEmpty>,
    );
    expect(screen.getByText("No Notifications")).toBe(ref.current);
    expect(ref.current).toHaveClass("mac-notification-center-empty", "extra");
  });
});
