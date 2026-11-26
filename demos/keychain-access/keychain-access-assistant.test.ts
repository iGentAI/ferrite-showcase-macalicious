import { describe, expect, it } from "vitest";
import { generatePassword, passwordBits } from "./keychain-access-assistant";

describe("Password Assistant", () => {
  it("makes passwords of the type and length asked for", () => {
    expect(generatePassword("Numbers Only", 30)).toMatch(/^\d{30}$/);
    expect(generatePassword("Letters & Numbers", 12)).toMatch(/^[a-zA-Z0-9]{12}$/);
    expect(generatePassword("Random", 64)).toHaveLength(64);
  });

  it("throws away bytes that would favour the alphabet's first characters", () => {
    // 250 is past the largest multiple of ten under 256: only the 7 may become a character.
    const bytes = [250, 7];
    const password = generatePassword("Numbers Only", 1, (buffer) => {
      buffer[0] = bytes.shift() ?? 0;
      return buffer;
    });
    expect(password).toBe("7");
  });

  it("estimates more for longer passwords and more kinds of character", () => {
    expect(passwordBits("")).toBe(0);
    expect(passwordBits("12345678")).toBe(27);
    expect(passwordBits("abcdefgh")).toBe(38);
    expect(passwordBits("aB3$aB3$")).toBeGreaterThan(passwordBits("abcdefgh"));
  });
});
