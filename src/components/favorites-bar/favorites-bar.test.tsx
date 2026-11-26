import { Menu } from "@base-ui/react/menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { FavoritesBar, FavoritesBarFolder, FavoritesBarItem, FavoritesBarOverflow } from "./index";

function Bar({ onOpen = () => {} }: { onOpen?: () => void }) {
  return (
    <FavoritesBar aria-label="Favorites">
      <FavoritesBarItem href="https://example.com/">Example</FavoritesBarItem>
      <FavoritesBarItem onClick={onOpen}>Reference</FavoritesBarItem>
      <FavoritesBarFolder>News</FavoritesBarFolder>
    </FavoritesBar>
  );
}

describe("FavoritesBar", () => {
  it("is a named toolbar of links and buttons", () => {
    render(<Bar />);
    const bar = screen.getByRole("toolbar", { name: "Favorites" });
    expect(bar).toHaveClass("mac-favorites-bar");
    expect(bar).toHaveAttribute("aria-orientation", "horizontal");
    expect(screen.getByRole("link", { name: "Example" })).toHaveAttribute(
      "href",
      "https://example.com/",
    );
    expect(screen.getByRole("button", { name: "Reference" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "News" })).toHaveAttribute("aria-haspopup", "menu");
  });

  it("is one tab stop; the arrow keys move between its items and wrap", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Bar />
        <button type="button">After</button>
      </>,
    );
    const link = screen.getByRole("link", { name: "Example" });
    const button = screen.getByRole("button", { name: "Reference" });
    const folder = screen.getByRole("button", { name: "News" });
    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(folder).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(link).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(folder).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("puts the overflow button after the items", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <FavoritesBar
        aria-label="Favorites"
        overflow={<FavoritesBarOverflow aria-label="More favorites" onClick={onClick} />}
      >
        <FavoritesBarItem href="https://example.com/">Example</FavoritesBarItem>
      </FavoritesBar>,
    );
    const more = screen.getByRole("button", { name: "More favorites" });
    expect(more).toHaveClass("mac-favorites-bar-item", "mac-favorites-bar-overflow");
    expect(more).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.getByRole("toolbar").lastElementChild).toBe(more);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(more).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards ref, className and native attributes to the toolbar", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <FavoritesBar ref={ref} aria-label="Favorites" className="extra" id="bar">
        <FavoritesBarItem>Example</FavoritesBarItem>
      </FavoritesBar>,
    );
    expect(ref.current).toBe(screen.getByRole("toolbar"));
    expect(ref.current).toHaveClass("mac-favorites-bar", "extra");
    expect(ref.current).toHaveAttribute("id", "bar");
  });
});

describe("FavoritesBarItem", () => {
  it("is activated by the pointer, Return and Space when it is a button", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Bar onOpen={onOpen} />);
    const button = screen.getByRole("button", { name: "Reference" });
    await user.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it("passes target and rel to the link", () => {
    render(
      <FavoritesBar aria-label="Favorites">
        <FavoritesBarItem href="https://example.com/" target="_blank" rel="noreferrer">
          Example
        </FavoritesBarItem>
      </FavoritesBar>,
    );
    const link = screen.getByRole("link", { name: "Example" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("does nothing while disabled, and is a button even with an address", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <FavoritesBar aria-label="Favorites">
        <FavoritesBarItem href="https://example.com/" disabled onClick={onClick}>
          Example
        </FavoritesBarItem>
      </FavoritesBar>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Example" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("data-disabled");
    await user.click(button);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows an icon that assistive technology does not read", () => {
    render(
      <FavoritesBar aria-label="Favorites">
        <FavoritesBarItem href="https://example.com/" icon={<svg data-testid="icon" />}>
          Example
        </FavoritesBarItem>
        <FavoritesBarItem aria-label="Weather" icon={<svg />} />
      </FavoritesBar>,
    );
    expect(screen.getByRole("link", { name: "Example" })).toBeInTheDocument();
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Weather" })).toBeInTheDocument();
  });

  it("forwards ref and className, in both forms, and keeps render working", () => {
    const linkRef = createRef<HTMLElement>();
    const buttonRef = createRef<HTMLElement>();
    render(
      <FavoritesBar aria-label="Favorites">
        <FavoritesBarItem ref={linkRef} href="https://example.com/" className="extra" id="a">
          Example
        </FavoritesBarItem>
        <FavoritesBarItem
          ref={buttonRef}
          className={(state) => (state.disabled ? "off" : "on")}
          render={<span data-rendered="" />}
          nativeButton={false}
        >
          Reference
        </FavoritesBarItem>
      </FavoritesBar>,
    );
    expect(linkRef.current).toBe(screen.getByRole("link", { name: "Example" }));
    expect(linkRef.current).toHaveClass("mac-favorites-bar-item", "extra");
    expect(linkRef.current).toHaveAttribute("id", "a");
    const rendered = screen.getByRole("button", { name: "Reference" });
    expect(buttonRef.current).toBe(rendered);
    expect(rendered.tagName).toBe("SPAN");
    expect(rendered).toHaveAttribute("data-rendered");
    expect(rendered).toHaveClass("mac-favorites-bar-item", "on");
  });
});

describe("FavoritesBarFolder", () => {
  it("is a button with a chevron that announces a menu", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = createRef<HTMLElement>();
    render(
      <FavoritesBar aria-label="Favorites">
        <FavoritesBarFolder ref={ref} className="extra" onClick={onClick}>
          News
        </FavoritesBarFolder>
      </FavoritesBar>,
    );
    const folder = screen.getByRole("button", { name: "News" });
    expect(folder).toBe(ref.current);
    expect(folder).toHaveClass("mac-favorites-bar-item", "extra");
    expect(folder).toHaveAttribute("aria-haspopup", "menu");
    expect(folder.lastElementChild).toHaveClass("mac-favorites-bar-chevron");
    expect(folder.lastElementChild).toHaveAttribute("aria-hidden", "true");
    await user.click(folder);
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("opens a menu attached through render, from the pointer and the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <FavoritesBar aria-label="Favorites">
        <Menu.Root>
          <FavoritesBarFolder render={<Menu.Trigger />}>News</FavoritesBarFolder>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>World</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </FavoritesBar>,
    );
    const folder = screen.getByRole("button", { name: "News" });
    expect(folder).toHaveClass("mac-favorites-bar-item");
    expect(folder).toHaveAttribute("aria-haspopup", "menu");
    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(folder);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "World" })).toBeInTheDocument();
    expect(folder).toHaveAttribute("aria-expanded", "true");
    // The attribute the pressed look is drawn from while the menu is open.
    expect(folder).toHaveAttribute("data-popup-open");

    await user.keyboard("{Escape}");
    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(folder).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(folder).toHaveAttribute("aria-expanded", "true");
  });

  it("does nothing while disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <FavoritesBar aria-label="Favorites">
        <FavoritesBarFolder disabled onClick={onClick}>
          News
        </FavoritesBarFolder>
      </FavoritesBar>,
    );
    const folder = screen.getByRole("button", { name: "News" });
    expect(folder).toHaveAttribute("aria-disabled", "true");
    await user.click(folder);
    expect(onClick).not.toHaveBeenCalled();
  });
});
