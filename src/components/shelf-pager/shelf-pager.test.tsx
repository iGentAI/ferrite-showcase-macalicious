import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ShelfPager } from "./index";

describe("ShelfPager", () => {
  it("puts a chevron button before and after its children", () => {
    render(
      <ShelfPager data-testid="pager">
        <p>Shelf</p>
      </ShelfPager>,
    );
    const pager = screen.getByTestId("pager");
    expect(pager).toHaveClass("mac-shelf-pager");
    const previous = screen.getByRole("button", { name: "Previous" });
    const next = screen.getByRole("button", { name: "Next" });
    expect(pager.firstElementChild).toBe(previous);
    expect(pager.lastElementChild).toBe(next);
    expect(previous).toHaveAttribute("data-direction", "previous");
    expect(next).toHaveAttribute("data-direction", "next");
    expect(screen.getByText("Shelf").parentElement).toBe(pager);
  });

  it("names the chevrons with the labels it is given", () => {
    render(<ShelfPager previousLabel="Previous shows" nextLabel="More shows" />);
    expect(screen.getByRole("button", { name: "Previous shows" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More shows" })).toBeInTheDocument();
  });

  it("calls onPrevious and onNext on click, Enter and Space", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(<ShelfPager onPrevious={onPrevious} onNext={onNext} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onNext).toHaveBeenCalledTimes(3);
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("reaches the chevrons with Tab, around what they page", async () => {
    const user = userEvent.setup();
    render(
      <ShelfPager>
        <button type="button">Card</button>
      </ShelfPager>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Previous" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Card" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("keeps a disabled chevron focusable and inert", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(<ShelfPager previousDisabled onPrevious={onPrevious} onNext={onNext} />);
    const previous = screen.getByRole("button", { name: "Previous" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toHaveAttribute("data-disabled");
    expect(screen.getByRole("button", { name: "Next" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(previous);
    await user.tab();
    expect(previous).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it("forwards ref, className, style and other attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ShelfPager ref={ref} className="extra" style={{ width: 420 }} id="pager" />);
    expect(ref.current).toHaveClass("mac-shelf-pager", "extra");
    expect(ref.current).toHaveStyle({ width: "420px" });
    expect(ref.current).toHaveAttribute("id", "pager");
  });
});
