import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalinaDesktop } from "./desktop";
import {
  changeDesktopValue,
  connectDesktopValues,
  desktopValues,
  forgetDesktopValues,
} from "./desktop-personal";
import { DESKTOP_SPACES } from "./desktop-spaces";

const WINDOW_KEYS: readonly (readonly [string, KeyboardEventInit])[] = [
  ["Spaces, by arrow", { key: "ArrowLeft", ctrlKey: true }],
  ["Spaces, by number", { code: "Digit1", ctrlKey: true, altKey: true }],
  ["Spotlight", { code: "Space", ctrlKey: true, altKey: true }],
  ["Mission Control", { key: "F3" }],
  ["Mission Control, by arrow", { key: "ArrowUp", ctrlKey: true }],
  ["App Exposé", { key: "ArrowDown", ctrlKey: true }],
  ["Show Desktop", { code: "KeyD", ctrlKey: true, altKey: true }],
  ["the switcher", { key: "Tab", altKey: true }],
];

describe("the window keys of a desktop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("embedded in a page", () => {
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        left: 10,
        top: 10,
        right: 200,
        bottom: 200,
      } as DOMRect);
    });

    it.each(WINDOW_KEYS)("leaves %s pressed outside it to the page", (_name, init) => {
      render(
        <>
          <button type="button">Outside</button>
          <CatalinaDesktop apps={[]} />
        </>,
      );
      expect(fireEvent.keyDown(screen.getByRole("button", { name: "Outside" }), init)).toBe(true);
      expect(fireEvent.keyDown(document.body, init)).toBe(true);
    });

    it.each(WINDOW_KEYS)("takes %s pressed on it", (_name, init) => {
      render(<CatalinaDesktop apps={[]} />);
      expect(fireEvent.keyDown(screen.getByRole("group", { name: "Desktop" }), init)).toBe(false);
    });

    it("lets an application in front have Control with an arrow first, off a Mac, where it is Command", () => {
      render(<CatalinaDesktop apps={[]} />);
      const desktop = screen.getByRole("group", { name: "Desktop" });
      const reached = vi.fn();
      desktop.addEventListener("keydown", reached);
      fireEvent.keyDown(desktop, { key: "ArrowRight", ctrlKey: true });
      desktop.removeEventListener("keydown", reached);
      expect(reached).toHaveBeenCalledTimes(1);
    });

    it("lets a listener on the window, added after the desktop opened, claim it first too", () => {
      render(<CatalinaDesktop apps={[]} />);
      const desktop = screen.getByRole("group", { name: "Desktop" });
      for (const init of [
        { key: "ArrowRight", ctrlKey: true },
        // Off a Mac, Mail's Flag keys.
        { code: "Digit1", ctrlKey: true, altKey: true },
      ]) {
        let taken: boolean | undefined;
        const claim = (event: Event) => {
          taken = event.defaultPrevented;
          event.preventDefault();
        };
        window.addEventListener("keydown", claim);
        fireEvent.keyDown(desktop, init);
        window.removeEventListener("keydown", claim);
        expect(taken).toBe(false);
      }
    });

    it("leaves a mouse button pressed outside it to the page, and takes one pressed on it", () => {
      connectDesktopValues(() => undefined);
      changeDesktopValue("mission-control.missionControlMouse", "Mouse Button 4");
      render(
        <>
          <button type="button">Outside</button>
          <CatalinaDesktop apps={[]} />
        </>,
      );
      const press = { button: 3 };
      expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }), press)).toBe(
        true,
      );
      expect(fireEvent.mouseDown(screen.getByRole("group", { name: "Desktop" }), press)).toBe(
        false,
      );
      forgetDesktopValues();
    });

    it("answers a key only on the desktop it was pressed on", () => {
      render(
        <>
          <div data-testid="one">
            <CatalinaDesktop apps={[]} />
          </div>
          <div data-testid="two">
            <CatalinaDesktop apps={[]} />
          </div>
        </>,
      );
      const [first] = screen.getAllByRole("group", { name: "Desktop" });
      fireEvent.keyDown(first as HTMLElement, { key: "F3" });
      expect(screen.getByTestId("one").querySelector("[data-mission-control-open]")).not.toBeNull();
      expect(screen.getByTestId("two").querySelector("[data-mission-control-open]")).toBeNull();
    });
  });

  it("lets a Mac application claim Control-number before Spaces, with unclaimed keys falling back", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const disconnect = connectDesktopValues(() => undefined);
    try {
      changeDesktopValue(DESKTOP_SPACES, {
        spaces: ["1", "2", "3", "4"],
        current: "1",
        windows: {},
        next: 5,
      });
      render(<CatalinaDesktop apps={[]} />);
      const desk = screen.getByRole("group", { name: "Desktop" });
      const claim = vi.fn((event: Event) => event.preventDefault());
      desk.addEventListener("keydown", claim);
      const key = { key: "4", code: "Digit4", ctrlKey: true };
      expect(fireEvent.keyDown(desk, key)).toBe(false);
      expect(claim).toHaveBeenCalledTimes(1);
      expect(desktopValues()[DESKTOP_SPACES]).toMatchObject({ current: "1" });
      desk.removeEventListener("keydown", claim);
      // With no application claiming the key, the original Space shortcut still runs.
      expect(fireEvent.keyDown(desk, key)).toBe(false);
      expect(desktopValues()[DESKTOP_SPACES]).toMatchObject({ current: "4" });
      // Control-Option-number remains the desktop's explicit shortcut on a Mac.
      claim.mockClear();
      desk.addEventListener("keydown", claim);
      expect(fireEvent.keyDown(desk, { ...key, altKey: true })).toBe(false);
      expect(claim).not.toHaveBeenCalled();
      desk.removeEventListener("keydown", claim);
    } finally {
      disconnect();
      forgetDesktopValues();
    }
  });

  it("answers the shortcut chosen in System Preferences, not the one it replaced", () => {
    const disconnect = connectDesktopValues(() => undefined);
    try {
      changeDesktopValue("mission-control.missionControl", "F6");
      changeDesktopValue("mission-control.applicationWindows", "–");
      render(<CatalinaDesktop apps={[]} />);
      const desk = screen.getByRole("group", { name: "Desktop" });
      expect(fireEvent.keyDown(desk, { key: "ArrowUp", ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(desk, { key: "ArrowDown", ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(desk, { key: "F6" })).toBe(false);
      expect(fireEvent.keyDown(desk, { key: "F6", shiftKey: true })).toBe(true);
      // F3 is the one that works in every browser, whatever is chosen.
      expect(fireEvent.keyDown(desk, { key: "F3" })).toBe(false);
    } finally {
      disconnect();
      forgetDesktopValues();
    }
  });

  it("answers a shortcut with modifiers, and only with them", () => {
    const disconnect = connectDesktopValues(() => undefined);
    try {
      changeDesktopValue("mission-control.missionControl", "⇧F6");
      render(<CatalinaDesktop apps={[]} />);
      const desk = screen.getByRole("group", { name: "Desktop" });
      expect(fireEvent.keyDown(desk, { key: "F6" })).toBe(true);
      expect(fireEvent.keyDown(desk, { key: "F6", shiftKey: true, altKey: true })).toBe(true);
      expect(fireEvent.keyDown(desk, { key: "F6", shiftKey: true })).toBe(false);
    } finally {
      disconnect();
      forgetDesktopValues();
    }
  });

  it("keeps F3 for Mission Control, and F11 for a browser elsewhere than on a Mac", () => {
    const disconnect = connectDesktopValues(() => undefined);
    try {
      changeDesktopValue("mission-control.showDesktop", "F3");
      changeDesktopValue("mission-control.missionControl", "F11");
      changeDesktopValue("mission-control.applicationWindows", "F11");
      render(<CatalinaDesktop apps={[]} />);
      const desk = screen.getByRole("group", { name: "Desktop" });
      expect(navigator.platform).not.toMatch(/Mac/);
      expect(fireEvent.keyDown(desk, { key: "F11" })).toBe(true);
      fireEvent.keyDown(desk, { key: "F3" });
      expect(document.querySelector("[data-mission-control-open]")).not.toBeNull();
    } finally {
      disconnect();
      forgetDesktopValues();
    }
  });

  it("takes a key pressed with the focus nowhere on a desktop that fills the page", () => {
    render(<CatalinaDesktop apps={[]} />);
    expect(fireEvent.keyDown(document.body, { key: "F3" })).toBe(false);
  });
});
