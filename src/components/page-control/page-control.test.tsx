import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageControl } from "./index";

const dot = (page: number, count = 3) =>
  screen.getByRole("button", { name: `Page ${page} of ${count}` });

describe("PageControl", () => {
  it("renders a labelled group with one dot per page and two arrows", () => {
    render(<PageControl count={3} aria-label="Pages" />);
    const group = screen.getByRole("group", { name: "Pages" });
    expect(group).toHaveClass("mac-page-control");
    expect(group).toHaveAttribute("data-variant", "pager");
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(dot(1)).toHaveAttribute("aria-current", "page");
    expect(dot(2)).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
  });

  it("has no arrows in the overlay variant unless asked", () => {
    const { rerender } = render(<PageControl variant="overlay" count={2} aria-label="Pages" />);
    expect(screen.getByRole("group")).toHaveAttribute("data-variant", "overlay");
    expect(screen.getAllByRole("button")).toHaveLength(2);

    rerender(<PageControl variant="overlay" count={2} arrows aria-label="Pages" />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("goes to a page when its dot is clicked (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PageControl count={3} defaultPage={1} onPageChange={onPageChange} aria-label="P" />);
    expect(dot(2)).toHaveAttribute("aria-current", "page");

    await user.click(dot(3));
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
    expect(dot(3)).toHaveAttribute("aria-current", "page");
    expect(dot(2)).not.toHaveAttribute("aria-current");

    await user.click(dot(3));
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  it("steps with the arrows and does not wrap", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PageControl count={2} onPageChange={onPageChange} aria-label="P" />);
    const previous = screen.getByRole("button", { name: "Previous page" });
    const next = screen.getByRole("button", { name: "Next page" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(next).not.toHaveAttribute("aria-disabled");

    await user.click(previous);
    expect(onPageChange).not.toHaveBeenCalled();

    await user.click(next);
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(1);
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(previous).not.toHaveAttribute("aria-disabled");

    await user.click(next);
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  it("keeps focus on an arrow that reaches the last page", async () => {
    const user = userEvent.setup();
    render(<PageControl count={2} aria-label="P" />);
    const next = screen.getByRole("button", { name: "Next page" });
    next.focus();
    await user.keyboard("{Enter}");
    expect(dot(2, 2)).toHaveAttribute("aria-current", "page");
    expect(next).toHaveFocus();
  });

  it("has one tab stop for the dots and moves between them with the arrow keys", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PageControl count={3} arrows={false} onPageChange={onPageChange} aria-label="P" />);

    await user.tab();
    expect(dot(1)).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(dot(2)).toHaveFocus();
    expect(dot(2)).toHaveAttribute("aria-current", "page");

    await user.keyboard("{End}");
    expect(dot(3)).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(dot(3)).toHaveFocus();
    expect(onPageChange).toHaveBeenLastCalledWith(2);

    await user.keyboard("{Home}");
    expect(dot(1)).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(dot(1)).toHaveAttribute("aria-current", "page");

    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("activates a dot with Enter and Space", async () => {
    const user = userEvent.setup();
    render(<PageControl count={3} arrows={false} aria-label="P" />);
    dot(2).focus();
    await user.keyboard("{Enter}");
    expect(dot(2)).toHaveAttribute("aria-current", "page");
    dot(3).focus();
    await user.keyboard(" ");
    expect(dot(3)).toHaveAttribute("aria-current", "page");
  });

  it("follows the page prop when controlled and only reports changes", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <PageControl count={3} page={0} onPageChange={onPageChange} aria-label="P" />,
    );
    await user.click(dot(3));
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
    expect(dot(1)).toHaveAttribute("aria-current", "page");

    rerender(<PageControl count={3} page={2} onPageChange={onPageChange} aria-label="P" />);
    expect(dot(3)).toHaveAttribute("aria-current", "page");
  });

  it("works as a controlled component driven by state", async () => {
    const user = userEvent.setup();
    function Pager() {
      const [page, setPage] = useState(0);
      return <PageControl count={3} page={page} onPageChange={setPage} aria-label="P" />;
    }
    render(<Pager />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(dot(2)).toHaveAttribute("aria-current", "page");
  });

  it("clamps a page that is out of range", () => {
    render(<PageControl count={3} page={9} aria-label="P" />);
    expect(dot(3)).toHaveAttribute("aria-current", "page");
  });

  it("treats count and page as whole numbers", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <PageControl count={2.5} defaultPage={0.7} onPageChange={onPageChange} aria-label="Pages" />,
    );
    expect(screen.getAllByRole("button", { name: /^Page / })).toHaveLength(2);
    expect(dot(1, 2)).toHaveAttribute("aria-current", "page");
    expect(dot(1, 2)).toHaveAttribute("tabindex", "0");

    await user.click(dot(2, 2));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    expect(dot(2, 2)).toHaveAttribute("tabindex", "0");

    for (const count of [Number.POSITIVE_INFINITY, Number.NaN, -3]) {
      rerender(<PageControl count={count} aria-label="Pages" />);
      expect(screen.queryAllByRole("button", { name: /^Page / })).toHaveLength(0);
    }

    // A count beyond what a row of dots can show keeps every page: 100 dots are drawn, those
    // that hold the current page.
    rerender(<PageControl count={5000} page={4999} aria-label="Pages" />);
    expect(screen.getAllByRole("button", { name: /^Page / })).toHaveLength(100);
    expect(dot(5000, 5000)).toHaveAttribute("tabindex", "0");
    expect(dot(4901, 5000)).toBeInTheDocument();
  });

  it("reaches every page of more than 100 with the arrows and the keys, and focus follows", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <PageControl count={250} defaultPage={99} onPageChange={onPageChange} aria-label="Pages" />,
    );
    expect(screen.getAllByRole("button", { name: /^Page / })).toHaveLength(100);
    expect(dot(1, 250)).toBeInTheDocument();

    // The next arrow leaves the first hundred: the row shows the hundred with page 101.
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(100);
    expect(dot(101, 250)).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("button", { name: /^Page / })).toHaveLength(100);

    // End and Home go to dots that were not drawn; each takes focus when it is.
    dot(101, 250).focus();
    await user.keyboard("{End}");
    expect(onPageChange).toHaveBeenLastCalledWith(249);
    expect(dot(250, 250)).toHaveFocus();
    expect(dot(250, 250)).toHaveAttribute("tabindex", "0");
    await user.keyboard("{Home}");
    expect(onPageChange).toHaveBeenLastCalledWith(0);
    expect(dot(1, 250)).toHaveFocus();

    // An arrow key across the boundary keeps focus on the current page too.
    await user.click(dot(100, 250));
    await user.keyboard("{ArrowRight}");
    expect(dot(101, 250)).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(dot(100, 250)).toHaveFocus();
  });

  it("ignores input and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PageControl count={3} disabled onPageChange={onPageChange} aria-label="P" />);
    expect(screen.getByRole("group")).toHaveAttribute("data-disabled");
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();

    await user.click(dot(3));
    await user.tab();
    expect(onPageChange).not.toHaveBeenCalled();
    expect(document.body).toHaveFocus();
  });

  it("uses custom labels", () => {
    render(
      <PageControl
        count={2}
        getPageLabel={(page) => `Effects ${page + 1}`}
        previousLabel="Earlier"
        nextLabel="Later"
        aria-label="P"
      />,
    );
    expect(screen.getByRole("button", { name: "Effects 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Earlier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Later" })).toBeInTheDocument();
  });

  it("forwards ref, className and native attributes to the group", () => {
    const ref = createRef<HTMLDivElement>();
    render(<PageControl ref={ref} count={2} className="extra" id="pager" aria-label="P" />);
    expect(ref.current).toBe(screen.getByRole("group"));
    expect(ref.current).toHaveClass("mac-page-control", "extra");
    expect(ref.current).toHaveAttribute("id", "pager");
  });
});
