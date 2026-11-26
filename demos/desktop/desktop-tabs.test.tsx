import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectDesktopValues, receiveDesktopValues } from "./desktop-personal";
import { noteKeyWindowFullScreen, PREFER_TABS, tabsPreferred } from "./desktop-tabs";

describe("Prefer tabs when opening documents", () => {
  let disconnect = () => {};
  beforeEach(() => {
    disconnect = connectDesktopValues(() => {});
  });
  afterEach(() => {
    noteKeyWindowFullScreen(false);
    disconnect();
  });

  it.each([
    ["Always", false, true],
    ["Always", true, true],
    ["In Full Screen Only", false, false],
    ["In Full Screen Only", true, true],
    [undefined, false, false],
    [undefined, true, true],
    ["Manually", false, false],
    ["Manually", true, false],
  ])("%s, full screen %s: tabs %s", (chosen, fullScreen, preferred) => {
    receiveDesktopValues(chosen === undefined ? {} : { [PREFER_TABS]: chosen });
    noteKeyWindowFullScreen(fullScreen);
    expect(tabsPreferred()).toBe(preferred);
  });
});
