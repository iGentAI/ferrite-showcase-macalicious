import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Drawer, DrawerPanel, DrawerTrigger } from "./index";

function Example({
  panel,
  ...root
}: React.ComponentProps<typeof Drawer> & { panel?: React.ComponentProps<typeof DrawerPanel> }) {
  return (
    <Drawer data-testid="drawer" {...root}>
      <DrawerTrigger>Details</DrawerTrigger>
      <DrawerPanel aria-label="Details" {...panel}>
        <button type="button">Inside</button>
      </DrawerPanel>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("is closed by default: a collapsed button and no panel", () => {
    render(<Example />);
    expect(screen.getByTestId("drawer")).toHaveClass("mac-drawer");
    const trigger = screen.getByRole("button", { name: "Details" });
    expect(trigger).toHaveClass("mac-drawer-trigger");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Details" })).not.toBeInTheDocument();
  });

  it("opens and closes with a click on its button", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Details" });

    await user.click(trigger);
    const panel = screen.getByRole("group", { name: "Details" });
    expect(panel).toHaveClass("mac-drawer-panel");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", panel.id);

    await user.click(trigger);
    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Details" })).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens with Return and closes with Space, and its content follows the button with Tab", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    const trigger = screen.getByRole("button", { name: "Details" });
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("group", { name: "Details" })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();

    await user.tab({ shift: true });
    await user.keyboard(" ");
    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Details" })).not.toBeInTheDocument(),
    );
  });

  it("can start open, and reports changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen onOpenChange={onOpenChange} />);
    expect(screen.getByRole("group", { name: "Details" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it("follows a controlled open prop and does not open by itself", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Example open={false} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(screen.queryByRole("group", { name: "Details" })).not.toBeInTheDocument();

    rerender(<Example open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("group", { name: "Details" })).toBeInTheDocument();
  });

  it("does not open when disabled, by pointer or by keyboard", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example disabled onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Details" });
    // Base UI keeps a disabled trigger focusable and marks it with aria-disabled.
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    await user.click(trigger);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Details" })).not.toBeInTheDocument();
  });

  it("forwards className and attributes on the root", () => {
    render(<Example className="extra" id="notes" />);
    const root = screen.getByTestId("drawer");
    expect(root).toHaveClass("mac-drawer", "extra");
    expect(root).toHaveAttribute("id", "notes");
  });
});

describe("DrawerTrigger", () => {
  it("renders the control it is given and keeps both classes", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Drawer>
        <DrawerTrigger
          ref={ref}
          className="extra"
          render={<button type="button" className="own" data-kind="toolbar" />}
        >
          Details
        </DrawerTrigger>
        <DrawerPanel aria-label="Details" />
      </Drawer>,
    );
    const trigger = screen.getByRole("button", { name: "Details" });
    expect(ref.current).toBe(trigger);
    expect(trigger).toHaveClass("mac-drawer-trigger", "extra", "own");
    expect(trigger).toHaveAttribute("data-kind", "toolbar");
    await user.click(trigger);
    expect(screen.getByRole("group", { name: "Details" })).toBeInTheDocument();
  });
});

describe("DrawerPanel", () => {
  it("slides out at the right of a key window by default", () => {
    render(<Example defaultOpen />);
    const panel = screen.getByRole("group", { name: "Details" });
    expect(panel).toHaveAttribute("data-edge", "right");
    expect(panel).toHaveAttribute("data-window-state", "key");
    expect(panel.style.getPropertyValue("--mac-drawer-content-size")).toBe("");
    expect(panel.querySelector(".mac-drawer-content")).toContainElement(
      screen.getByRole("button", { name: "Inside" }),
    );
  });

  it("reflects the edge and the window state", () => {
    render(<Example defaultOpen panel={{ edge: "bottom", state: "inactive" }} />);
    const panel = screen.getByRole("group", { name: "Details" });
    expect(panel).toHaveAttribute("data-edge", "bottom");
    expect(panel).toHaveAttribute("data-window-state", "inactive");
  });

  it("takes its size and offsets as points or CSS lengths, beside a style of its own", () => {
    render(
      <Example
        defaultOpen
        panel={{
          contentSize: 240,
          leadingOffset: 60,
          trailingOffset: "1em",
          style: { outlineWidth: 2 },
        }}
      />,
    );
    const panel = screen.getByRole("group", { name: "Details" });
    expect(panel.style.getPropertyValue("--mac-drawer-content-size")).toBe("240px");
    expect(panel.style.getPropertyValue("--mac-drawer-leading-offset")).toBe("60px");
    expect(panel.style.getPropertyValue("--mac-drawer-trailing-offset")).toBe("1em");
    expect(panel.style.outlineWidth).toBe("2px");
  });

  it("keeps a style given as a function of the panel's state", () => {
    render(
      <Example
        defaultOpen
        panel={{ contentSize: 240, style: (state) => ({ outlineWidth: state.open ? 2 : 1 }) }}
      />,
    );
    const panel = screen.getByRole("group", { name: "Details" });
    expect(panel.style.getPropertyValue("--mac-drawer-content-size")).toBe("240px");
    expect(panel.style.outlineWidth).toBe("2px");
  });

  it("stays in the DOM, hidden, while closed when keepMounted is set", () => {
    const { container } = render(<Example panel={{ keepMounted: true }} />);
    const panel = container.querySelector(".mac-drawer-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).not.toBeVisible();
  });

  it("accepts another role, a ref, a className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Example
        defaultOpen
        panel={{ ref, role: "complementary", className: "extra", id: "details" }}
      />,
    );
    const panel = screen.getByRole("complementary", { name: "Details" });
    expect(ref.current).toBe(panel);
    expect(panel).toHaveClass("mac-drawer-panel", "extra");
    expect(panel).toHaveAttribute("id", "details");
  });
});
