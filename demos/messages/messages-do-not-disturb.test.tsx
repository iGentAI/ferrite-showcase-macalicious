import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Messages } from "./messages";
import type { MessagesConversation } from "./messages-data";
import { muteIdOf, useDoNotDisturb, windowIdOf } from "./messages-do-not-disturb";

// Do Not Disturb kept on the server (`messages-do-not-disturb.ts`, the server's
// `ferrite-apps/desktop/src/apps/messages/muted.rs`, exercised by `tests/messages.rs` and the
// browser journey `e2e/messages-journey.mjs`). Here the server is a fetch stub.

const room = { id: "ferrite-room", room: "desktop" };
const account = `c-${"ab".repeat(16)}`;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const pathOf = (input: RequestInfo | URL) => new URL(String(input), "http://desktop.test").pathname;

describe("Do Not Disturb ids", () => {
  it("maps the room and account conversations to the server's ids and back", () => {
    expect(muteIdOf("ferrite-room", room)).toBe("room-desktop");
    expect(muteIdOf(account, room)).toBe(account);
    expect(muteIdOf("new-1", room)).toBeNull();
    expect(windowIdOf("room-desktop", room)).toBe("ferrite-room");
    // Another room's setting is not this window's room.
    expect(windowIdOf("room-other", room)).toBeNull();
    expect(windowIdOf(account, room)).toBe(account);
  });
});

describe("Do Not Disturb kept on the server", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the list, shows a change once the server keeps it, and a refusal when it does not", async () => {
    const puts: [string, unknown][] = [];
    let putStatus = 200;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") {
          puts.push([pathOf(input), JSON.parse(String(init.body))]);
          return Promise.resolve(
            putStatus === 200
              ? json({ muted: false })
              : json({ error: "Do Not Disturb is on for 200 conversations already" }, putStatus),
          );
        }
        return Promise.resolve(json({ muted: ["room-desktop", "room-other", account] }));
      }),
    );
    const { result } = renderHook(() => useDoNotDisturb(true, room));
    await waitFor(() =>
      expect([...result.current.muted].sort()).toEqual([account, "ferrite-room"]),
    );

    act(() => result.current.setMuted(account, false));
    await waitFor(() => expect(result.current.muted.has(account)).toBe(false));
    expect(puts).toEqual([[`/api/messages/muted/${account}`, { muted: false }]]);

    putStatus = 409;
    act(() => result.current.setMuted(account, true));
    await waitFor(() =>
      expect(result.current.refusals.get(account)).toBe(
        "Do Not Disturb was not changed: Do Not Disturb is on for 200 conversations already.",
      ),
    );
    expect(result.current.muted.has(account)).toBe(false);
    // A conversation the server does not keep sends nothing.
    act(() => result.current.setMuted("new-1", true));
    expect(puts).toHaveLength(2);
  });

  it("never lets a read that began before a kept change undo it", async () => {
    const reads: ((response: Response) => void)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "PUT"
          ? Promise.resolve(json({ muted: true }))
          : new Promise<Response>((resolve) => reads.push(resolve)),
      ),
    );
    const { result } = renderHook(() => useDoNotDisturb(true, room));
    await waitFor(() => expect(reads).toHaveLength(1));
    reads[0]?.(json({ muted: [] }));
    // A read starts (the window gains focus), and before it is answered a change is kept.
    fireEvent.focus(window);
    await waitFor(() => expect(reads).toHaveLength(2));
    act(() => result.current.setMuted(account, true));
    await waitFor(() => expect(result.current.muted.has(account)).toBe(true));
    // The older read answers what the server had before the change: the change stands.
    await act(async () => {
      reads[1]?.(json({ muted: [] }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.current.muted.has(account)).toBe(true);
    // A read that begins after the change takes the server's word again.
    fireEvent.focus(window);
    await waitFor(() => expect(reads).toHaveLength(3));
    await act(async () => {
      reads[2]?.(json({ muted: [] }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.current.muted.has(account)).toBe(false);
  });
});

describe("the Messages window when its owner keeps Do Not Disturb", () => {
  it("shows the owner's setting and hands a change to the owner instead of keeping it", async () => {
    const pair: MessagesConversation = {
      id: account,
      name: "Martin Klein",
      messages: [{ id: "c1", from: "them", text: "Hi", at: "2019-10-07T14:00" }],
    };
    const onMutedChange = vi.fn();
    const props = {
      defaultConversations: [],
      extraConversations: [pair],
      defaultConversation: account,
      onMutedChange,
    };
    const { rerender } = render(<Messages {...props} mutedConversations={new Set()} />);
    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    const box = () => screen.getByRole("checkbox", { name: "Do Not Disturb" });
    expect(box().getAttribute("aria-checked")).toBe("false");
    await userEvent.click(box());
    expect(onMutedChange).toHaveBeenCalledWith(account, true);
    // The window does not keep it: it stays off until the owner says it is kept.
    expect(box().getAttribute("aria-checked")).toBe("false");
    rerender(<Messages {...props} mutedConversations={new Set([account])} />);
    expect(box().getAttribute("aria-checked")).toBe("true");
    const list = screen.getByRole("listbox", { name: "Conversations" });
    expect(within(list).getByRole("img", { name: "Do Not Disturb" })).toBeTruthy();
  });
});
