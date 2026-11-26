import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { CardGrid, CardGridAction, CardGridCard } from "./index";

describe("CardGrid", () => {
  it("renders a section named by its title, with the cards as a list", () => {
    render(
      <CardGrid title="Recently Added">
        <CardGridCard title="Album One" />
        <CardGridCard title="Album Two" />
      </CardGrid>,
    );
    const section = screen.getByRole("region", { name: "Recently Added" });
    expect(section).toHaveClass("mac-card-grid");
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent("Recently Added");

    const list = within(section).getByRole("list");
    expect(list).toHaveAttribute("data-layout", "grid");
    expect(list).not.toHaveAttribute("data-columns");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent("Album Two");
  });

  it("takes the heading level, the layout and the separator", () => {
    render(
      <CardGrid title="Up Next" headingLevel={3} layout="shelf" separator>
        <CardGridCard title="Episode One" />
      </CardGrid>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Up Next" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveAttribute("data-layout", "shelf");
    expect(screen.getByRole("region")).toHaveAttribute("data-separator");
  });

  it("turns the sizing props into its CSS variables and keeps the consumer's style", () => {
    render(
      <CardGrid aria-label="Shows" columns={4} minCardWidth={252} gap="1rem" style={{ width: 800 }}>
        <CardGridCard title="Show One" />
      </CardGrid>,
    );
    const section = screen.getByRole("region", { name: "Shows" });
    expect(section.style.getPropertyValue("--mac-card-grid-columns")).toBe("4");
    expect(section.style.getPropertyValue("--mac-card-grid-min-card-width")).toBe("252px");
    expect(section.style.getPropertyValue("--mac-card-grid-gap")).toBe("1rem");
    expect(section).toHaveStyle({ width: "800px" });
    expect(screen.getByRole("list")).toHaveAttribute("data-columns", "4");
  });

  it("has no header without a title and an action, and skips empty children", () => {
    render(
      <CardGrid aria-label="Albums">
        {null}
        <CardGridCard title="Album One" />
        {false}
      </CardGrid>,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("lets the consumer name the section", () => {
    render(
      <>
        <span id="name">Featured</span>
        <CardGrid title="Albums" aria-labelledby="name" />
      </>,
    );
    expect(screen.getByRole("region", { name: "Featured" })).toBeInTheDocument();
  });

  it("holds many cards", () => {
    render(
      <CardGrid title="Library">
        {Array.from({ length: 600 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
          <CardGridCard key={index} title={`Album ${index + 1}`} />
        ))}
      </CardGrid>,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(600);
  });

  it("makes a shelf a focusable region named after the section, and leaves a grid alone", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CardGrid title="Up Next" layout="shelf">
        <CardGridCard title="Episode One" />
      </CardGrid>,
    );
    const shelf = screen.getByRole("list", { name: "Up Next" });
    await user.tab();
    expect(shelf).toHaveFocus();

    rerender(
      <CardGrid aria-label="Shows" layout="shelf">
        <CardGridCard title="Show One" />
      </CardGrid>,
    );
    expect(screen.getByRole("list", { name: "Shows" })).toHaveAttribute("tabindex", "0");

    rerender(
      <CardGrid title="Up Next">
        <CardGridCard title="Episode One" />
      </CardGrid>,
    );
    expect(screen.getByRole("list")).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("list")).not.toHaveAttribute("aria-labelledby");
  });

  it("scrolls a focused shelf with the arrow keys, Home and End, and leaves a card's keys alone", async () => {
    const user = userEvent.setup();
    render(
      <CardGrid title="Up Next" layout="shelf">
        <CardGridCard render={<button type="button" />} title="Episode One" />
        <CardGridCard title="Episode Two" />
      </CardGrid>,
    );
    const shelf = screen.getByRole("list");
    // jsdom has no layout and no scrolling: give the first card a width and record the calls.
    const scrollBy = vi.fn();
    const scrollTo = vi.fn();
    Object.assign(shelf, { scrollBy, scrollTo });
    Object.defineProperty(shelf, "scrollWidth", { value: 900 });
    const first = shelf.firstElementChild as HTMLElement;
    first.getBoundingClientRect = () => ({ width: 168 }) as DOMRect;
    shelf.style.columnGap = "20px";

    await user.tab();
    expect(shelf).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 188 });
    await user.keyboard("{ArrowLeft}");
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -188 });
    await user.keyboard("{End}");
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 900 });
    await user.keyboard("{Home}");
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0 });

    await user.tab();
    expect(screen.getByRole("button", { name: "Episode One" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{End}");
    expect(scrollBy).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("forwards ref, className and native attributes to the section", () => {
    const ref = createRef<HTMLElement>();
    render(<CardGrid ref={ref} className="extra" id="shelf" aria-label="Shows" />);
    expect(ref.current).toBe(screen.getByRole("region"));
    expect(ref.current).toHaveClass("mac-card-grid", "extra");
    expect(ref.current).toHaveAttribute("id", "shelf");
  });
});

describe("CardGridAction", () => {
  it("is a link in the header, reachable with Tab", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLElement>();
    render(
      <CardGrid
        title="What to Watch"
        action={
          <CardGridAction ref={ref} href="#all" className="extra">
            See All
          </CardGridAction>
        }
      />,
    );
    const link = screen.getByRole("link", { name: "See All" });
    expect(link).toHaveAttribute("href", "#all");
    expect(link).toHaveClass("mac-card-grid-action", "extra");
    expect(ref.current).toBe(link);
    await user.tab();
    expect(link).toHaveFocus();
  });

  it("can be a button, activated with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <CardGridAction render={<button type="button" />} onClick={onClick}>
        See All
      </CardGridAction>,
    );
    const button = screen.getByRole("button", { name: "See All" });
    expect(button).toHaveClass("mac-card-grid-action");
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });
});

