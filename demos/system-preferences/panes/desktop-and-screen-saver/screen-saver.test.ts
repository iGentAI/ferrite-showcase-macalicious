import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearScreenSaver,
  DISPLAY_SLEEP_KEY,
  followScreenSaver,
  PASSWORD_DELAY_KEY,
  previewScreenSaver,
  REQUIRE_PASSWORD_KEY,
  registerLockScreen,
  SAVER_AFTER_KEY,
  SAVER_CLOCK_KEY,
} from "./screen-saver";

const layer = () => document.querySelector(".mac-system-preferences-screen-saver");

describe("the screen saver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    clearScreenSaver();
    vi.useRealTimers();
  });

  it("starts after the chosen minutes with no input, and input puts the count back", () => {
    followScreenSaver({ [SAVER_AFTER_KEY]: 1 });
    vi.advanceTimersByTime(59_000);
    expect(layer()).toBeNull();
    window.dispatchEvent(new Event("pointermove"));
    vi.advanceTimersByTime(59_000);
    expect(layer()).toBeNull();
    vi.advanceTimersByTime(1_000);
    expect(layer()).not.toBeNull();
  });

  it("keeps counting while the settings change for another reason", () => {
    followScreenSaver({ [SAVER_AFTER_KEY]: 1 });
    vi.advanceTimersByTime(40_000);
    followScreenSaver({ [SAVER_AFTER_KEY]: 1, "screen-time.usage": {} });
    vi.advanceTimersByTime(20_000);
    expect(layer()).not.toBeNull();
  });

  it("never starts by itself on Never", () => {
    followScreenSaver({ [SAVER_AFTER_KEY]: 0 });
    vi.advanceTimersByTime(3_600_000);
    expect(layer()).toBeNull();
  });

  it("waits while a video plays", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "paused", { value: false });
    document.body.append(video);
    followScreenSaver({ [SAVER_AFTER_KEY]: 1 });
    vi.advanceTimersByTime(120_000);
    expect(layer()).toBeNull();
    video.remove();
    vi.advanceTimersByTime(60_000);
    expect(layer()).not.toBeNull();
  });

  it("shows the time when asked, waits for the hand to rest in a Preview, and goes on input", () => {
    followScreenSaver({ [SAVER_CLOCK_KEY]: true });
    previewScreenSaver();
    expect(layer()?.textContent).toMatch(/\d:\d\d/);
    window.dispatchEvent(new Event("pointermove"));
    expect(layer()).not.toBeNull();
    vi.advanceTimersByTime(600);
    const key = new KeyboardEvent("keydown", { key: "a", cancelable: true });
    window.dispatchEvent(key);
    expect(layer()).toBeNull();
    expect(key.defaultPrevented).toBe(true);
  });

  it("started by itself, the first key goes at once and reaches nothing", () => {
    followScreenSaver({ [SAVER_AFTER_KEY]: 1 });
    vi.advanceTimersByTime(60_000);
    expect(layer()).not.toBeNull();
    const key = new KeyboardEvent("keydown", { key: "a", cancelable: true });
    window.dispatchEvent(key);
    expect(layer()).toBeNull();
    expect(key.defaultPrevented).toBe(true);
  });

  it("the press that takes it away does not click what is under it", () => {
    previewScreenSaver();
    vi.advanceTimersByTime(600);
    window.dispatchEvent(new Event("pointerdown", { cancelable: true }));
    expect(layer()).toBeNull();
    window.dispatchEvent(new Event("pointerup", { cancelable: true }));
    const click = new Event("click", { cancelable: true });
    window.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    const menu = new Event("contextmenu", { cancelable: true });
    window.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    window.dispatchEvent(new Event("pointerdown", { cancelable: true }));
    const next = new Event("click", { cancelable: true });
    window.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(false);
  });

  it("the rest of the gesture reaches nothing, and the next input does", () => {
    const heard: string[] = [];
    const hear = (event: Event) => heard.push(event.type);
    for (const name of ["keydown", "keyup", "pointerup", "click"])
      window.addEventListener(name, hear);
    previewScreenSaver();
    vi.advanceTimersByTime(600);
    window.dispatchEvent(new Event("keydown", { cancelable: true }));
    window.dispatchEvent(new Event("keyup", { cancelable: true }));
    expect(heard).toEqual([]);
    window.dispatchEvent(new Event("keydown", { cancelable: true }));
    expect(heard).toEqual(["keydown"]);
    heard.length = 0;

    previewScreenSaver();
    vi.advanceTimersByTime(600);
    window.dispatchEvent(new Event("pointerdown", { cancelable: true }));
    window.dispatchEvent(new Event("pointerup", { cancelable: true }));
    window.dispatchEvent(new Event("click", { cancelable: true }));
    expect(heard).toEqual([]);
    window.dispatchEvent(new Event("pointerdown", { cancelable: true }));
    window.dispatchEvent(new Event("click", { cancelable: true }));
    expect(heard).toEqual(["click"]);
    for (const name of ["keydown", "keyup", "pointerup", "click"])
      window.removeEventListener(name, hear);
  });

  it("a key held long keeps its repeats and release to itself, and other keys go through", () => {
    const heard: string[] = [];
    const hear = (event: Event) => heard.push(`${event.type} ${(event as KeyboardEvent).code}`);
    const press = (type: string, code: string, repeat = false) =>
      window.dispatchEvent(new KeyboardEvent(type, { code, repeat, cancelable: true }));
    window.addEventListener("keydown", hear);
    window.addEventListener("keyup", hear);
    previewScreenSaver();
    vi.advanceTimersByTime(600);
    press("keydown", "KeyA");
    vi.advanceTimersByTime(5_000);
    press("keydown", "KeyA", true);
    press("keydown", "KeyB");
    press("keyup", "KeyB");
    press("keyup", "KeyA");
    expect(heard).toEqual(["keydown KeyB", "keyup KeyB"]);
    press("keydown", "KeyA");
    expect(heard).toEqual(["keydown KeyB", "keyup KeyB", "keydown KeyA"]);
    window.removeEventListener("keydown", hear);
    window.removeEventListener("keyup", hear);
  });

  it("a press held long still keeps its release and click, and no later click is eaten", () => {
    previewScreenSaver();
    vi.advanceTimersByTime(600);
    window.dispatchEvent(new Event("pointerdown", { cancelable: true }));
    vi.advanceTimersByTime(5_000);
    const release = new Event("pointerup", { cancelable: true });
    window.dispatchEvent(release);
    expect(release.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(400);
    const later = new Event("click", { cancelable: true });
    window.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it("a second dismissal keeps its own press when the first one's time runs out", () => {
    const press = (type: string) => {
      const event = new Event(type, { cancelable: true });
      window.dispatchEvent(event);
      return event;
    };
    previewScreenSaver();
    vi.advanceTimersByTime(600);
    press("pointerdown");
    press("pointerup");
    previewScreenSaver();
    vi.advanceTimersByTime(0);
    press("pointerdown");
    vi.advanceTimersByTime(1_000);
    expect(press("pointerup").defaultPrevented).toBe(true);
    expect(press("click").defaultPrevented).toBe(true);
    press("pointerdown");
    expect(press("click").defaultPrevented).toBe(false);
  });

  it("the display sleeps after its own time, over a screen saver and without its clock", () => {
    followScreenSaver({
      [SAVER_AFTER_KEY]: 1,
      [SAVER_CLOCK_KEY]: true,
      [DISPLAY_SLEEP_KEY]: 2,
    });
    vi.advanceTimersByTime(60_000);
    expect(layer()?.textContent).toMatch(/\d:\d\d/);
    vi.advanceTimersByTime(60_000);
    expect(layer()?.textContent).toBe("");
    window.dispatchEvent(new Event("keydown", { cancelable: true }));
    expect(layer()).toBeNull();
  });

  it("asks for the password on a late wake even when its timer has not run", () => {
    const lock = vi.fn();
    const unregister = registerLockScreen(lock);
    followScreenSaver({
      [SAVER_AFTER_KEY]: 1,
      [REQUIRE_PASSWORD_KEY]: true,
      [PASSWORD_DELAY_KEY]: "1 minute",
    });
    vi.advanceTimersByTime(60_000);
    expect(layer()).not.toBeNull();
    // The clock moves on while the tab sleeps; no timer has fired.
    vi.setSystemTime(Date.now() + 120_000);
    expect(lock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("keydown", { cancelable: true }));
    expect(lock).toHaveBeenCalledTimes(1);
    expect(layer()).toBeNull();
    window.dispatchEvent(new Event("keyup", { cancelable: true }));
    unregister();
  });

  it("asks for the password once its time has passed, and not in a Preview or on an early wake", () => {
    const lock = vi.fn();
    const unregister = registerLockScreen(lock);
    followScreenSaver({
      [SAVER_AFTER_KEY]: 1,
      [REQUIRE_PASSWORD_KEY]: true,
      [PASSWORD_DELAY_KEY]: "5 seconds",
    });
    previewScreenSaver();
    vi.advanceTimersByTime(10_000);
    expect(lock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("keydown", { cancelable: true }));
    window.dispatchEvent(new Event("keyup", { cancelable: true }));

    vi.advanceTimersByTime(60_000);
    expect(layer()).not.toBeNull();
    vi.advanceTimersByTime(4_000);
    window.dispatchEvent(new Event("keydown", { cancelable: true }));
    window.dispatchEvent(new Event("keyup", { cancelable: true }));
    vi.advanceTimersByTime(2_000);
    expect(lock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(58_000);
    vi.advanceTimersByTime(5_000);
    expect(lock).toHaveBeenCalledTimes(1);

    followScreenSaver({ [SAVER_AFTER_KEY]: 1, [REQUIRE_PASSWORD_KEY]: false });
    window.dispatchEvent(new Event("keydown", { cancelable: true }));
    window.dispatchEvent(new Event("keyup", { cancelable: true }));
    vi.advanceTimersByTime(600_000);
    expect(lock).toHaveBeenCalledTimes(1);
    unregister();
  });

  it("a wheel takes it away and does not scroll", () => {
    previewScreenSaver();
    const wheel = new Event("wheel", { cancelable: true });
    window.dispatchEvent(wheel);
    expect(layer()).toBeNull();
    expect(wheel.defaultPrevented).toBe(true);
  });
});
