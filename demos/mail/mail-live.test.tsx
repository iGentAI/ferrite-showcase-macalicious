import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow, type ManagedWindowRenderProps } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { Mail } from "./mail";
import { MailCompose } from "./mail-compose";
import type { MailDraft, MailMessage } from "./mail-data";
import {
  addressOf,
  headersOf,
  MailLive,
  ServedBody,
  type ServerHeader,
  toMailMessage,
} from "./mail-live";

// The server-backed Mail (`mail-live.tsx`) and the viewer's controlled mode it drives. The
// server itself is exercised by `ferrite-apps/desktop/tests/mail.rs` and the browser journey
// `ferrite-apps/desktop/e2e/mail-journey.mjs`; here the viewer is given messages directly.

const header = (change: Partial<ServerHeader> = {}): ServerHeader => ({
  id: "fffffe6c1d2a3b4c-0123456789abcdef",
  mailbox: "inbox",
  from: { name: "martin", full_name: "Martin Klein" },
  to: [{ name: "chris", full_name: "Chris Carter" }],
  cc: [{ name: "ann", full_name: "Ann Lee" }],
  subject: "Saturday",
  at_ms: Date.UTC(2026, 9, 14, 18, 30),
  unread: true,
  muted: false,
  text: "Meet at the pier.",
  html: false,
  ...change,
});

const ME = "Chris Carter <chris@macalicious>";

const held = (messages: readonly MailMessage[], props = {}) =>
  render(<Mail messages={[]} defaultMessage={null} heldMessages={messages} me={ME} {...props} />);

describe("the server's messages", () => {
  it("reads only what is a message list, and addresses people by account", () => {
    expect(headersOf({ messages: [header(), { id: 1 }, null] })).toHaveLength(1);
    expect(headersOf({ nope: [] })).toBeNull();
    expect(addressOf({ name: "martin", full_name: "Martin Klein" })).toBe(
      "Martin Klein <martin@macalicious>",
    );
    // An account with no full name has the same mailbox, never a second address.
    expect(addressOf({ name: "mart", full_name: "" })).toBe("mart@macalicious");
  });

  it("keeps a draft's recipients as they were typed", () => {
    const draft = toMailMessage(
      header({ mailbox: "drafts", to: [{ name: "mart", full_name: "" }], cc: [] }),
    );
    expect(draft.toAddresses).toEqual(["mart"]);
  });

  it("shows full names, addresses replies to accounts and takes the loaded text", () => {
    const message = toMailMessage(header());
    expect(message.from).toBe("Martin Klein");
    expect(message.fromAddress).toBe("Martin Klein <martin@macalicious>");
    expect(message.toAddresses).toEqual([ME]);
    expect(message.cc).toEqual(["Ann Lee <ann@macalicious>"]);
    expect(message.body).toBe("Meet at the pier.");
    const loaded = toMailMessage(header(), {
      text: "Meet at the pier.\n\nMartin",
      html: "<b>x</b>",
    });
    expect(loaded.body).toBe("Meet at the pier.\n\nMartin");
    expect(loaded.html).toBe("<b>x</b>");
  });
});