describe("CardGridCard", () => {
  it("is static by default and shows its lines of text", async () => {
    const user = userEvent.setup();
    render(
      <CardGridCard
        data-testid="card"
        caption="New"
        title="Episode One"
        subtitle="About the episode"
        footnote="46 min"
      />,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("mac-card-grid-card");
    expect(card).toHaveAttribute("data-variant", "landscape");
    expect(card).toHaveTextContent("NewEpisode OneAbout the episode46 min");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("reflects the variant and shows the artwork", () => {
    render(
      <CardGridCard
        data-testid="card"
        variant="square"
        title="Album One"
        artwork={<img src="cover.png" alt="Cover of Album One" />}
      />,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-variant", "square");
    expect(within(card).getByRole("img", { name: "Cover of Album One" })).toBeInTheDocument();
  });

  it("can be a link named by its text", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLElement>();
    render(
      <CardGridCard ref={ref} render={<a href="#one" />} className="extra" title="Album One" />,
    );
    const link = screen.getByRole("link", { name: "Album One" });
    expect(link).toHaveAttribute("href", "#one");
    expect(link).toHaveClass("mac-card-grid-card", "extra");
    expect(ref.current).toBe(link);
    await user.tab();
    expect(link).toHaveFocus();
  });

  it("can be a button: pointer, Enter and Space activate it, Tab moves between cards", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <CardGrid title="Shows">
        <CardGridCard render={<button type="button" />} onClick={onClick} title="Show One" />
        <CardGridCard render={<button type="button" />} title="Show Two" />
      </CardGrid>,
    );
    const first = screen.getByRole("button", { name: "Show One" });
    await user.click(first);
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);

    await user.tab();
    expect(screen.getByRole("button", { name: "Show Two" })).toHaveFocus();
  });

  it("ignores activation and leaves the tab order when its button is disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <CardGridCard render={<button type="button" disabled />} onClick={onClick} title="Show" />,
    );
    const button = screen.getByRole("button", { name: "Show" });
    expect(button).toBeDisabled();
    await user.click(button);
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("ignores activation but keeps its place in the tab order with aria-disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <CardGridCard
          render={<a href="#show" />}
          aria-disabled="true"
          onClick={onClick}
          title="Link"
        />
        <CardGridCard
          render={<button type="button" />}
          aria-disabled
          onClick={onClick}
          title="Button"
        />
        <CardGridCard
          render={<button type="button" aria-disabled="true" onClick={onClick} />}
          title="Rendered"
        />
      </>,
    );
    const link = screen.getByRole("link", { name: "Link" });
    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    // dispatchEvent returns false when the default action, following the link, was prevented.
    expect(fireEvent.click(link)).toBe(false);

    await user.tab();
    expect(screen.getByRole("button", { name: "Button" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    // Also when the render element carries the attribute and the handler.
    await user.click(screen.getByRole("button", { name: "Rendered" }));
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ignores a click and its own activation keys on any element while aria-disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onKey = vi.fn();
    // A plain element with handlers of its own, also from a render function: the guard is
    // not only for links and buttons.
    const handlers = { tabIndex: 0, onClick, onKeyDown: onKey, onKeyUp: onKey };
    render(
      <>
        <CardGridCard
          render={createElement("div", { ...handlers, "aria-disabled": "true" })}
          title="Disabled"
        />
        <CardGridCard
          render={(props) => createElement("div", { ...props, "aria-disabled": "true" })}
          {...handlers}
          title="By function"
        />
        <CardGridCard render={createElement("div", handlers)} title="Enabled" />
      </>,
    );
    for (const title of ["Disabled", "By function"]) {
      const card = screen.getByText(title).closest<HTMLElement>(".mac-card-grid-card");
      await user.click(screen.getByText(title));
      card?.focus();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      expect(onClick).not.toHaveBeenCalled();
      expect(onKey).not.toHaveBeenCalled();
      // Other keys are not activation: they reach the card's handlers.
      await user.keyboard("{ArrowRight}");
      expect(onKey).toHaveBeenCalledTimes(2);
      onKey.mockClear();
    }

    await user.click(screen.getByText("Enabled"));
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onKey).toHaveBeenCalledTimes(2);
  });

  it("swallows a click inside it while aria-disabled, and leaves the rest of its content alone", async () => {
    const user = userEvent.setup();
    const onGet = vi.fn();
    const onChange = vi.fn();
    const parts = {
      title: "App One",
      subtitle: <input aria-label="Note" onChange={onChange} />,
      accessory: (
        <button type="button" onClick={onGet}>
          Get
        </button>
      ),
    };
    const { rerender } = render(<CardGridCard variant="lockup" aria-disabled="true" {...parts} />);
    await user.click(screen.getByRole("button", { name: "Get" }));
    await user.keyboard("{Enter}");
    expect(onGet).not.toHaveBeenCalled();
    // The card does not disable its content: the field still takes focus and typing. Content
    // that should not is the consumer's to disable, as the docs page says.
    await user.type(screen.getByLabelText("Note"), "a");
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(<CardGridCard variant="lockup" {...parts} />);
    await user.click(screen.getByRole("button", { name: "Get" }));
    expect(onGet).toHaveBeenCalledTimes(1);
  });

  it("places an accessory that works on its own", async () => {
    const user = userEvent.setup();
    const onGet = vi.fn();
    render(
      <CardGridCard
        variant="lockup"
        title="App One"
        subtitle="A short line"
        accessory={
          <button type="button" onClick={onGet}>
            Get
          </button>
        }
      />,
    );
    await user.click(screen.getByRole("button", { name: "Get" }));
    expect(onGet).toHaveBeenCalledTimes(1);
  });

  it("forwards native attributes", () => {
    render(<CardGridCard data-testid="card" id="one" data-kind="show" lang="en" />);
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("id", "one");
    expect(card).toHaveAttribute("data-kind", "show");
    expect(card).toHaveAttribute("lang", "en");
  });
});
