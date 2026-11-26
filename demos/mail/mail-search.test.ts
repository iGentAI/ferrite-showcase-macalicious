import { describe, expect, it } from "vitest";
import { finishedToken, searchRules, smartFromSearch, wholeToken } from "./mail-search";

describe("search tokens", () => {
  it("finishes a criterion at a space, quoted words at their quote", () => {
    expect(finishedToken("from:ada")).toBeNull();
    expect(finishedToken("from:ada ferry")).toEqual({
      token: { field: "from", value: "ada" },
      rest: "ferry",
    });
    expect(finishedToken('Subject:"two words" ')).toEqual({
      token: { field: "subject", value: "two words" },
      rest: "",
    });
    expect(finishedToken('subject:"two wor')).toBeNull();
  });
  it("reads the whole text as a criterion on Return", () => {
    expect(wholeToken("subject:two words")).toEqual({ field: "subject", value: "two words" });
    expect(wholeToken("ferry")).toBeNull();
    expect(wholeToken("from:")).toBeNull();
  });
  it("asks for every token and the words typed", () => {
    expect(searchRules([{ field: "from", value: "ada" }], " boat ")).toEqual([
      { field: "from", test: "contains", value: "ada" },
      { field: "message", test: "contains", value: "boat" },
    ]);
    expect(searchRules([], "subject:boat")).toEqual([
      { field: "subject", test: "contains", value: "boat" },
    ]);
    expect(searchRules([], "  ")).toEqual([]);
  });
  it("saves as a Smart Mailbox with its scope", () => {
    const tokens = [{ field: "from", value: "ada" }] as const;
    expect(smartFromSearch(tokens, "", "sent", {})).toEqual({
      name: "ada",
      matchAll: true,
      rules: [
        { field: "from", test: "contains", value: "ada" },
        { field: "mailbox", test: "is", value: "sent" },
      ],
      includeTrash: false,
      includeSent: true,
      includeJunk: false,
      includeDrafts: false,
    });
    const everywhere = smartFromSearch(tokens, "", null, { searchTrash: true });
    expect(everywhere.rules).toHaveLength(1);
    expect(everywhere.includeTrash).toBe(true);
    expect(everywhere.includeDrafts).toBe(true);
    expect(everywhere.includeJunk).toBe(false);
    expect(smartFromSearch(tokens, "", null, { searchJunk: true }).includeJunk).toBe(true);
    expect(smartFromSearch(tokens, "", "junk", {}).includeJunk).toBe(true);
    expect(smartFromSearch(tokens, "", "drafts", {}).includeDrafts).toBe(true);
  });
});
