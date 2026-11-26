import { describe, expect, it } from "vitest";
import type { MessagesConversation } from "./messages-data";
import { transcriptLines } from "./messages-transcript";

const message = (id: string, from: "me" | "them", text: string, sender?: string) =>
  ({ id, from, text, at: "", sender }) as MessagesConversation["messages"][number];

describe("a conversation's transcript", () => {
  it("says who said what, in order, naming a group's members", () => {
    expect(
      transcriptLines({
        id: "c",
        name: "Trip",
        messages: [message("1", "them", "Noon?\nOr one?", "Martin"), message("2", "me", "Noon.")],
      }),
    ).toEqual(["Trip", "", "Martin:", "Noon?", "Or one?", "", "Me:", "Noon."]);
  });

  it("names the other person where a message has no sender", () => {
    const [, , who] = transcriptLines({
      id: "c",
      name: "Martin",
      messages: [message("1", "them", "Hello")],
    });
    expect(who).toBe("Martin:");
  });
});
