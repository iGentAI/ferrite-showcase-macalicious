import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readOutbox, writeOutbox } from "./messages-outbox";

/*
 * What is on its way to the shared room survives a reload: the served window, with the server's
 * answers and its feed standing in for the desktop's Ferrite application.
 */

const KEPT = "me#room/desktop";
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

class SilentFeed {
  addEventListener() {}
  close() {}
}

const posts: { key: string | null; text: string }[] = [];
let answerPost: () => Response | Promise<Response>;

const serve = () =>
  vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/messages/me") return json({ author: "me", name: "me" });
    if (init?.method === "POST" && url === "/api/messages/rooms/desktop") {
      posts.push({
        key: new Headers(init.headers).get("idempotency-key"),
        text: (JSON.parse(String(init.body)) as { text: string }).text,
      });
      return answerPost();
    }
    return json({});
  });

const open = async () => {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.resetModules();
  const { messagesApp } = await import("./app");
  const Window = messagesApp.component;
  return render(<Window />);
};

beforeEach(() => {
  posts.length = 0;
  window.localStorage.clear();
  vi.stubGlobal("EventSource", SilentFeed);
  vi.stubGlobal("fetch", serve());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the shared room's outbox", () => {
  it("sends what was left with its own key when the window opens, and then forgets it", async () => {
    writeOutbox(
      KEPT,
      [
        {
          conversation: "ferrite-room",
          key: "k1",
          text: "left behind",
          at: "2026-01-01T10:00",
          written: Date.now(),
        },
      ],
      new Set(),
    );
    answerPost = () =>
      json({
        message: { seq: 1, author: "me", name: "me", text: "left behind", at_ms: 1, key: "k1" },
      });
    await open();
    await waitFor(() => expect(posts).toEqual([{ key: "k1", text: "left behind" }]));
    await waitFor(() => expect(readOutbox(KEPT)).toEqual([]));
    expect(posts).toHaveLength(1);
  });

  it("keeps what is sent until the server has taken it", async () => {
    let answer: (response: Response) => void = () => {};
    answerPost = () =>
      new Promise((resolve) => {
        answer = resolve;
      });
    await open();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const field = await screen.findByRole("textbox", { name: "Message" });
    await waitFor(() => expect(window.localStorage.length).toBeGreaterThanOrEqual(0));
    await user.type(field, "on its way{Enter}");
    await waitFor(() =>
      expect(readOutbox(KEPT).map((entry) => entry.text)).toEqual(["on its way"]),
    );
    const [entry] = readOutbox(KEPT);
    await waitFor(() => expect(posts[0]?.key).toBe(entry?.key));
    answer(
      json({
        message: {
          seq: 2,
          author: "me",
          name: "me",
          text: "on its way",
          at_ms: 2,
          key: entry?.key,
        },
      }),
    );
    await waitFor(() => expect(readOutbox(KEPT)).toEqual([]));
  });

  it("does not mistake the room's records for a conversation's", () => {
    writeOutbox(
      KEPT,
      [{ conversation: "ferrite-room", key: "k", text: "t", at: "a", written: 1 }],
      new Set(),
    );
    expect(readOutbox("me")).toEqual([]);
  });
});
