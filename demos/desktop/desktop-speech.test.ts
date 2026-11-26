import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abandon,
  afterHeySiri,
  listenWhileOpen,
  type Recognition,
  recognition,
} from "./desktop-speech";

/** A stand-in for the browser's recognizer: a test says what it heard. */
class Stub {
  static made: Stub[] = [];
  lang = "";
  interimResults = true;
  continuous = false;
  started = false;
  stopped = false;
  onresult: Recognition["onresult"] = null;
  onend: Recognition["onend"] = null;
  onerror: Recognition["onerror"] = null;
  ended: (() => void)[] = [];
  constructor() {
    Stub.made.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
  addEventListener(_type: "end", listener: () => void) {
    this.ended.push(listener);
  }
  say(words: string, isFinal = true) {
    this.onresult?.({ results: [Object.assign([{ transcript: words }], { isFinal })] });
  }
  end() {
    this.onend?.();
    for (const listener of this.ended) listener();
  }
}

const last = () => Stub.made[Stub.made.length - 1] as Stub;

describe("listening while the page is open", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Stub.made = [];
  });

  const stubbed = () => {
    vi.useFakeTimers();
    vi.stubGlobal("SpeechRecognition", Stub);
  };

  it("reads what follows Hey Siri, and nothing else", () => {
    expect(afterHeySiri("Hey Siri what time is it")).toBe("what time is it");
    expect(afterHeySiri("okay hey, Siri. open Notes")).toBe("open Notes");
    expect(afterHeySiri("hey siri")).toBe("");
    expect(afterHeySiri("they sirius")).toBeNull();
    expect(afterHeySiri("what time is it")).toBeNull();
  });

  it("starts for the first ear, tells it what is said whole, and stops with the last", () => {
    stubbed();
    const heard: string[] = [];
    const stop = listenWhileOpen({ hear: (said) => heard.push(said), lang: () => "fr-FR" });
    const ear = last();
    expect([ear.started, ear.continuous, ear.interimResults, ear.lang]).toEqual([
      true,
      true,
      false,
      "fr-FR",
    ]);
    ear.say("half a thou", false);
    ear.say("  all of it ");
    expect(heard).toEqual(["all of it"]);
    stop();
    expect(ear.stopped).toBe(true);
    expect(Stub.made).toHaveLength(1);
  });

  it("starts again after silence ends it", () => {
    stubbed();
    const stop = listenWhileOpen({ hear: () => {} });
    const first = last();
    first.end();
    expect(Stub.made).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(Stub.made).toHaveLength(2);
    expect(last().started).toBe(true);
    stop();
  });

  it("gives way to someone who asks to be heard, and comes back when they have finished", () => {
    stubbed();
    const stop = listenWhileOpen({ hear: () => {} });
    const waiting = last();
    const asked = recognition() as unknown as Stub;
    expect(waiting.stopped).toBe(true);
    asked.start();
    vi.advanceTimersByTime(5_000);
    expect(Stub.made).toHaveLength(2);
    asked.end();
    vi.advanceTimersByTime(500);
    expect(Stub.made).toHaveLength(3);
    abandon(last() as unknown as Recognition);
    stop();
  });

  it("tells the ears when the browser refuses, and does not try again", () => {
    stubbed();
    const refused: string[] = [];
    listenWhileOpen({ hear: () => {}, refused: (reason) => refused.push(reason) });
    last().onerror?.({ error: "not-allowed" });
    expect(refused).toEqual(["not-allowed"]);
    vi.advanceTimersByTime(60_000);
    expect(Stub.made).toHaveLength(1);
  });

  it("tries again later when the speech service cannot be reached, and on no-speech goes on", () => {
    stubbed();
    const refused: string[] = [];
    const stop = listenWhileOpen({ hear: () => {}, refused: (reason) => refused.push(reason) });
    last().onerror?.({ error: "no-speech" });
    expect(last().stopped).toBe(false);
    last().onerror?.({ error: "network" });
    expect(refused).toEqual([]);
    vi.advanceTimersByTime(29_000);
    expect(Stub.made).toHaveLength(1);
    vi.advanceTimersByTime(1_000);
    expect(Stub.made).toHaveLength(2);
    stop();
  });
});
