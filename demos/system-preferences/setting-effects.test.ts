import { afterEach, describe, expect, it, vi } from "vitest";
import { setDoNotDisturb } from "../desktop/desktop-live";
import { playAlert } from "./panes/sound/alert-sounds";
import {
  applySettingEffects,
  callRingsThrough,
  clearSettingEffects,
  inQuietHours,
  settingAttributes,
  settingProperties,
} from "./setting-effects";

vi.mock("../desktop/desktop-live", () => ({ setDoNotDisturb: vi.fn() }));

afterEach(() => {
  clearSettingEffects();
  vi.useRealTimers();
  vi.mocked(setDoNotDisturb).mockClear();
  vi.unstubAllGlobals();
});

const SCHEDULE = {
  "notifications.scheduled": true,
  "notifications.from": 22 * 60,
  "notifications.to": 7 * 60,
};

describe("following the schedule", () => {
  it("changes nothing when the page loads the settings, whatever a person's switch says", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 3, 12, 0) });
    applySettingEffects(SCHEDULE);
    vi.setSystemTime(new Date(2026, 10, 3, 13, 0));
    applySettingEffects(SCHEDULE);
    expect(setDoNotDisturb).not.toHaveBeenCalled();
  });

  it("changes nothing when the settings load late, after a look with nothing loaded", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 3, 23, 0) });
    applySettingEffects(null);
    applySettingEffects(SCHEDULE);
    expect(setDoNotDisturb).not.toHaveBeenCalled();
  });

  it("turns on and off at the span's edges", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 3, 21, 59) });
    applySettingEffects(SCHEDULE);
    vi.setSystemTime(new Date(2026, 10, 3, 22, 0));
    applySettingEffects(SCHEDULE);
    expect(setDoNotDisturb).toHaveBeenLastCalledWith(true);
    vi.setSystemTime(new Date(2026, 10, 4, 7, 0));
    applySettingEffects(SCHEDULE);
    expect(setDoNotDisturb).toHaveBeenLastCalledWith(false);
    expect(setDoNotDisturb).toHaveBeenCalledTimes(2);
  });

  it("turns on when the schedule is switched on inside its span, and not outside it", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 3, 12, 0) });
    applySettingEffects({});
    applySettingEffects(SCHEDULE);
    expect(setDoNotDisturb).not.toHaveBeenCalled();
    applySettingEffects({});
    vi.setSystemTime(new Date(2026, 10, 3, 23, 0));
    applySettingEffects(SCHEDULE);
    expect(setDoNotDisturb).toHaveBeenCalledExactlyOnceWith(true);
  });
});

describe("an alert sound", () => {
  it("makes no sound at volume zero", () => {
    const context = vi.fn();
    vi.stubGlobal("AudioContext", context);
    playAlert("Glass", 0);
    expect(context).not.toHaveBeenCalled();
  });
});

describe("repeated calls", () => {
  it("does not carry one account's call into the next session", () => {
    const repeated = { "notifications.allowRepeatedCalls": true };
    const call = (at_ms: number) => ({ app: "facetime", title: "Ada", at_ms });
    applySettingEffects(repeated);
    expect(callRingsThrough(call(0))).toBe(false);
    expect(callRingsThrough(call(1_000))).toBe(true);
    clearSettingEffects();
    applySettingEffects(repeated);
    expect(callRingsThrough(call(2_000))).toBe(false);
  });
});

describe("Do Not Disturb's schedule", () => {
  it("counts a span that crosses midnight", () => {
    const [from, to] = [22 * 60, 7 * 60];
    expect(inQuietHours(23 * 60, from, to)).toBe(true);
    expect(inQuietHours(6 * 60, from, to)).toBe(true);
    expect(inQuietHours(7 * 60, from, to)).toBe(false);
    expect(inQuietHours(12 * 60, from, to)).toBe(false);
  });

  it("counts a span within a day, its end left out", () => {
    expect(inQuietHours(9 * 60, 9 * 60, 17 * 60)).toBe(true);
    expect(inQuietHours(17 * 60, 9 * 60, 17 * 60)).toBe(false);
  });
});

describe("the settings the page honours", () => {
  it("leaves the defaults off the page", () => {
    expect(settingAttributes({})).toEqual({
      "data-mac-hide-menu-bar": null,
      "data-mac-font-smoothing": null,
      "data-mac-dock-indicators": null,
      "data-mac-siri-off": null,
      "data-mac-siri-no-extra": null,
      "data-mac-no-battery-extra": null,
      "data-mac-no-time-machine-extra": null,
      "data-mac-no-wifi-extra": null,
    });
  });

  it("names each setting that is changed", () => {
    expect(
      settingAttributes({
        "general.hideMenuBar": true,
        "general.scrollBars": "always",
        "general.sidebarIconSize": "Large",
        "general.fontSmoothing": false,
        "dock.minimizeEffect": "Scale effect",
        "dock.indicators": false,
        "siri.askSiri": false,
        "siri.showInMenuBar": false,
        "energy-saver.showBatteryStatus": false,
        "time-machine.showInMenuBar": false,
        "network.showStatusInMenuBar": false,
      }),
    ).toEqual({
      "data-mac-hide-menu-bar": "",
      "data-mac-font-smoothing": "off",
      "data-mac-dock-indicators": "off",
      "data-mac-siri-off": "",
      "data-mac-siri-no-extra": "",
      "data-mac-no-battery-extra": "",
      "data-mac-no-time-machine-extra": "",
      "data-mac-no-wifi-extra": "",
    });
  });

  it("sizes the sidebars and shapes the Genie effect through the components' own properties", () => {
    expect(settingProperties({})).toEqual({
      "--mac-scroll-view-overlay-opacity": null,
      "--mac-scroll-view-overlay-pointer-events": null,
      "--mac-sidebar-icon-size": null,
      "--mac-sidebar-row-height": null,
      "--mac-managed-window-minimize-scale": "0.03, 0.08",
      "--mac-managed-window-minimize-skew": "8deg",
    });
    expect(
      settingProperties({
        "general.scrollBars": "always",
        "general.sidebarIconSize": "Large",
        "dock.minimizeEffect": "Scale effect",
      }),
    ).toEqual({
      "--mac-scroll-view-overlay-opacity": "1",
      "--mac-scroll-view-overlay-pointer-events": "auto",
      "--mac-sidebar-icon-size": "22px",
      "--mac-sidebar-row-height": "32px",
      "--mac-managed-window-minimize-scale": null,
      "--mac-managed-window-minimize-skew": null,
    });
    expect(settingProperties({ "general.sidebarIconSize": "Small" })).toMatchObject({
      "--mac-sidebar-icon-size": "14px",
      "--mac-sidebar-row-height": "20px",
    });
  });
});
