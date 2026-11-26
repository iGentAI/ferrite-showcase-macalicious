import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { takeHelpRequest } from "../desktop/desktop-help";
import {
  type ConvMessage,
  type ConvState,
  NO_TAPBACK_TO_REMOVE,
  TAPBACK_OLDER,
  useAccountConversations,
} from "./messages-accounts";
import {
  MessagesPreferences,
  SERVED_UNAVAILABLE,
  SIGN_OUT_UNAVAILABLE,
} from "./messages-preferences";

// Messages' dimmed controls say why (round 3, R6 bundle 02). Before: the Preferences' Help buttons had no action and
// said nothing when pressed, Sign Out was dimmed with no reason, and the tapback menu dimmed every tapback of a message
// loaded with Load Earlier Messages, and Remove Tapback on a message without one's own tapback, with no reason either.
// The Help buttons open Help Viewer on the served desktop, which has a book on Messages; the component alone draws them
// as the reference screenshots show.

const dimmed = (element: HTMLElement) =>
  element.getAttribute("aria-disabled") === "true" ||
  element.hasAttribute("data-disabled") ||
  element.hasAttribute("disabled");

describe("Messages Preferences' dimmed controls", () => {
  it("dim Sign Out with its reason, and what a host says has nothing to act on", async () => {
    const user = userEvent.setup();
    render(<MessagesPreferences unavailable={SERVED_UNAVAILABLE} account="ann" />);
    const history = screen.getByRole("checkbox", {
      name: "Save history when conversations are closed",
    });
    expect(dimmed(history)).toBe(true);
    expect(history.closest("[title]")?.getAttribute("title")).toBe(SERVED_UNAVAILABLE.saveHistory);
    expect(dimmed(screen.getByRole("checkbox", { name: "Play sound effects" }))).toBe(false);
    await user.click(screen.getByRole("tab", { name: "iMessage" }));
    screen.getByText("Account: ann");
    expect(screen.queryByText(/Apple ID/)).toBeNull();
    const signOut = screen.getByRole("button", { name: "Sign Out" });
    expect(dimmed(signOut)).toBe(true);
    expect(signOut.getAttribute("title")).toBe(SIGN_OUT_UNAVAILABLE);
  });

  it("draw Help enabled, as captured, without a host", async () => {
    const user = userEvent.setup();
    render(<MessagesPreferences />);
    for (const pane of ["General", "iMessage"]) {
      await user.click(screen.getByRole("tab", { name: pane }));
      const help = screen.getByRole("button", { name: "Help" });
      expect(dimmed(help)).toBe(false);
      expect(help.getAttribute("title")).toBeNull();
    }
  });

  it("as the served desktop hosts them, Help opens Help Viewer on Messages", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.resetModules();
    const { messagesApp } = await import("./app");
    const { takeHelpRequest: taken } = await import("../desktop/desktop-help");
    const Hosted = messagesApp.preferences.component;
    render(<Hosted />);
    await userEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(taken()).toBe("Messages");
    vi.unstubAllEnvs();
  });

  it("elsewhere, Help is drawn as captured and asks for nothing", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "");
    vi.resetModules();
    const { messagesApp } = await import("./app");
    const Hosted = messagesApp.preferences.component;
    render(<Hosted />);
    await userEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(takeHelpRequest()).toBeNull();
    vi.unstubAllEnvs();
  });
});

const ID = `c-${"a1".repeat(16)}`;
const person = (name: string) => ({ name, full_name: name.toUpperCase() });
const message = (seq: number, text: string, tapbacks?: Record<string, string>): ConvMessage => ({
  seq,
  author: "martin",
  name: "MARTIN",
  text,
  at_ms: seq * 60_000,
  ...(tapbacks ? { tapbacks } : {}),
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the tapback menu's dimmed items", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("say why: an older message takes no tapback, and there is none of one's own to remove", async () => {
    // Messages 2 and 3 are the conversation's newest (2 carries Chris's Love); 1 comes with Load Earlier Messages.
    const conversation: ConvState = {
      members: [person("chris"), person("martin")],
      messages: [message(2, "two", { chris: "love" }), message(3, "three")],
      read: {},
      typing: {},
      pages: 1,
      older: "p1",
      last: 3,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const path = new URL(String(input), "http://desktop.test").pathname;
        if (path === "/api/messages/conversations") {
          return Promise.resolve(
            json({
              conversations: [
                {
                  id: ID,
                  members: conversation.members,
                  last: message(3, "three"),
                  unread: 0,
                  at_ms: 3,
                },
              ],
            }),
          );
        }
        if (path === `/api/messages/conversations/${ID}`) {
          return Promise.resolve(json({ state: conversation }));
        }
        if (path === `/api/messages/conversations/${ID}/history`) {
          return Promise.resolve(json({ messages: [message(1, "one")], prev: null }));
        }
        if (path === "/api/messages/me") return Promise.resolve(json({ name: "chris" }));
        if (path.endsWith("/read")) return Promise.resolve(json({ ok: true }));
        return Promise.resolve(json({ people: [] }));
      }),
    );
    const user = userEvent.setup();
    const { result } = renderHook(() => useAccountConversations(true, true));
    act(() => result.current.onConversationChange(ID));
    await waitFor(() => expect(result.current.props.transcriptStart?.get(ID)).toBeTruthy());
    const start = render(<div>{result.current.props.transcriptStart?.get(ID)}</div>);
    await user.click(
      within(start.container).getByRole("button", { name: "Load Earlier Messages" }),
    );
    await waitFor(() =>
      expect(result.current.held.get(ID)?.some((each) => each.id === "c1")).toBe(true),
    );
    start.unmount();

    // Opens message `seq`'s pull-down and answers its items by name; closes it with `done()`.
    const menuOf = async (seq: number) => {
      const shown = result.current.held.get(ID)?.find((each) => each.id === `c${seq}`);
      if (!shown) throw new Error(`message ${seq} is not shown`);
      const view = render(<div>{result.current.props.renderMessageExtras?.(ID, shown)}</div>);
      await user.click(
        within(view.container).getByRole("button", { name: `Tapback or reply to message ${seq}` }),
      );
      await waitFor(() => expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0));
      const item = (name: RegExp) => screen.getByRole("menuitem", { name });
      const done = async () => {
        await user.keyboard("{Escape}");
        view.unmount();
      };
      return { item, done };
    };

    const older = await menuOf(1);
    for (const label of [
      /Love/,
      /Like$/,
      /Dislike/,
      /Laugh/,
      /Emphasize/,
      /Question/,
      /Remove Tapback/,
    ]) {
      expect(dimmed(older.item(label))).toBe(true);
      expect(older.item(label).getAttribute("title")).toBe(TAPBACK_OLDER);
    }
    await older.done();

    const recent = await menuOf(3);
    expect(dimmed(recent.item(/Love/))).toBe(false);
    expect(recent.item(/Love/).getAttribute("title")).toBeNull();
    expect(dimmed(recent.item(/Remove Tapback/))).toBe(true);
    expect(recent.item(/Remove Tapback/).getAttribute("title")).toBe(NO_TAPBACK_TO_REMOVE);
    await recent.done();

    const mine = await menuOf(2);
    expect(dimmed(mine.item(/Remove Tapback/))).toBe(false);
    expect(mine.item(/Remove Tapback/).getAttribute("title")).toBeNull();
    await mine.done();
  });
});