describe("the viewer with messages its owner holds", () => {
  it("reports reading, flagging and moving instead of changing the messages itself", async () => {
    const onMessageChange = vi.fn();
    held([toMailMessage(header())], { onMessageChange });
    const list = screen.getByRole("listbox", { name: "Messages" });
    await userEvent.click(within(list).getByRole("option", { name: /Martin Klein/ }));
    expect(onMessageChange).toHaveBeenCalledWith(header().id, { unread: false });
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onMessageChange).toHaveBeenCalledWith(header().id, { mailbox: "archive" });
    // The owner had not applied the change, so the message is still listed in the Inbox.
    expect(within(list).getByRole("option", { name: /Martin Klein/ })).toBeTruthy();
  });

  it("erases a message the Trash holds, through the owner", async () => {
    const onErase = vi.fn();
    const onMessageChange = vi.fn();
    held([toMailMessage(header({ mailbox: "trash", unread: false }))], {
      onErase,
      onMessageChange,
      defaultMailbox: "trash",
    });
    await userEvent.click(screen.getByRole("option", { name: /Martin Klein/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onErase).toHaveBeenCalledWith(header().id);
    expect(onMessageChange).not.toHaveBeenCalledWith(header().id, { mailbox: "trash" });
  });

  it("replies to the sender's account and to all of the others, never to oneself", async () => {
    held([toMailMessage(header({ unread: false }))]);
    await userEvent.click(screen.getByRole("option", { name: /Martin Klein/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reply All" }));
    const compose = await screen.findByRole("region", { name: "Re: Saturday" });
    const to = within(compose).getByRole("listbox", { name: "To recipients" });
    expect(to.textContent).toContain("Martin Klein <martin@macalicious>");
    const cc = within(compose).getByRole("listbox", { name: "Cc recipients" });
    expect(cc.textContent).toContain("Ann Lee <ann@macalicious>");
    expect(cc.textContent).not.toContain("chris@macalicious");
  });

  it("closes the New Message window only once the owner has sent it", async () => {
    let settle: (sent: boolean) => void = () => {};
    const onSend = vi.fn(
      (_draft: MailDraft, _from: { draftId?: string }) =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    held([], { onSend });
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));
    const compose = screen.getByRole("region", { name: "New Message" });
    const to = within(compose).getByLabelText("To:");
    await userEvent.type(to, "martin{Enter}");
    fireEvent.click(within(compose).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0]?.[0]).toMatchObject({ to: ["martin"] });
    // Refused: the window stays, with what was typed, and can send again.
    settle(false);
    const send = within(compose).getByRole("button", { name: "Send" });
    await waitFor(() => expect(send).not.toBeDisabled());
    expect(screen.getByRole("region", { name: "New Message" })).toBeTruthy();
    fireEvent.click(send);
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
    settle(true);
    await waitFor(() => expect(screen.queryByRole("region", { name: "New Message" })).toBeNull());
  });

  it("keeps the New Message window usable when the owner's send throws at once", async () => {
    const onSend = vi.fn(() => {
      throw new Error("no network");
    });
    held([], { onSend });
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));
    const compose = screen.getByRole("region", { name: "New Message" });
    await userEvent.type(within(compose).getByLabelText("To:"), "martin{Enter}");
    const send = within(compose).getByRole("button", { name: "Send" });
    fireEvent.click(send);
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    // Not frozen: Send is offered again and the window still holds the message.
    await waitFor(() => expect(send).not.toBeDisabled());
    expect(within(compose).getByRole("listbox", { name: "To recipients" }).textContent).toContain(
      "martin",
    );
    fireEvent.click(send);
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
  });

  it("keeps a closed New Message window that holds something as a draft, and opens a draft again", async () => {
    const onSaveDraft = vi.fn();
    const draft = toMailMessage(
      header({
        mailbox: "drafts",
        unread: false,
        to: [{ name: "martin", full_name: "" }],
        cc: [],
        subject: "Plan",
        text: "first",
      }),
    );
    held([draft], { onSaveDraft, defaultMailbox: "drafts" });
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));
    const compose = screen.getByRole("region", { name: "New Message" });
    fireEvent.change(within(compose).getByLabelText("Subject:"), { target: { value: "Hello" } });
    fireEvent.click(
      within(screen.getByRole("region", { name: "Hello" })).getByRole("button", { name: /close/i }),
    );
    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Hello" }),
      undefined,
    );

    // Return on the saved draft opens it, and closing it saves over the same draft.
    await userEvent.click(screen.getByRole("option", { name: /Martin Klein|martin/ }));
    await userEvent.keyboard("{Enter}");
    const opened = await screen.findByRole("region", { name: "Plan" });
    expect(within(opened).getByRole("listbox", { name: "To recipients" }).textContent).toContain(
      "martin",
    );
    fireEvent.click(within(opened).getByRole("button", { name: /close/i }));
    expect(onSaveDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ subject: "Plan" }),
      draft.id,
    );
  });

  it("keeps the New Message window open while its draft cannot be kept, and never replaces it", async () => {
    const onSaveDraft = vi.fn(async (_draft: MailDraft, _id?: string) => false);
    held([], { onSaveDraft });
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));
    fireEvent.change(
      within(screen.getByRole("region", { name: "New Message" })).getByLabelText("Subject:"),
      { target: { value: "Keep me" } },
    );
    const compose = screen.getByRole("region", { name: "Keep me" });
    fireEvent.click(within(compose).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("region", { name: "Keep me" })).toBeTruthy();
    // New Message brings the open window forward rather than replace what it holds.
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));
    expect(screen.getByRole("region", { name: "Keep me" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "New Message" })).toBeNull();
    // Kept at last: the window closes.
    onSaveDraft.mockImplementation(async () => true);
    fireEvent.click(within(compose).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Keep me" })).toBeNull());
  });
});

