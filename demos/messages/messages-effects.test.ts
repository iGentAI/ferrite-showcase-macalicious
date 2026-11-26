import { describe, expect, it } from "vitest";
import { effectOf } from "./messages-effects";

describe("the phrases that set off an effect", () => {
  it.each([
    ["Happy Birthday!", "balloons"],
    ["oh, congrats on the job", "confetti"],
    ["CONGRATULATIONS", "confetti"],
    ["happy new year everyone", "fireworks"],
    ["pew pew", "lasers"],
  ])("%s", (text, effect) => {
    expect(effectOf(text)).toBe(effect);
  });

  it.each(["unhappy birthdays", "see you at the party", ""])("nothing for %j", (text) => {
    expect(effectOf(text)).toBeNull();
  });
});
