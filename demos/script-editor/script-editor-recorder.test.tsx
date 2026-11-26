import { act, render } from "@testing-library/react";
import {
  useWindowManagerStore,
  WindowManager,
  type WindowManagerStore,
} from "macalicious/window-manager";
import { describe, expect, it, vi } from "vitest";
import { translateAppleScript } from "./script-editor-applescript";
import { DesktopRecorder, recordedLines, withRecorded } from "./script-editor-recorder";

describe("what Record writes", () => {
  it("writes AppleScript the server's translation runs", () => {
    const source = withRecorded(
      withRecorded("", { activate: "Calculator" }, "AppleScript"),
      { dark: true },
      "AppleScript",
    );
    expect(source).toBe(
      'tell application "Calculator"\n\tactivate\nend tell\n' +
        'tell application "System Events"\n\ttell appearance preferences\n\t\tset dark mode to true\n\tend tell\nend tell\n',
    );
    const translated = translateAppleScript(source);
    expect(translated.ok).toBe(true);
    if (translated.ok) {
      expect(translated.code).toContain('Application("Calculator").activate()');
      expect(translated.code).toContain('Appearance.set({ mode: "dark" })');
    }
  });

  it("writes JavaScript in a JavaScript script", () => {
    expect(recordedLines({ activate: "Stickies" }, "JavaScript")).toBe(
      'Application("Stickies").activate();',
    );
    expect(recordedLines({ dark: false }, "JavaScript")).toBe('Appearance.set({ mode: "light" });');
  });

  it("writes the folder Finder shows, in lines each language runs", () => {
    const folder = { folder: '/Users/me/My "Work"' };
    expect(recordedLines(folder, "JavaScript")).toBe(
      'Application("Finder").open("/Users/me/My \\"Work\\"");',
    );
    const source = withRecorded("", folder, "AppleScript");
    expect(source).toBe(
      'tell application "Finder"\n\topen folder "/Users/me/My \\"Work\\""\nend tell\n',
    );
    const translated = translateAppleScript(source);
    expect(translated.ok).toBe(true);
    if (translated.ok) {
      expect(translated.code).toContain('Application("Finder").open("/Users/me/My \\"Work\\"")');
    }
  });

  it("goes on from what the script holds", () => {
    expect(withRecorded("log 1\n\n", { activate: "Mail" }, "AppleScript")).toBe(
      'log 1\ntell application "Mail"\n\tactivate\nend tell\n',
    );
  });
});

describe("DesktopRecorder", () => {
  it("hears another application come forward, not Script Editor, and the appearance", {
    timeout: 90_000,
  }, async () => {
    const heard = vi.fn();
    let store: WindowManagerStore | undefined;
    function Grab() {
      store = useWindowManagerStore();
      return null;
    }
    render(
      <WindowManager>
        <Grab />
        <DesktopRecorder onAction={heard} />
      </WindowManager>,
    );
    const open = (id: string, app: string) =>
      act(() =>
        store?.add(
          {
            id,
            app,
            title: id,
            frame: {},
            panel: false,
            resizable: true,
            minWidth: 100,
            minHeight: 100,
          },
          () => {},
        ),
      );
    open("script-editor", "script-editor");
    open("calculator", "calculator");
    await vi.waitFor(() => expect(heard).toHaveBeenCalledWith({ activate: "Calculator" }), {
      timeout: 60_000,
    });
    act(() => store?.focus("script-editor"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(heard).toHaveBeenCalledTimes(1);
    document.documentElement.setAttribute("data-appearance", "dark");
    await vi.waitFor(() => expect(heard).toHaveBeenLastCalledWith({ dark: true }));
    document.documentElement.removeAttribute("data-appearance");
    await act(async () => {
      await Promise.resolve();
    });
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
