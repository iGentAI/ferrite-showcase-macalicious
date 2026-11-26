import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PushButton } from "../push-button";
import {
  Popover,
  PopoverClose,
  PopoverDescription,
  PopoverPopup,
  PopoverSeparator,
  PopoverTitle,
  PopoverTrigger,
} from "./index";

interface ExampleProps extends ComponentProps<typeof Popover> {
  popup?: Partial<ComponentProps<typeof PopoverPopup>>;
}

function Example({ popup, ...root }: ExampleProps) {
  return (
    <>
      <button type="button">Outside</button>
      <Popover {...root}>
        <PopoverTrigger render={<PushButton />}>Show Event</PopoverTrigger>
        <PopoverPopup {...popup}>
          <PopoverTitle>Make Catalina Screenshots</PopoverTitle>
          <PopoverDescription>Oct 3, 2019</PopoverDescription>
          <PopoverClose>Done</PopoverClose>
        </PopoverPopup>
      </Popover>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: "Show Event" });
const popover = () => screen.getByRole("dialog");
const gone = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

describe("Popover", () => {
  it("renders the trigger, as the control given to it, and nothing else until it opens", () => {
    render(<Example />);
    expect(trigger()).toHaveClass("mac-push-button");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens from its trigger, named by its title and described by its description", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(trigger());
    expect(popover()).toHaveClass("mac-popover");
    expect(popover()).toHaveAccessibleName("Make Catalina Screenshots");
    expect(popover()).toHaveAccessibleDescription("Oct 3, 2019");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Make Catalina Screenshots")).toHaveClass("mac-popover-title");
    expect(screen.getByText("Oct 3, 2019")).toHaveClass("mac-popover-description");
  });

  it("opens from the keyboard and closes on Escape, returning the focus", async () => {
    const user = userEvent.setup();
    render(<Example />);
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(popover()).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await gone();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("closes when something outside is clicked, like a transient popover", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen onOpenChange={onOpenChange} />);
    await user.click(screen.getByText("Outside"));
    await gone();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it("stays open when the outside press and the focus leaving are cancelled", async () => {
    const user = userEvent.setup();
    render(
      <Example
        defaultOpen
        onOpenChange={(open, details) => {
          if (!open && (details.reason === "outside-press" || details.reason === "focus-out")) {
            details.cancel();
          }
        }}
      />,
    );
    await user.click(screen.getByText("Outside"));
    expect(popover()).toBeInTheDocument();
  });

  it("closes from a PopoverClose", async () => {
    const user = userEvent.setup();
    render(<Example defaultOpen />);
    await user.click(screen.getByRole("button", { name: "Done" }));
    await gone();
  });

  it("follows a controlled open prop", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Example open={false} onOpenChange={onOpenChange} />);
    await user.click(trigger());
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<Example open onOpenChange={onOpenChange} />);
    expect(popover()).toBeInTheDocument();
  });

  it("draws an arrow unless told not to", () => {
    const { unmount } = render(<Example defaultOpen />);
    expect(popover().querySelector(".mac-popover-arrow")).not.toBeNull();
    unmount();
    render(<Example defaultOpen popup={{ arrow: false }} />);
    expect(popover().querySelector(".mac-popover-arrow")).toBeNull();
  });

  it("appears on the side it is given", async () => {
    render(<Example defaultOpen popup={{ side: "right", align: "start" }} />);
    await waitFor(() => expect(popover()).toHaveAttribute("data-side", "right"));
    expect(popover()).toHaveAttribute("data-align", "start");
  });

  it("merges className and style, and forwards ref and other props to the popup", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Example
        defaultOpen
        popup={{
          className: "mine",
          style: { width: 260 },
          ref,
          id: "event",
          "aria-label": "Event",
        }}
      />,
    );
    expect(ref.current).toBe(popover());
    expect(popover()).toHaveClass("mac-popover", "mine");
    expect(popover()).toHaveStyle({ width: "260px" });
    expect(popover()).toHaveAttribute("id", "event");
  });

  it("renders into a container, and stays mounted while closed when asked", () => {
    const container = document.createElement("div");
    document.body.append(container);
    try {
      render(<Example popup={{ container, keepMounted: true }} />);
      expect(container.querySelector(".mac-popover")).not.toBeNull();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      container.remove();
    }
  });
});

describe("PopoverSeparator", () => {
  it("is a separator in the popover, and forwards ref, className and attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Popover defaultOpen>
        <PopoverPopup aria-label="Event">
          <PopoverSeparator ref={ref} className="mine" data-kind="group" />
          <PopoverSeparator orientation="vertical" aria-hidden="true" />
        </PopoverPopup>
      </Popover>,
    );
    const line = screen.getByRole("separator");
    expect(ref.current).toBe(line);
    expect(popover()).toContainElement(line);
    expect(line).toHaveClass("mac-popover-separator", "mine");
    expect(line).toHaveAttribute("data-kind", "group");
    expect(line).toHaveAttribute("data-orientation", "horizontal");
    // A line that is only visual is hidden from assistive technology by its owner.
    expect(screen.getAllByRole("separator", { hidden: true })).toHaveLength(2);
  });
});