describe("the New Message window's close button", () => {
  it("keeps the draft first, whatever close the controls were given", () => {
    const onClose = vi.fn();
    const bypass = vi.fn();
    const onDraftClose = vi.fn(() => false);
    render(
      <MailCompose
        onClose={onClose}
        onDraftClose={onDraftClose}
        controlsProps={{ onClose: bypass }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onDraftClose).toHaveBeenCalledTimes(1);
    // The draft was not kept: nothing closes the window, the controls' own close included.
    expect(bypass).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    onDraftClose.mockImplementation(() => true);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(bypass).not.toHaveBeenCalled();
  });

  it("does not close a window whose message is being sent", () => {
    const onClose = vi.fn();
    render(<MailCompose sending onClose={onClose} controlsProps={{ onClose }} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes through the controls' own close when no other is given, after keeping the draft", () => {
    const controlsClose = vi.fn();
    const onDraftClose = vi.fn(() => false);
    render(<MailCompose onDraftClose={onDraftClose} controlsProps={{ onClose: controlsClose }} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(controlsClose).not.toHaveBeenCalled();
    onDraftClose.mockImplementation(() => true);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(controlsClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * A stand-in for the desktop's Mail server in the browser's `fetch`: `headers` are listed in
 * pages of `page`, a `PATCH` waits until `release` is called, and every request is recorded.
 */
function fakeMailServer(
  headers: ServerHeader[],
  page = 500,
  send: (key: string | null) => Response = () => new Response("{}", { status: 503 }),
) {
  const calls: string[] = [];
  const held: (() => void)[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://desktop.test");
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.pathname}${url.search}`);
    if (url.pathname === "/api/mail/me") {
      return json({ name: "chris", full_name: "Chris Carter", address: "chris@macalicious" });
    }
    if (url.pathname === "/api/contacts/people") return json({ people: [] });
    if (url.pathname === "/api/mail/send") {
      return send(new Headers(init?.headers).get("idempotency-key"));
    }
    if (url.pathname === "/api/mail/drafts")
      return json({ message: header({ mailbox: "drafts" }) });
    if (url.pathname === "/api/mail/messages" && method === "GET") {
      const after = url.searchParams.get("after");
      const start = after ? headers.findIndex((each) => each.id === after) + 1 : 0;
      const slice = headers.slice(start, start + page);
      const next = start + page < headers.length ? (slice.at(-1)?.id ?? null) : null;
      return json({ messages: slice, address: "chris@macalicious", next });
    }
    const id = url.pathname.split("/").at(-1) ?? "";
    const stored = headers.find((each) => each.id === id);
    if (method === "PATCH" && stored) {
      const change = JSON.parse(String(init?.body)) as Partial<ServerHeader>;
      await new Promise<void>((resolve) => held.push(resolve));
      Object.assign(stored, change);
      return json({ message: stored });
    }
    if (stored) return json({ message: stored, text: stored.text, html: null });
    return json({ error: "no such message" }, 404);
  });
  vi.stubGlobal("fetch", fetch);
  return { calls, release: () => held.shift()?.(), held };
}

describe("MailLive on the served desktop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps a flag whose change is still being sent when the mailboxes are read again", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const server = fakeMailServer([header({ unread: false })]);
    render(<MailLive />);
    const list = await screen.findByRole("listbox", { name: "Messages" });
    await userEvent.click(await within(list).findByRole("option", { name: /Martin Klein/ }));
    fireEvent.click(screen.getByRole("button", { name: "Flag" }));
    await waitFor(() => expect(server.held).toHaveLength(1));
    expect(within(list).getByLabelText("Red flag")).toBeTruthy();
    // Read again while the change is unanswered: the server still lists the message unflagged.
    const reads = server.calls.filter((call) => call === "GET /api/mail/messages").length;
    fireEvent.focus(window);
    await waitFor(() =>
      expect(server.calls.filter((call) => call === "GET /api/mail/messages")).toHaveLength(
        reads + 1,
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(within(list).getByLabelText("Red flag")).toBeTruthy();
    // Answered: the server's copy, flagged, is shown.
    server.release();
    await waitFor(() => expect(server.held).toHaveLength(0));
    expect(within(list).getByLabelText("Red flag")).toBeTruthy();
  });

  it("says older messages are not loaded, and Load More reads the next page", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const many = Array.from({ length: 5 }, (_, n) =>
      header({
        id: `fffffe6c1d2a3b4${n}-0123456789abcdef`,
        subject: `Letter ${n}`,
        unread: false,
      }),
    );
    // Two pages of two are read at first; the fifth message is on the third page.
    const server = fakeMailServer(many, 2);
    render(<MailLive />);
    const list = await screen.findByRole("listbox", { name: "Messages" });
    await within(list).findByRole("option", { name: /Letter 3/ });
    expect(within(list).queryByRole("option", { name: /Letter 4/ })).toBeNull();
    const alert = await screen.findByText(/Older messages are not loaded/);
    fireEvent.click(within(alert).getByRole("button", { name: "Load More" }));
    await within(list).findByRole("option", { name: /Letter 4/ });
    await waitFor(() => expect(screen.queryByText(/Older messages are not loaded/)).toBeNull());
    expect(server.calls.filter((call) => call.startsWith("GET /api/mail/messages?"))).toContain(
      `GET /api/mail/messages?after=${many[3]?.id}`,
    );
  });

  it("holds a message whose send has no known outcome, and sends it again under the same key", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const keys: (string | null)[] = [];
    fakeMailServer([], 500, (key) => {
      keys.push(key);
      // The first send is not answered as it should be; the second is stored.
      return keys.length === 1
        ? new Response("", { status: 502 })
        : new Response(JSON.stringify({ message: header({ mailbox: "sent" }), delivered: [] }), {
            status: 201,
            headers: { "content-type": "application/json" },
          });
    });
    render(<MailLive />);
    fireEvent.click(await screen.findByRole("button", { name: "New Message" }));
    const compose = screen.getByRole("region", { name: "New Message" });
    await userEvent.type(within(compose).getByLabelText("To:"), "martin{Enter}");
    fireEvent.click(within(compose).getByRole("button", { name: "Send" }));
    await within(compose).findByText(/could not tell whether the message was sent/);
    // Held: what is sent next is what was sent, so nothing in the window can change, and it
    // cannot be closed into a draft that would be sent under another key.
    const send = within(compose).getByRole("button", { name: "Send" });
    expect(send).not.toBeDisabled();
    expect(compose.querySelector(".mac-mail-compose-body")?.hasAttribute("inert")).toBe(true);
    fireEvent.click(within(compose).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("region", { name: "New Message" })).toBeTruthy();
    fireEvent.click(send);
    await waitFor(() => expect(screen.queryByRole("region", { name: "New Message" })).toBeNull());
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it("keeps a held message's window open when the desktop is asked to close it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    fakeMailServer([], 500, () => new Response("", { status: 502 }));
    // The desktop's window, with what File > Close Window does to it: ask the application.
    function DesktopWindow(props: DesktopSecondaryWindowProps) {
      return (
        <div data-window-id={props.id}>
          <button type="button" onClick={props.onClose}>
            Close Window
          </button>
          <WindowManager>
            <ManagedWindow
              id={`mail:${props.id}`}
              app="mail"
              render={() =>
                props.render({ onClose: props.onClose } as unknown as ManagedWindowRenderProps)
              }
            />
          </WindowManager>
        </div>
      );
    }
    render(<MailLive DesktopWindow={DesktopWindow} />);
    fireEvent.click(await screen.findByRole("button", { name: "New Message" }));
    const compose = await screen.findByRole("region", { name: "New Message" });
    await userEvent.type(within(compose).getByLabelText("To:"), "martin{Enter}");
    fireEvent.click(within(compose).getByRole("button", { name: "Send" }));
    await within(compose).findByText(/could not tell whether the message was sent/);
    fireEvent.click(screen.getByRole("button", { name: "Close Window" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole("region", { name: "New Message" })).toBeTruthy();
    // Let go, the same close keeps it as a draft and closes it.
    fireEvent.click(within(compose).getByRole("button", { name: "Edit Anyway" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Window" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "New Message" })).toBeNull());
  });

  it("lets a held message go when the person chooses to edit it anyway", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const keys: (string | null)[] = [];
    fakeMailServer([], 500, (key) => {
      keys.push(key);
      return new Response("", { status: 502 });
    });
    render(<MailLive />);
    fireEvent.click(await screen.findByRole("button", { name: "New Message" }));
    const compose = screen.getByRole("region", { name: "New Message" });
    await userEvent.type(within(compose).getByLabelText("To:"), "martin{Enter}");
    fireEvent.click(within(compose).getByRole("button", { name: "Send" }));
    fireEvent.click(await within(compose).findByRole("button", { name: "Edit Anyway" }));
    await within(compose).findByText(/sending it again delivers it twice/);
    expect(compose.querySelector(".mac-mail-compose-body")?.hasAttribute("inert")).toBe(false);
    // A send now is a new one, under a new key.
    fireEvent.click(within(compose).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("saves a draft again under the same key when its answer was lost, and a changed draft under a new one", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    fakeMailServer([]);
    const served = globalThis.fetch;
    const saves: { key: string | null; subject: string }[] = [];
    const answers = [502, 0, 200];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (new URL(String(input), "http://desktop.test").pathname !== "/api/mail/drafts") {
          return served(input, init);
        }
        saves.push({
          key: new Headers(init?.headers).get("idempotency-key"),
          subject: (JSON.parse(String(init?.body)) as { subject: string }).subject,
        });
        const status = answers[saves.length - 1] ?? 200;
        // 0: the answer never arrives in one piece.
        if (status === 0) throw new TypeError("network");
        return new Response(JSON.stringify({ message: header({ mailbox: "drafts" }) }), {
          status,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    render(<MailLive />);
    fireEvent.click(await screen.findByRole("button", { name: "New Message" }));
    fireEvent.change(
      within(screen.getByRole("region", { name: "New Message" })).getByLabelText("Subject:"),
      { target: { value: "Keep me" } },
    );
    const close = () =>
      fireEvent.click(
        within(screen.getByRole("region", { name: /Keep me/ })).getByRole("button", {
          name: /close/i,
        }),
      );
    close();
    await screen.findByText(/The draft could not be saved|close the window again/i);
    expect(screen.getByRole("region", { name: "Keep me" })).toBeTruthy();
    // Changed before the next close: a new save, with a new key.
    fireEvent.change(
      within(screen.getByRole("region", { name: "Keep me" })).getByLabelText("Subject:"),
      { target: { value: "Keep me too" } },
    );
    close();
    await waitFor(() => expect(saves).toHaveLength(2));
    await screen.findByRole("region", { name: "Keep me too" });
    // The same draft closed again: the save whose answer was lost, under its own key.
    close();
    await waitFor(() => expect(screen.queryByRole("region", { name: /Keep me/ })).toBeNull());
    expect(saves.map((save) => save.subject)).toEqual(["Keep me", "Keep me too", "Keep me too"]);
    expect(saves[0]?.key).toBeTruthy();
    expect(saves[1]?.key).not.toBe(saves[0]?.key);
    expect(saves[2]?.key).toBe(saves[1]?.key);
  });

  it("reads the mailboxes again when the person's Mail changes elsewhere", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const server = fakeMailServer([header()]);
    render(<MailLive />);
    await screen.findByRole("option", { name: /Martin Klein/ });
    const reads = () => server.calls.filter((call) => call === "GET /api/mail/messages").length;
    await waitFor(() => expect(reads()).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const before = reads();
    window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "notes" } }));
    window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "mail" } }));
    await waitFor(() => expect(reads()).toBe(before + 1));
  });

  it("reads the mailboxes once at a time: a read asked for during one waits for it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const server = fakeMailServer([header()]);
    render(<MailLive />);
    await screen.findByRole("option", { name: /Martin Klein/ });
    const before = server.calls.filter((call) => call === "GET /api/mail/messages").length;
    fireEvent.focus(window);
    fireEvent.focus(window);
    fireEvent.focus(window);
    await waitFor(() =>
      expect(
        server.calls.filter((call) => call === "GET /api/mail/messages").length,
      ).toBeGreaterThan(before),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    // The first focus reads; the two during it make one read after it, not two.
    expect(server.calls.filter((call) => call === "GET /api/mail/messages")).toHaveLength(
      before + 2,
    );
  });
});

describe("a served message's text", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is asked for again on the next attempt after it could not be read", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValue(
        new Response(JSON.stringify({ text: "The whole letter.", html: null }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    const onLoaded = vi.fn();
    const onFailed = vi.fn();
    const view = render(
      <ServedBody header={header()} attempt={1} onLoaded={onLoaded} onFailed={onFailed} />,
    );
    await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toBe(
      "The rest of this message could not be loaded.",
    );
    expect(onLoaded).not.toHaveBeenCalled();
    // Get Mail: the next attempt reads it.
    view.rerender(
      <ServedBody header={header()} attempt={2} onLoaded={onLoaded} onFailed={onFailed} />,
    );
    await waitFor(() =>
      expect(onLoaded).toHaveBeenCalledWith({ text: "The whole letter.", html: null }),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is not asked for again while it is still being read", async () => {
    let answer: (response: Response) => void = () => {};
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const onLoaded = vi.fn();
    const view = render(
      <ServedBody header={header()} attempt={1} onLoaded={onLoaded} onFailed={() => {}} />,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    view.rerender(
      <ServedBody header={header()} attempt={2} onLoaded={onLoaded} onFailed={() => {}} />,
    );
    answer(new Response(JSON.stringify({ text: "Slow letter.", html: null }), { status: 200 }));
    await waitFor(() =>
      expect(onLoaded).toHaveBeenCalledWith({ text: "Slow letter.", html: null }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("MailLive", () => {
  it("is the plain viewer over its invented messages outside the desktop app", () => {
    render(<MailLive />);
    expect(screen.getByRole("option", { name: /Harbor Ferry Company/ })).toBeTruthy();
  });
});
