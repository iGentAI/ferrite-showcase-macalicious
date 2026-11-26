import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume");
const playing = (element: HTMLMediaElement): number => native?.get?.call(element);
const HALF = { "sound.outputVolume": 50 };
const realPlay = HTMLMediaElement.prototype.play;
const play = vi.fn(() => Promise.resolve());

const movie = (volume: number) => {
  const element = document.createElement("audio");
  element.volume = volume;
  return element;
};

// The module installs itself once on the prototype, so each test starts from a fresh copy of both.
let followOutputVolume: typeof import("./output-volume").followOutputVolume;
let clearOutputVolume: typeof import("./output-volume").clearOutputVolume;
beforeEach(async () => {
  if (native) Object.defineProperty(HTMLMediaElement.prototype, "volume", native);
  HTMLMediaElement.prototype.play = play;
  vi.resetModules();
  ({ followOutputVolume, clearOutputVolume } = await import("./output-volume"));
});

afterEach(() => {
  if (native) Object.defineProperty(HTMLMediaElement.prototype, "volume", native);
  HTMLMediaElement.prototype.play = realPlay;
  document.body.replaceChildren();
});

describe("Output volume over media elements", () => {
  it("scales what plays, and the application reads back what it asked", async () => {
    followOutputVolume(HALF);
    const element = movie(0.8);
    await element.play();
    expect(playing(element)).toBeCloseTo(0.4);
    expect(element.volume).toBeCloseTo(0.8);
    element.volume = 0.6;
    expect(playing(element)).toBeCloseTo(0.3);
    followOutputVolume({ "sound.mute": true });
    expect(playing(element)).toBe(0);
    expect(element.volume).toBeCloseTo(0.6);
  });

  it("gives a stopped element back what it asked, and writes to it no more", async () => {
    followOutputVolume(HALF);
    for (const stopping of ["pause", "ended", "error", "emptied"]) {
      const element = movie(0.8);
      await element.play();
      element.dispatchEvent(new Event(stopping));
      expect(playing(element)).toBeCloseTo(0.8);
      followOutputVolume({ "sound.outputVolume": 25 });
      expect(playing(element)).toBeCloseTo(0.8);
      followOutputVolume(HALF);
    }
  });

  it("keeps following an element that was playing again when its pause event arrived", async () => {
    followOutputVolume(HALF);
    const element = movie(0.8);
    await element.play();
    Object.defineProperty(element, "paused", { value: false });
    element.dispatchEvent(new Event("pause"));
    expect(playing(element)).toBeCloseTo(0.4);
    followOutputVolume({ "sound.outputVolume": 25 });
    expect(playing(element)).toBeCloseTo(0.2);
  });

  it("lets go of an element whose play was refused", async () => {
    play.mockRejectedValueOnce(new Error("refused"));
    followOutputVolume(HALF);
    const element = movie(0.8);
    await expect(element.play()).rejects.toThrow("refused");
    await Promise.resolve();
    expect(playing(element)).toBeCloseTo(0.8);
    followOutputVolume({ "sound.outputVolume": 25 });
    expect(playing(element)).toBeCloseTo(0.8);
  });

  it("keeps an element's own controls under the level, also while muted", async () => {
    followOutputVolume({ ...HALF, "sound.mute": true });
    const element = movie(0.8);
    document.body.append(element);
    await element.play();
    native?.set?.call(element, 0.6);
    element.dispatchEvent(new Event("volumechange", { bubbles: true }));
    expect(playing(element)).toBe(0);
    followOutputVolume(HALF);
    expect(playing(element)).toBeCloseTo(0.3);
  });

  it("follows what was already playing in the document when it starts", () => {
    const element = movie(0.8);
    Object.defineProperty(element, "paused", { value: false });
    document.body.append(element);
    followOutputVolume({ "sound.mute": true });
    expect(playing(element)).toBe(0);
    expect(element.volume).toBeCloseTo(0.8);
  });

  it("leaves every element at what it asked when the session ends, and goes on with the next", async () => {
    followOutputVolume(HALF);
    const paused = movie(0.8);
    await paused.play();
    paused.dispatchEvent(new Event("pause"));
    const still = movie(0.7);
    await still.play();
    clearOutputVolume();
    expect(playing(paused)).toBeCloseTo(0.8);
    expect(playing(still)).toBeCloseTo(0.7);
    expect(paused.volume).toBeCloseTo(0.8);
    paused.volume = 0.2;
    followOutputVolume({ "sound.mute": true });
    expect(paused.volume).toBeCloseTo(0.2);
    expect(playing(still)).toBe(0);
    await paused.play();
    expect(playing(paused)).toBe(0);
    expect(paused.volume).toBeCloseTo(0.2);
  });
});
