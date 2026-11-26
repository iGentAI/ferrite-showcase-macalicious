import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "./index";

function Example({
  delay = 0,
  ...root
}: { delay?: number } & React.ComponentProps<typeof Tooltip>) {
  return (
    <Tooltip {...root}>
      <TooltipTrigger delay={delay}>Share</TooltipTrigger>
      <TooltipPopup>Share the selected items</TooltipPopup>
    </Tooltip>
  );
}

describe("Tooltip", () => {
  it("renders the trigger and nothing else until it opens", () => {
    render(<Example />);
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on hover and closes when the pointer leaves", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.hover(screen.getByRole("button", { name: "Share" }));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Share the selected items");
    expect(tooltip).toHaveClass("mac-tooltip");
    expect(tooltip).toHaveAttribute("data-kind", "help-tag");
    await user.unhover(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("opens on keyboard focus and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Share" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("describes its trigger for assistive technology", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Share" });
    await user.hover(trigger);
    await screen.findByRole("tooltip");
    expect(trigger).toHaveAccessibleDescription("Share the selected items");
  });

  it("waits for the pointer to rest before opening", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Example delay={1500} />);
      await user.hover(screen.getByRole("button", { name: "Share" }));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("can start open, and reports changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen onOpenChange={onOpenChange} />);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.hover(screen.getByRole("button", { name: "Share" }));
    await user.unhover(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything()));
  });

  it("follows a controlled open prop", () => {
    const { rerender } = render(<Example open={false} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    rerender(<Example open />);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    render(<Example disabled />);
    await user.hover(screen.getByRole("button", { name: "Share" }));
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("marks an expansion tooltip", () => {
    render(<Example kind="expansion" defaultOpen />);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-kind", "expansion");
  });

  it("makes any element the trigger through render", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip>
        <TooltipTrigger delay={0} render={<a href="#help">Help</a>} />
        <TooltipPopup>Opens the help book</TooltipPopup>
      </Tooltip>,
    );
    await user.hover(screen.getByRole("link", { name: "Help" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Opens the help book");
  });

  it("renders the popup into a given container and forwards ref and className", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const ref = createRef<HTMLDivElement>();
    render(
      <Tooltip defaultOpen>
        <TooltipTrigger>Share</TooltipTrigger>
        <TooltipPopup container={container} ref={ref} className="wide">
          Share the selected items
        </TooltipPopup>
      </Tooltip>,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(container).toContainElement(tooltip);
    expect(ref.current).toBe(tooltip);
    expect(tooltip).toHaveClass("mac-tooltip", "wide");
    container.remove();
  });

  it("works inside a provider", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delay={0}>
        <Tooltip>
          <TooltipTrigger>Share</TooltipTrigger>
          <TooltipPopup>Share the selected items</TooltipPopup>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.hover(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
  });
});
