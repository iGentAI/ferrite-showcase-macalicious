import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { BookCover } from "./index";

describe("BookCover", () => {
  it("holds the picture and is not interactive by itself", () => {
    render(
      <BookCover data-testid="cover">
        <img alt="Aqua and Bondi" src="cover.png" />
      </BookCover>,
    );
    const cover = screen.getByTestId("cover");
    expect(cover).toHaveClass("mac-book-cover");
    expect(cover.tagName).toBe("DIV");
    expect(screen.getByRole("img", { name: "Aqua and Bondi" }).parentElement).toBe(cover);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("is a link through the render prop, named by its label", () => {
    render(<BookCover render={<a href="#book" />} aria-label="Aqua and Bondi" />);
    const link = screen.getByRole("link", { name: "Aqua and Bondi" });
    expect(link).toHaveAttribute("href", "#book");
    expect(link).toHaveClass("mac-book-cover");
  });

  it("is named by the picture's alt when it has no label", () => {
    render(
      <BookCover render={<a href="#book" />}>
        <img alt="Field Notes" src="cover.png" />
      </BookCover>,
    );
    expect(screen.getByRole("link", { name: "Field Notes" })).toBeInTheDocument();
  });

  it("is a button through the render prop: click, Enter and Space activate it", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BookCover render={<button type="button" />} aria-label="Open" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Open" });
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does nothing as a disabled button, and leaves the tab order", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <BookCover render={<button type="button" disabled />} aria-label="Open" onClick={onClick} />,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open" })).not.toHaveFocus();
  });

  it("forwards ref, className, style and other attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <BookCover
        ref={ref}
        className="extra"
        style={{ margin: 4 }}
        id="cover"
        aria-label="Book"
        data-book="7"
      />,
    );
    expect(ref.current).toHaveClass("mac-book-cover", "extra");
    expect(ref.current).toHaveStyle({ margin: "4px" });
    expect(ref.current).toHaveAttribute("id", "cover");
    expect(ref.current).toHaveAttribute("aria-label", "Book");
    expect(ref.current).toHaveAttribute("data-book", "7");
  });
});
