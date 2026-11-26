import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Messages } from "./messages";

const CONVERSATIONS = [
  { id: "first", name: "Ann", messages: [] },
  { id: "with-ben", name: "Ben", messages: [] },
];

describe("a message to someone already in a conversation", () => {
  it("shows that conversation, not a new message", () => {
    render(
      <Messages
        defaultConversations={CONVERSATIONS}
        defaultConversation="first"
        conversationWith={(account) => (account === "ben" ? "with-ben" : null)}
        composeTo={{ key: 1, to: "ben", text: "Hello" }}
      />,
    );
    expect(screen.queryByRole("textbox", { name: "To" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Hello");
    const selected = screen.getAllByRole("option").filter((row) => row.ariaSelected === "true");
    expect(selected.map((row) => row.textContent)).toEqual([expect.stringContaining("Ben")]);
  });

  it("starts a new message to someone with none", () => {
    render(
      <Messages
        defaultConversations={CONVERSATIONS}
        conversationWith={() => null}
        composeTo={{ key: 1, to: "cal" }}
      />,
    );
    expect(screen.getByRole("textbox", { name: "To" })).toHaveValue("cal");
  });
});
