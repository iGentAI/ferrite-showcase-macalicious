import { describe, expect, it } from "vitest";
import { nextGrammarIssue } from "./text-grammar";

describe("nextGrammarIssue", () => {
  it("finds a repeated word and offers it once", () => {
    expect(nextGrammarIssue("Over the the hill.", 0)).toEqual({
      word: "the the",
      start: 5,
      end: 12,
      why: "The word “the” is repeated.",
      change: "the",
    });
    expect(nextGrammarIssue("He had had enough.", 0)).toBeUndefined();
    expect(nextGrammarIssue("then the end", 0)).toBeUndefined();
  });

  it("goes by the sound after a and an, not the letter", () => {
    const change = (text: string) => nextGrammarIssue(text, 0)?.change;
    expect(change("It was a apple.")).toBe("an apple");
    expect(change("It was an pear.")).toBe("a pear");
    expect(change("It took a hour.")).toBe("an hour");
    expect(change("An unit of it.")).toBe("A unit");
    expect(nextGrammarIssue("It was a university and an uncle.", 0)).toBeUndefined();
    expect(nextGrammarIssue("It was a horse and an honest one.", 0)).toBeUndefined();
    expect(nextGrammarIssue("Grade a NASA pilot.", 0)).toBeUndefined();
  });

  it("asks for a capital after a sentence, but not after an abbreviation or a line's end", () => {
    expect(nextGrammarIssue("It ended. then it began.", 0)).toEqual({
      word: "then",
      start: 10,
      end: 14,
      why: "A sentence begins with a capital letter.",
      change: "Then",
    });
    expect(nextGrammarIssue("Some fruit, e.g. pears.", 0)).toBeUndefined();
    expect(nextGrammarIssue("One line.\nanother line.", 0)).toBeUndefined();
  });

  it("finds a space before punctuation, and leaves an ellipsis and a decimal", () => {
    expect(nextGrammarIssue("Well , then.", 0)).toEqual({
      word: " ,",
      start: 4,
      end: 6,
      why: "There is a space before “,”.",
      change: ",",
    });
    expect(nextGrammarIssue("Well ... then", 0)).toBeUndefined();
    expect(nextGrammarIssue("Costs .5 of it", 0)).toBeUndefined();
  });

  it("goes in the order of the text, from where it is asked", () => {
    const text = "Well , it is is a apple.";
    expect(nextGrammarIssue(text, 0)?.change).toBe(",");
    expect(nextGrammarIssue(text, 6)?.change).toBe("is");
    expect(nextGrammarIssue(text, 15)?.change).toBe("an apple");
    expect(nextGrammarIssue(text, 23)).toBeUndefined();
  });

  it("passes over what the person ignored", () => {
    const text = "The the end and the the rest. then more";
    expect(nextGrammarIssue(text, 0, new Set(["the the"]))?.change).toBe("Then");
  });
});
