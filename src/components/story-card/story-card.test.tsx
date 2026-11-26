import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { StoryCard } from "./index";

describe("StoryCard", () => {
  it("is a lead story by default, with the publisher, the headline and the age in reading order", () => {
    render(
      <StoryCard
        data-testid="card"
        publisher="Harbour Post"
        title="Ferry service returns"
        time="1h ago"
      />,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("mac-story-card");
    expect(card).toHaveAttribute("data-variant", "lead");
    expect(card).not.toHaveAttribute("data-video");
    expect(card).toHaveTextContent("Harbour Post Ferry service returns 1h ago");
  });

  it("leaves out the lines and the picture it is not given", () => {
    render(<StoryCard data-testid="card" title="Only a headline" />);
    const card = screen.getByTestId("card");
    expect(card.querySelector(".mac-story-card-title")).toHaveTextContent("Only a headline");
    expect(card.querySelector(".mac-story-card-publisher")).toBeNull();
    expect(card.querySelector(".mac-story-card-time")).toBeNull();
    expect(card.querySelector(".mac-story-card-artwork")).toBeNull();
  });

  it("holds the picture after the text, and a logo in the publisher's line", () => {
    render(
      <StoryCard
        data-testid="card"
        publisher={<img alt="Harbour Post" src="logo.png" />}
        title="Headline"
        artwork={<img alt="A ferry" src="ferry.png" />}
      />,
    );
    const picture = screen.getByRole("img", { name: "A ferry" });
    expect(picture.parentElement).toHaveClass("mac-story-card-artwork");
    expect(picture.parentElement?.previousElementSibling).toHaveClass("mac-story-card-text");
    expect(screen.getByRole("img", { name: "Harbour Post" }).parentElement).toHaveClass(
      "mac-story-card-publisher",
    );
  });

  it("marks a secondary story and a video story", () => {
    render(
      <>
        <StoryCard data-testid="secondary" variant="secondary" title="Secondary" />
        <StoryCard data-testid="video" video title="Video" />
      </>,
    );
    expect(screen.getByTestId("secondary")).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByTestId("video")).toHaveAttribute("data-video");
  });

  it("makes the headline a heading of the given level, and plain text without one", () => {
    render(
      <>
        <StoryCard title="Ferry service returns" headingLevel={3} />
        <StoryCard title="Plain" />
      </>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Ferry service returns" })).toHaveClass(
      "mac-story-card-title",
    );
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("is a link through the render prop, named by its text", () => {
    render(
      <StoryCard
        render={<a href="#story" />}
        publisher="Harbour Post"
        title="Ferry service returns"
        time="1h ago"
      />,
    );
    const link = screen.getByRole("link", { name: "Harbour Post Ferry service returns 1h ago" });
    expect(link).toHaveAttribute("href", "#story");
    expect(link).toHaveClass("mac-story-card");
  });

  it("is a button through the render prop: click, Enter and Space activate it", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StoryCard render={<button type="button" />} title="Open" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Open" });
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does nothing as a disabled button, and leaves the tab order", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StoryCard render={<button type="button" disabled />} title="Open" onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open" })).not.toHaveFocus();
  });

  it("forwards ref, className, style and other attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <StoryCard
        ref={ref}
        className="extra"
        style={{ width: 399 }}
        id="story"
        aria-label="Story"
        data-story="7"
      />,
    );
    expect(ref.current).toHaveClass("mac-story-card", "extra");
    expect(ref.current).toHaveStyle({ width: "399px" });
    expect(ref.current).toHaveAttribute("id", "story");
    expect(ref.current).toHaveAttribute("aria-label", "Story");
    expect(ref.current).toHaveAttribute("data-story", "7");
    expect(ref.current).not.toHaveAttribute("title");
  });
});
