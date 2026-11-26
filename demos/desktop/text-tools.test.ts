import { afterEach, describe, expect, it } from "vitest";
import { changeFoundWord, withLearnedWord } from "./text-tools";

const realExecCommand = document.execCommand;

afterEach(() => {
  document.execCommand = realExecCommand;
  document.body.innerHTML = "";
});

describe("learning a word", () => {
  it("adds it in lower case, once", () => {
    expect(withLearnedWord(["one"], "Two")).toEqual(["one", "two"]);
    const learned = ["one"];
    expect(withLearnedWord(learned, "ONE")).toBe(learned);
    expect(withLearnedWord([], "Zorbly’s")).toEqual(["zorbly's"]);
  });

  it("refuses a word there is no room for, and removes none", () => {
    const full = Array.from({ length: 400 }, (_, at) => `word${at}xxxxxx`);
    expect(withLearnedWord(full, "another")).toBeUndefined();
    expect(full).toHaveLength(400);
    expect(full[0]).toBe("word0xxxxxx");
  });
});

describe("the spelling panel's Change", () => {
  const view = () => {
    const element = document.createElement("div");
    element.innerHTML = "<div>the helo world</div>";
    document.body.append(element);
    document.execCommand = ((_: string, __: boolean, next: string) => {
      const range = document.getSelection()?.getRangeAt(0);
      range?.deleteContents();
      range?.insertNode(document.createTextNode(next));
      return true;
    }) as typeof document.execCommand;
    return element;
  };
  const found = { word: "helo", start: 4, end: 8 };

  it("replaces the word where it was found", () => {
    const element = view();
    expect(changeFoundWord(element, found, "hello")).toBe(true);
    expect(element.textContent).toBe("the hello world");
  });

  it("says so when the browser refuses, and leaves the text", () => {
    const element = view();
    document.execCommand = (() => false) as typeof document.execCommand;
    expect(changeFoundWord(element, found, "hello")).toBe(false);
    expect(element.textContent).toBe("the helo world");
  });

  it("changes nothing once the document has moved the word", () => {
    const element = view();
    const text = element.firstElementChild?.firstChild;
    if (text instanceof Text) text.insertData(0, "and ");
    expect(changeFoundWord(element, found, "hello")).toBe(false);
    expect(element.textContent).toBe("and the helo world");
  });
});
