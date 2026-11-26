import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MessagesConversation } from "./messages-data";
import { soundHertz, useReceivedSound } from "./messages-sounds";

const pitches: number[] = [];

class FakeAudio {
  currentTime = 0;
  destination = {};
  createGain() {
    return { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {} } };
  }
  createOscillator() {
    const oscillator = {
      frequency: { value: 0 },
      connect() {},
      start: () => pitches.push(oscillator.frequency.value),
      stop() {},
    };
    return oscillator;
  }
}

const message = (id: string, from: "me" | "them") => ({
  id,
  from,
  text: id,
  at: "2019-10-07T15:27",
});
const room = (
  messages: MessagesConversation["messages"],
  muted = false,
): readonly MessagesConversation[] => [{ id: "room", name: "Room", messages, muted }];

const listen = (first: readonly MessagesConversation[], playSounds = true, sound = "Bell") => {
  vi.stubGlobal("AudioContext", FakeAudio);
  return renderHook(
    ({ conversations }) => useReceivedSound(conversations, { playSounds, sound }, undefined, false),
    { initialProps: { conversations: first } },
  );
};

afterEach(() => {
  pitches.length = 0;
  vi.unstubAllGlobals();
});

describe("Messages' received sound", () => {
  it("gives each choice its own pitch", () => {
    expect(soundHertz("Note (Default)")).toBe(523);
    expect(soundHertz("Bell")).toBe(587);
    expect(soundHertz("Woodblock")).toBe(932);
  });

  it("plays for a new message from someone else, not for what was there", () => {
    const { rerender } = listen(room([message("a", "them")]));
    expect(pitches).toEqual([]);
    rerender({ conversations: room([message("a", "them"), message("b", "them")]) });
    expect(pitches).toEqual([587]);
  });

  it("does not play for one's own message, nor when the newest is deleted", () => {
    const { rerender } = listen(room([message("a", "them")]));
    rerender({ conversations: room([message("a", "them"), message("b", "me")]) });
    rerender({ conversations: room([message("a", "them")]) });
    expect(pitches).toEqual([]);
  });

  it("does not play with Do Not Disturb, or with Play sound effects off", () => {
    const muted = listen(room([message("a", "them")], true));
    muted.rerender({ conversations: room([message("b", "them")], true) });
    const off = listen(room([message("a", "them")]), false);
    off.rerender({ conversations: room([message("b", "them")]) });
    expect(pitches).toEqual([]);
  });
});
