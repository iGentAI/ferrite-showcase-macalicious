import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Messages } from "./messages";
import { defaultConversations } from "./messages-data";
import { readMessagesSettings, readSelected, readUnsent, writeUnsent } from "./messages-saved";

afterEach(() => window.localStorage.clear());

describe("what Messages keeps for a person", () => {
  it("keeps what is typed under the account, and an empty field keeps nothing", () => {
    writeUnsent("chris", "c1", "half a thought");
    writeUnsent("chris", "c2", "");
    expect([...readUnsent("chris")]).toEqual([["c1", "half a thought"]]);
    expect(readUnsent("martin").size).toBe(0);
  });

  it("never reads one account's fields as another's, whatever their names hold", () => {
    writeUnsent("chris.x", "a/b", "secret");
    expect(readUnsent("chris").size).toBe(0);
    expect([...readUnsent("chris.x")]).toEqual([["a/b", "secret"]]);
  });

  it("clears one field without touching another", () => {
    writeUnsent("chris", "a", "from tab A");
    writeUnsent("chris", "b", "from tab B");
    writeUnsent("chris", "b", "");
    expect([...readUnsent("chris")]).toEqual([["a", "from tab A"]]);
  });

  it("refuses settings and a selection it did not write", () => {
    expect(readMessagesSettings({ textSize: "big" })).toBeUndefined();
    expect(readMessagesSettings(null)).toBeUndefined();
    expect(readMessagesSettings({ textSize: 4, readReceipts: false })).toEqual({
      textSize: 4,
      readReceipts: false,
    });
    expect(readSelected(3)).toBeUndefined();
    expect(readSelected("c1")).toBe("c1");
  });
});

describe("a window given what was kept", () => {
  const first = defaultConversations[0]?.id ?? "";

  it("shows it and reports nothing until the person types, then that field alone", async () => {
    const onTextChange = vi.fn();
    render(
      <Messages
        defaultConversation={first}
        keptTexts={new Map([[first, "kept"]])}
        onTextChange={onTextChange}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Message" });
    expect((field as HTMLInputElement).value).toBe("kept");
    expect(onTextChange).not.toHaveBeenCalled();
    await userEvent.type(field, "!");
    expect(onTextChange.mock.calls).toEqual([[first, "kept!"]]);
  });

  it("leaves a field emptied before the kept text arrived empty", async () => {
    const onTextChange = vi.fn();
    const { rerender } = render(
      <Messages defaultConversation={first} onTextChange={onTextChange} />,
    );
    const field = screen.getByRole("textbox", { name: "Message" }) as HTMLInputElement;
    await userEvent.type(field, "x");
    await userEvent.clear(field);
    rerender(
      <Messages
        defaultConversation={first}
        onTextChange={onTextChange}
        keptTexts={new Map([[first, "old"]])}
      />,
    );
    expect(field.value).toBe("");
    expect(onTextChange.mock.calls.at(-1)).toEqual([first, ""]);
  });
});
