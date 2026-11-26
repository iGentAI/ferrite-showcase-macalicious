import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PathBar, PathBarItem } from "./index";

describe("PathBar", () => {
  it("is a navigation landmark named Path that holds an ordered list", () => {
    render(
      <PathBar>
        <PathBarItem>Macintosh HD</PathBarItem>
        <PathBarItem>Users</PathBarItem>
      </PathBar>,
    );
    const bar = screen.getByRole("navigation", { name: "Path" });
    expect(bar).toHaveClass("mac-path-bar");
    const list = within(bar).getByRole("list");
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Macintosh HD");
  });

  it("renders the empty bar without children", () => {
    render(<PathBar />);
    const bar = screen.getByRole("navigation", { name: "Path" });
    expect(within(bar).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("marks the last component as the current location", () => {
    render(
      <PathBar>
        <PathBarItem>Macintosh HD</PathBarItem>
        <PathBarItem>Users</PathBarItem>
        <PathBarItem>Documents</PathBarItem>
      </PathBar>,
    );
    expect(screen.getByText("Documents").closest("[aria-current]")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Users").closest("[aria-current]")).toBeNull();
  });

  it("leaves the marking alone when an item sets current itself", () => {
    render(
      <PathBar>
        <PathBarItem current>Macintosh HD</PathBarItem>
        <PathBarItem>Users</PathBarItem>
      </PathBar>,
    );
    expect(screen.getByText("Macintosh HD").closest("[aria-current]")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Users").closest("[aria-current]")).toBeNull();
  });

  it("accepts an explicit name, a ref, a className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(<PathBar ref={ref} aria-label="Location" className="extra" id="path" />);
    const bar = screen.getByRole("navigation", { name: "Location" });
    expect(ref.current).toBe(bar);
    expect(bar).toHaveClass("mac-path-bar", "extra");
    expect(bar).toHaveAttribute("id", "path");
  });
});

describe("PathBarItem", () => {
  it("is plain text without onActivate and hides its icon from assistive technology", () => {
    const { container } = render(
      <PathBar>
        <PathBarItem icon={<svg data-testid="icon" />}>Users</PathBarItem>
      </PathBar>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByTestId("icon").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector(".mac-path-bar-name")).toHaveTextContent("Users");
  });

  it("opens on a double click, not on a single click, as in Finder", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(
      <PathBar>
        <PathBarItem onActivate={onActivate}>Users</PathBarItem>
      </PathBar>,
    );
    const component = screen.getByRole("button", { name: "Users" });

    await user.click(component);
    expect(onActivate).not.toHaveBeenCalled();

    await user.dblClick(component);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("opens once for a run of clicks: on the second, not again on the third or fourth", () => {
    const onActivate = vi.fn();
    render(
      <PathBar>
        <PathBarItem onActivate={onActivate}>Users</PathBarItem>
      </PathBar>,
    );
    const component = screen.getByRole("button", { name: "Users" });
    // The browser counts the clicks of a run in `detail`.
    for (const detail of [1, 2, 3, 4]) fireEvent.click(component, { detail });
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0]?.[0].detail).toBe(2);
  });

  it("opens at once with Return and Space", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(
      <PathBar>
        <PathBarItem onActivate={onActivate}>Users</PathBarItem>
      </PathBar>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Users" })).toHaveFocus();

    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('opens on a single click with activation="click"', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(
      <PathBar>
        <PathBarItem onActivate={onActivate} activation="click">
          Users
        </PathBarItem>
      </PathBar>,
    );
    await user.click(screen.getByRole("button", { name: "Users" }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("forwards ref, className and native attributes to the list item", () => {
    const ref = createRef<HTMLLIElement>();
    render(
      <PathBar>
        <PathBarItem ref={ref} className="extra" id="users">
          Users
        </PathBarItem>
      </PathBar>,
    );
    expect(ref.current).toHaveClass("mac-path-bar-item", "extra");
    expect(ref.current).toHaveAttribute("id", "users");
  });
});
