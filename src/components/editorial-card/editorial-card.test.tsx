import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { EditorialCard } from "./index";

describe("EditorialCard", () => {
  it("is a panel by default, with its eyebrow, title and body in reading order", () => {
    render(
      <EditorialCard data-testid="card" eyebrow="Collection" title="Act Fast!">
        These games push your reaction time to the limit.
      </EditorialCard>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("mac-editorial-card");
    expect(card).toHaveAttribute("data-variant", "panel");
    expect(card).not.toHaveAttribute("data-raised");
    expect(card).toHaveTextContent(
      "Collection Act Fast! These games push your reaction time to the limit.",
    );
  });

  it("leaves out the lines and the artwork it is not given", () => {
    render(<EditorialCard data-testid="card" title="Only a title" />);
    const card = screen.getByTestId("card");
    expect(card.querySelector(".mac-editorial-card-title")).toHaveTextContent("Only a title");
    expect(card.querySelector(".mac-editorial-card-eyebrow")).toBeNull();
    expect(card.querySelector(".mac-editorial-card-body")).toBeNull();
    expect(card.querySelector(".mac-editorial-card-artwork")).toBeNull();
  });

  it("holds the artwork after the text", () => {
    render(
      <EditorialCard
        data-testid="card"
        title="Title"
        artwork={<img alt="A lake" src="lake.png" />}
      />,
    );
    const picture = screen.getByRole("img", { name: "A lake" });
    expect(picture.parentElement).toHaveClass("mac-editorial-card-artwork");
    expect(picture.parentElement?.previousElementSibling).toHaveClass("mac-editorial-card-text");
  });

  it("makes the title a heading of the given level, and plain text without one", () => {
    render(
      <>
        <EditorialCard title="Act Fast!" headingLevel={3} />
        <EditorialCard data-testid="plain" title="Plain" />
      </>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Act Fast!" })).toHaveClass(
      "mac-editorial-card-title",
    );
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("marks a hero, and a raised hero", () => {
    render(
      <>
        <EditorialCard data-testid="flat" variant="hero" title="Flat" />
        <EditorialCard data-testid="raised" variant="hero" raised title="Raised" />
      </>,
    );
    expect(screen.getByTestId("flat")).toHaveAttribute("data-variant", "hero");
    expect(screen.getByTestId("flat")).not.toHaveAttribute("data-raised");
    expect(screen.getByTestId("raised")).toHaveAttribute("data-raised");
  });

  it("does not raise a panel", () => {
    render(<EditorialCard data-testid="card" raised title="Panel" />);
    expect(screen.getByTestId("card")).not.toHaveAttribute("data-raised");
  });

  it("is a link through the render prop, named by its text", () => {
    render(
      <EditorialCard render={<a href="#story" />} eyebrow="Featured App" title="Print a Project" />,
    );
    const link = screen.getByRole("link", { name: "Featured App Print a Project" });
    expect(link).toHaveAttribute("href", "#story");
    expect(link).toHaveClass("mac-editorial-card");
  });

  it("is a button through the render prop: click, Enter and Space activate it", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EditorialCard render={<button type="button" />} title="Open" onClick={onClick} />);
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
      <EditorialCard render={<button type="button" disabled />} title="Open" onClick={onClick} />,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open" })).not.toHaveFocus();
  });

  it("forwards ref, className, style and other attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <EditorialCard
        ref={ref}
        className="extra"
        style={{ width: 462 }}
        id="card"
        aria-label="Story"
        data-story="7"
      />,
    );
    expect(ref.current).toHaveClass("mac-editorial-card", "extra");
    expect(ref.current).toHaveStyle({ width: "462px" });
    expect(ref.current).toHaveAttribute("id", "card");
    expect(ref.current).toHaveAttribute("aria-label", "Story");
    expect(ref.current).toHaveAttribute("data-story", "7");
    expect(ref.current).not.toHaveAttribute("title");
  });
});
