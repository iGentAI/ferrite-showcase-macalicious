import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { describe, expect, it } from "vitest";
import { CatalinaDesktop } from "./desktop";
import type { DesktopApp } from "./desktop-apps";

/*
 * Every item the desktop dims in an application's menus says why, where the person sees it and where assistive
 * technology reads it: the item names its reason as its description (`aria-describedby`). A reason that is one item's is
 * the dimmed row right under it (class mac-desktop-shell-menu-reason); a reason a group shares (the Edit placeholders,
 * Back and Forward) is shown once in the group's row, and each item of the group carries it as its own description.
 */

function double(name: string): DesktopApp {
  function Double({
    onClose,
    onMinimize,
    onZoom,
    zoomRole,
    minimizeDisabled,
    zoomDisabled,
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
    ...windowProps
  }: ManagedWindowRenderProps) {
    return (
      <Window {...windowProps}>
        <TitleBar
          title={name}
          controls={
            <WindowControls
              onClose={onClose}
              onMinimize={onMinimize}
              onZoom={onZoom}
              zoomRole={zoomRole}
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
            />
          }
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        />
        <WindowBody>
          <button type="button">{name} button</button>
        </WindowBody>
      </Window>
    );
  }
  return {
    id: name.toLowerCase(),
    name,
    component: Double,
    defaultSize: { width: 400, height: 300 },
    minSize: { width: 200, height: 120 },
    menus: [name, "File", "Edit", "View", "Go", "Window", "Help"],
  };
}

/** The reason an item names as its description, or null. */
function reasonOf(item: HTMLElement): string | null {
  const ids = item.getAttribute("aria-describedby");
  if (!ids) return null;
  const text = ids
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();
  return text || null;
}

const item = (name: string) => screen.getByRole("menuitem", { name });

async function openMenu(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.keyboard("{Escape}{Escape}");
  await user.click(screen.getByRole("menuitem", { name: title }));
  await screen.findAllByRole("menu");
}

describe("the items the desktop dims in an application's menus", () => {
  it("say why in the application menu: Preferences, Services, Hide Others and Show All", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<CatalinaDesktop apps={[double("Alpha")]} defaultOpen={["alpha"]} />);
    await user.click(screen.getByRole("button", { name: "Alpha button" }));
    await openMenu(user, "Alpha");
    const reasons = {
      "Preferences…": "Alpha has no preferences",
      "Hide Others": "No other application has a window shown",
      "Show All": "No window is hidden",
    };
    for (const [name, reason] of Object.entries(reasons)) {
      const dimmed = item(name);
      expect(dimmed, name).toHaveAttribute("aria-disabled", "true");
      // The reason is the dimmed row right under the item, where the person reads it.
      const next = dimmed.nextElementSibling as HTMLElement;
      expect(reasonOf(dimmed), name).toBe(reason);
      // And its tooltip says it.
      expect(dimmed, name).toHaveAttribute("title", reason);
      expect(next.className, name).toMatch(/mac-desktop-shell-menu-reason/);
      expect(next.textContent, name).toBe(reason);
      expect(next, name).toHaveAttribute("aria-disabled", "true");
    }
    await user.hover(item("Services"));
    const none = await screen.findByRole("menuitem", { name: "No Services Apply" });
    expect(none).toHaveAttribute("aria-disabled", "true");
    expect(reasonOf(none)).toBe("Select some text to use a service");
  });

  it("enable Hide Others and Show All, with no reason row, once they have something to do", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <CatalinaDesktop apps={[double("Alpha"), double("Beta")]} defaultOpen={["alpha", "beta"]} />,
    );
    await user.click(screen.getByRole("button", { name: "Beta button" }));
    await openMenu(user, "Beta");
    expect(item("Hide Others")).not.toHaveAttribute("aria-disabled", "true");
    expect(reasonOf(item("Hide Others"))).toBeNull();
    // Hide Others: Alpha's window goes to the Dock, so Show All has a window to bring back.
    fireEvent.click(item("Hide Others"));
    await openMenu(user, "Beta");
    expect(item("Show All")).not.toHaveAttribute("aria-disabled", "true");
    expect(reasonOf(item("Show All"))).toBeNull();
    expect(screen.queryByText("No window is hidden")).toBeNull();
  });

  it("say why in the Edit and Go menus: each placeholder carries its group's reason, under its own name", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<CatalinaDesktop apps={[double("Alpha")]} defaultOpen={["alpha"]} />);
    await user.click(screen.getByRole("button", { name: "Alpha button" }));
    await openMenu(user, "Edit");
    expect(document.querySelector(".mac-desktop-shell-menu-reason")?.textContent).toBe(
      "Alpha adds no Edit commands",
    );
    for (const name of ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"]) {
      const dimmed = item(name);
      expect(dimmed, name).toHaveAttribute("aria-disabled", "true");
      expect(reasonOf(dimmed), name).toBe("Alpha adds no Edit commands");
      // The reason is the item's own text too, as a census reads a dimmed item (its text holds why).
      expect(dimmed.textContent, name).toContain("Alpha adds no Edit commands");
    }
    await openMenu(user, "Go");
    for (const name of ["Back", "Forward"]) {
      expect(reasonOf(item(name)), name).toBe("Alpha has no Back or Forward");
    }
  });
});
