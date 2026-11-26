import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "./desktop-app-menus";
import { DESKTOP_EFFECTS_EVENT } from "./desktop-effects";
import { useMainWindowItem } from "./desktop-main-window";

function Fixture({ shortcut }: { shortcut: boolean }) {
  const [within, setWithin] = useState<Element | null>(null);
  useMainWindowItem("messages", "Messages", within, undefined, shortcut);
  const rows = useDesktopAppMenuItems("messages", "Window");
  return (
    <>
      <div data-window-id="messages">
        <div data-window-state="key">
          <button ref={setWithin} type="button">
            Window body
          </button>
        </div>
      </div>
      <Menu>
        <MenuTrigger>Window</MenuTrigger>
        <MenuPopup>{rows}</MenuPopup>
      </Menu>
    </>
  );
}

describe("main window menu shortcut", () => {
  it("keeps the Messages row clickable without advertising the opted-out shortcut", async () => {
    const user = userEvent.setup();
    const effects = vi.fn();
    window.addEventListener(DESKTOP_EFFECTS_EVENT, effects);
    try {
      render(<Fixture shortcut={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Window" }));
      const item = await screen.findByRole("menuitem", { name: "Messages" });
      expect(item).not.toHaveAttribute("aria-keyshortcuts");
      await user.click(item);
      expect(effects).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(DESKTOP_EFFECTS_EVENT, effects);
    }
  });
  it("keeps the default Command-0 shortcut for other callers", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const effects = vi.fn();
    window.addEventListener(DESKTOP_EFFECTS_EVENT, effects);
    try {
      render(<Fixture shortcut />);
      fireEvent.keyDown(screen.getByRole("button", { name: "Window body" }), {
        key: "0",
        metaKey: true,
      });
      expect(effects).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(DESKTOP_EFFECTS_EVENT, effects);
    }
  });
});
