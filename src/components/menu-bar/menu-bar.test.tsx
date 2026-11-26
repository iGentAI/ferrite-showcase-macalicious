import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { MenuBarExtra, MenuBarExtras } from "../menu-bar-extra";
import { MenuItem } from "../menu-item";
import { MenuBar, MenuBarMenu, type MenuBarProps } from "./index";

function FinderBar({ onNew = () => {}, ...bar }: { onNew?: () => void } & MenuBarProps) {
  return (
    <MenuBar {...bar}>
      <MenuBarMenu title={<svg aria-hidden="true" />} aria-label="Apple">
        <MenuItem>About This Mac</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Finder" application>
        <MenuItem>About Finder</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="File" popup={{ className: "file-menu" }}>
        <MenuItem onClick={onNew}>New Finder Window</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Edit" disabled>
        <MenuItem>Undo</MenuItem>
      </MenuBarMenu>
    </MenuBar>
  );
}

const title = (name: string) => screen.getByRole("menuitem", { name });

describe("MenuBar", () => {
  it("is a strip that holds a menubar of titles, with the application's name marked", () => {
    const ref = createRef<HTMLDivElement>();
    render(<FinderBar ref={ref} className="extra" data-testid="bar" aria-label="Finder menus" />);
    const strip = screen.getByTestId("bar");
    expect(ref.current).toBe(strip);
    expect(strip).toHaveClass("mac-menu-bar", "extra");
    const menubar = screen.getByRole("menubar", { name: "Finder menus" });
    expect(menubar).toHaveClass("mac-menu-bar-menus");
    expect(menubar.parentElement).toBe(strip);

    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
    expect(title("Apple")).toHaveClass("mac-menu-bar-title");
    expect(title("File")).toHaveAttribute("aria-haspopup", "menu");
    expect(title("Finder")).toHaveAttribute("data-application");
    expect(title("File")).not.toHaveAttribute("data-application");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens a menu attached under its title, and chooses an item", async () => {
    const user = userEvent.setup();
    const onNew = vi.fn();
    render(<FinderBar onNew={onNew} />);
    await user.click(title("File"));
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("mac-menu", "file-menu");
    expect(menu).toHaveAttribute("data-attached");
    expect(title("File")).toHaveAttribute("aria-expanded", "true");
    expect(title("File")).toHaveAttribute("data-popup-open");

    await user.click(screen.getByRole("menuitem", { name: "New Finder Window" }));
    expect(onNew).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  // Switching menus by moving the pointer along the bar needs real mouse events: it is checked
  // in a browser (menu-bar.visual.json, hover-switch).

  it("moves between titles with Left and Right Arrow and opens with Down Arrow", async () => {
    const user = userEvent.setup();
    render(<FinderBar />);
    await user.tab();
    expect(title("Apple")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(title("Finder")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(title("File")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(title("Finder")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(await screen.findByRole("menuitem", { name: "About Finder" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(title("Finder")).toHaveFocus());
  });

  it("dims the title of a disabled menu, which does not open", async () => {
    const user = userEvent.setup();
    render(<FinderBar />);
    expect(title("Edit")).toHaveAttribute("data-disabled");
    await user.click(title("Edit"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders the extras after the titles, outside their menubar", () => {
    render(<FinderBar data-testid="bar" extras={<div data-testid="extras" />} />);
    const extras = screen.getByTestId("extras");
    expect(extras.parentElement).toBe(screen.getByTestId("bar"));
    expect(extras.previousElementSibling).toBe(screen.getByRole("menubar"));
  });

  it("leaves out the titles and extras a narrow screen has no room for, and brings them back", async () => {
    // jsdom lays nothing out: each cell is given the box a 390-point phone draws it at.
    const widths: Record<string, number> = {
      Apple: 35,
      Finder: 62,
      File: 40,
      Edit: 41,
      Wi: 30,
      Clock: 46,
    };
    let screenWidth = 160;
    const restore = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const box = (left: number, width: number) => new DOMRect(left, 0, width, 22);
        if (this.classList.contains("mac-menu-bar")) return box(0, screenWidth);
        const name = this.getAttribute("aria-label") ?? this.textContent ?? "";
        const titles = ["Apple", "Finder", "File", "Edit"];
        if (titles.includes(name)) {
          const before = titles
            .slice(0, titles.indexOf(name))
            .reduce((sum, t) => sum + (widths[t] ?? 0), 10);
          return box(before, widths[name] ?? 0);
        }
        if (this.classList.contains("mac-menu-bar-extra-group")) {
          const menusEnd = titles
            .filter((t) => !screen.getByRole("menuitem", { name: t }).hasAttribute("data-overflow"))
            .reduce((sum, t) => sum + (widths[t] ?? 0), 10);
          return box(menusEnd, Math.max(0, screenWidth - menusEnd));
        }
        // Extras sit against the bar's trailing edge: Clock last, Wi-Fi before it.
        if (name === "Clock") return box(screenWidth - 46, 46);
        if (name === "Wi") return box(screenWidth - 76, 30);
        return box(0, 0);
      });
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private readonly targets: Element[] = [];
        constructor(call: (entries: { target: Element }[]) => void) {
          observers.push(() => call(this.targets.map((target) => ({ target }))));
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    // Run at once; 0 is "no frame pending", which is what is true once it has run.
    vi.stubGlobal("requestAnimationFrame", (run: () => void) => {
      run();
      return 0;
    });
    const resize = () => {
      for (const call of observers) call();
    };
    try {
      render(
        <FinderBar
          extras={
            <MenuBarExtras>
              <MenuBarExtra aria-label="Wi">Wi</MenuBarExtra>
              <MenuBarExtra aria-label="Clock">Clock</MenuBarExtra>
            </MenuBarExtras>
          }
        />,
      );
      resize();
      const left = (name: string) =>
        screen.getByRole("menuitem", { name }).hasAttribute("data-overflow");
      // 160 points: Apple and Finder end at 107, File at 147, Edit at 188. Edit goes; the extras group starts at 147, so
      // Wi-Fi (84..114) and the clock (114..160) are cut off from its leading side and go too.
      expect(["Apple", "Finder", "File", "Edit"].map(left)).toEqual([false, false, false, true]);
      expect(["Wi", "Clock"].map(left)).toEqual([true, true]);
      // A wide screen has room for everything again.
      screenWidth = 1440;
      resize();
      expect(["Apple", "Finder", "File", "Edit", "Wi", "Clock"].map(left)).toEqual([
        false,
        false,
        false,
        false,
        false,
        false,
      ]);
    } finally {
      restore.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("leaves out a title that would run under an extra still drawn", () => {
    // A group that does not clip (it starts at 90, inside the titles) with Wi-Fi drawn at 120..150: File (107..147)
    // and Edit (147..188) would run under it on a 200-point screen.
    const widths: Record<string, number> = { Apple: 35, Finder: 62, File: 40, Edit: 41 };
    const restore = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const box = (left: number, width: number) => new DOMRect(left, 0, width, 22);
        if (this.classList.contains("mac-menu-bar")) return box(0, 200);
        if (this.classList.contains("mac-menu-bar-extra-group")) return box(90, 110);
        const name = this.getAttribute("aria-label") ?? this.textContent ?? "";
        if (name === "Wi") return box(120, 30);
        if (name === "Clock") return box(150, 46);
        const titles = ["Apple", "Finder", "File", "Edit"];
        const before = titles
          .slice(0, titles.indexOf(name))
          .reduce((sum, t) => sum + (widths[t] ?? 0), 10);
        return box(before, widths[name] ?? 0);
      });
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private readonly targets: Element[] = [];
        constructor(call: (entries: { target: Element }[]) => void) {
          observers.push(() => call(this.targets.map((target) => ({ target }))));
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (run: () => void) => {
      run();
      return 0;
    });
    try {
      render(
        <FinderBar
          extras={
            <MenuBarExtras>
              <MenuBarExtra aria-label="Wi">Wi</MenuBarExtra>
              <MenuBarExtra aria-label="Clock">Clock</MenuBarExtra>
            </MenuBarExtras>
          }
        />,
      );
      for (const call of observers) call();
      const left = (name: string) =>
        screen.getByRole("menuitem", { name }).hasAttribute("data-overflow");
      expect(["Apple", "Finder", "File", "Edit", "Wi", "Clock"].map(left)).toEqual([
        false,
        false,
        true,
        true,
        false,
        false,
      ]);
    } finally {
      restore.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
