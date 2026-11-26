import { beforeEach, describe, expect, it } from "vitest";
import { changeDesktopValue, desktopValues } from "./desktop-personal";
import {
  asksForSiri,
  boundSiriPlace,
  HOLD_COMMAND_SPACE,
  HOLD_OPTION_SPACE,
  LEFT_COMMAND_TWICE,
  settingAnswer,
  siriListensIn,
  siriSpeaksIn,
} from "./desktop-siri-settings";

describe("Siri's Keyboard Shortcut", () => {
  const press = (keys: Partial<Parameters<typeof asksForSiri>[0]>) => ({
    code: "Space",
    repeat: true,
    metaKey: false,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...keys,
  });

  it("asks when the chosen keys are held, and not at their first press", () => {
    expect(asksForSiri(press({ altKey: true }), HOLD_OPTION_SPACE, false)).toBe(true);
    expect(asksForSiri(press({ altKey: true, repeat: false }), HOLD_OPTION_SPACE, false)).toBe(
      false,
    );
    expect(asksForSiri(press({ metaKey: true }), HOLD_COMMAND_SPACE, false)).toBe(true);
  });

  it("does not take another choice's keys, or the keys with more held", () => {
    expect(asksForSiri(press({ altKey: true }), HOLD_COMMAND_SPACE, false)).toBe(false);
    expect(asksForSiri(press({ metaKey: true }), HOLD_OPTION_SPACE, false)).toBe(false);
    expect(asksForSiri(press({ altKey: true, ctrlKey: true }), HOLD_OPTION_SPACE, false)).toBe(
      false,
    );
    expect(asksForSiri(press({}), "Press Fn (Function) Space", false)).toBe(false);
  });

  it("asks on Left Command's second press only", () => {
    const command = press({ code: "MetaLeft", repeat: false });
    expect(asksForSiri(command, LEFT_COMMAND_TWICE, true)).toBe(true);
    expect(asksForSiri(command, LEFT_COMMAND_TWICE, false)).toBe(false);
    expect(asksForSiri(command, HOLD_COMMAND_SPACE, true)).toBe(false);
  });
});

describe("The settings Siri changes", () => {
  beforeEach(() => {
    changeDesktopValue("sound.outputVolume", 95);
    changeDesktopValue("displays.brightness", 5);
  });

  it("steps a level and stops at its ends", () => {
    expect(settingAnswer("turn up the volume")).toBe("The volume is at 100%.");
    expect(desktopValues()["sound.outputVolume"]).toBe(100);
    expect(settingAnswer("lower the brightness")).toBe("The brightness is at 0%.");
    expect(desktopValues()["displays.brightness"]).toBe(0);
  });

  it("mutes and hides where the panes keep them", () => {
    settingAnswer("mute");
    expect(desktopValues()["sound.mute"]).toBe(true);
    settingAnswer("unmute the sound");
    expect(desktopValues()["sound.mute"]).toBe(false);
    settingAnswer("hide the Dock");
    expect(desktopValues()["dock.autohide"]).toBe(true);
  });

  it("says what a page cannot do, and leaves other requests alone", () => {
    expect(settingAnswer("turn off wifi")).toContain("can’t change your computer’s Wi-Fi");
    expect(settingAnswer("mute Tom in Messages")).toBeNull();
    expect(settingAnswer("what time is it")).toBeNull();
  });
});

describe("Where Siri's window can be", () => {
  const room = { minX: -100, maxX: 0, minY: -8, maxY: 500 };

  it("keeps a place within the screen's room", () => {
    expect(boundSiriPlace({ x: -40, y: 90 }, room)).toEqual({ x: -40, y: 90 });
    expect(boundSiriPlace({ x: -900, y: 900 }, room)).toEqual({ x: -100, y: 500 });
  });

  it("keeps its top left on a screen too small for it", () => {
    expect(boundSiriPlace({ x: 50, y: 50 }, { minX: 10, maxX: -10, minY: 8, maxY: -8 })).toEqual({
      x: 10,
      y: 8,
    });
  });
});

describe("The language Siri uses", () => {
  it("follows the pane, and an English voice's accent", () => {
    expect(siriListensIn("German (Germany)")).toBe("de-DE");
    expect(siriListensIn("Klingon")).toBeUndefined();
    expect(siriSpeaksIn("German (Germany)", "British (Male)")).toBe("de-DE");
    expect(siriSpeaksIn("English (United States)", "British (Male)")).toBe("en-GB");
    expect(siriSpeaksIn(undefined, undefined)).toBeUndefined();
  });
});
