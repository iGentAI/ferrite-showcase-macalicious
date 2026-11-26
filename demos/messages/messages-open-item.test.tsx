import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Messages } from "./messages";
import type { MessagesConversation } from "./messages-data";
import { conversationOfItem } from "./messages-live";

const word = (id: string, text: string) => ({
  id,
  from: "them" as const,
  text,
  at: "2019-10-07T15:00",
});
const TWO: MessagesConversation[] = [
  { id: "a", name: "Ada", messages: [word("a1", "from ada")] },
  { id: "b", name: "Bea", messages: [word("b1", "from bea")] },
];
const LATER: MessagesConversation = { id: "c", name: "Cy", messages: [word("c1", "from cy")] };

describe("the conversation an item names", () => {
  it("reads a conversation's notifications and Spotlight's id alike", () => {
    expect(conversationOfItem("c-12ab#7", "desktop")).toBe("c-12ab");
    expect(conversationOfItem("c-12ab#left-ada", "desktop")).toBe("c-12ab");
    expect(conversationOfItem("c-12ab#added-bob", "desktop")).toBe("c-12ab");
    expect(conversationOfItem("c-12ab", "desktop")).toBe("c-12ab");
  });

  it("reads the page's room as the conversation that shows it", () => {
    expect(conversationOfItem("desktop#3", "desktop")).toBe("ferrite-room");
    expect(conversationOfItem("other#3", "desktop")).toBe("other");
  });
});

describe("a conversation asked for from outside", () => {
  const shown = () => screen.getByRole("option", { selected: true }).textContent;

  it("shows the conversation, once for each request", () => {
    const view = render(<Messages defaultConversations={TWO} defaultConversation="a" />);
    expect(shown()).toContain("Ada");
    view.rerender(
      <Messages
        defaultConversations={TWO}
        defaultConversation="a"
        openConversation={{ key: 1, id: "b" }}
      />,
    );
    expect(shown()).toContain("Bea");
  });

  it("waits for a conversation the list does not have yet", () => {
    const asked = { key: 1, id: "c" };
    const view = render(
      <Messages defaultConversations={TWO} defaultConversation="a" openConversation={asked} />,
    );
    expect(shown()).toContain("Ada");
    view.rerender(
      <Messages
        defaultConversations={TWO}
        extraConversations={[LATER]}
        defaultConversation="a"
        openConversation={asked}
      />,
    );
    expect(shown()).toContain("Cy");
  });
});
