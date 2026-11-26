import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountsDesktop, CHANNEL } from "./desktop-accounts";
import { REQUEST_DEADLINE_MS } from "./desktop-server";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const name of document.cookie.split(";").map((pair) => pair.trim().split("=")[0])) {
    if (!name?.startsWith("mac_lock")) continue;
    // biome-ignore lint/suspicious/noDocumentCookie: the tests clear the lock cookies a test left
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
});

describe("the account requests", () => {
  it("end a session check the server never answers with the error the page recovers from", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    // The server takes every request and never replies.
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    render(<AccountsDesktop />);
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS + 1_000);
    });
    expect(fetch).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("could not reach its server");
  });

  it("end a session check whose reply never finishes the same way", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    // The server answers, but the body of its reply never ends.
    const fetch = vi.fn(
      async () => new Response(new ReadableStream({ start() {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<AccountsDesktop />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS + 1_000);
    });
    expect(fetch).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("could not reach its server");
  });

  it("show the error too when a refresh superseded the first read and then failed", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    render(<AccountsDesktop />);
    // The tab comes to the front while its first read is still waiting: a refresh replaces it.
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * REQUEST_DEADLINE_MS + 1_000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("could not reach its server");
  });
});

/** A signed-in person's session, and a server that answers `/api/session/<path>` with `answer`. */
function signedIn(answer: (path: string) => Promise<Response> | null) {
  const base = {
    session: "s".repeat(64),
    account: { name: "ada", full_name: "Ada", guest: false },
  };
  const state = { locked: false };
  const fetch = vi.fn((url: string) => {
    const path = String(url).split("?")[0] ?? "";
    const custom = answer(path);
    if (custom) return custom;
    if (path === "/api/session") {
      return Promise.resolve(new Response(JSON.stringify({ ...base, ...state }), { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 404 }));
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, state };
}

const covered = () =>
  document.querySelector(".mac-desktop-login-behind")?.hasAttribute("data-covered") ?? false;

describe("Lock Screen and Log Out", () => {
  it("tell the person when Lock Screen fails, and try it again", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let locks = 0;
    let cookieAtLock = "";
    signedIn((path) => {
      if (path !== "/api/session/lock") return null;
      locks += 1;
      cookieAtLock = document.cookie;
      return Promise.resolve(new Response(JSON.stringify({ error: "down" }), { status: 503 }));
    });
    render(<AccountsDesktop />);
    await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Lock Screen/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The screen could not be locked.");
    // The browser carried the lock cookie while its lock was on its way, and still does after a
    // failure (another tab's lock may be on its way): it expires on its own.
    expect(cookieAtLock).toMatch(/mac_lock_[a-z0-9]+=1/);
    expect(document.cookie).toMatch(/mac_lock_[a-z0-9]+=1/);
    // The desktop is back as it was, unlocked: the server did not lock it.
    expect(covered()).toBe(false);
    await user.click(within(alert).getByRole("button", { name: "Try Again" }));
    await waitFor(() => expect(locks).toBe(2));
  });

  it("clear the lock cookie once the server has locked the session", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let cookieAtLock = "";
    const server = signedIn((path) => {
      if (path !== "/api/session/lock") return null;
      cookieAtLock = document.cookie;
      server.state.locked = true;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            session: "s".repeat(64),
            account: { name: "ada", full_name: "Ada", guest: false },
            locked: true,
          }),
          { status: 200 },
        ),
      );
    });
    render(<AccountsDesktop />);
    await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Lock Screen/ }));
    await waitFor(() => expect(cookieAtLock).toMatch(/mac_lock_[a-z0-9]+=1/));
    await waitFor(() => expect(document.cookie).not.toContain("mac_lock"));
    expect(covered()).toBe(true);
  });

  it("leave another lock attempt's cookie when one succeeds", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let answer: (response: Response) => void = () => {};
    signedIn((path) =>
      path === "/api/session/lock"
        ? new Promise<Response>((resolve) => {
            answer = resolve;
          })
        : null,
    );
    render(<AccountsDesktop />);
    await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Lock Screen/ }));
    // Meanwhile another tab of this browser starts a lock of its own.
    // biome-ignore lint/suspicious/noDocumentCookie: the other tab's lock cookie
    document.cookie = "mac_lock_other=1; Path=/; Max-Age=20";
    const mine = document.cookie
      .split(";")
      .map((pair) => pair.trim().split("=")[0])
      .find((name) => name?.startsWith("mac_lock_") && name !== "mac_lock_other");
    const locked = {
      session: "s".repeat(64),
      account: { name: "ada", full_name: "Ada", guest: false },
      locked: true,
    };
    await act(async () => {
      answer(new Response(JSON.stringify(locked), { status: 200 }));
    });
    // This attempt's success deletes its own cookie and leaves the other attempt's protection.
    expect(mine).toBeDefined();
    expect(document.cookie).not.toContain(`${mine}=`);
    expect(document.cookie).toContain("mac_lock_other=1");
  });

  it("show the lock screen when a lock the server made answers too late", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ pointerEventsCheck: 0, advanceTimers: vi.advanceTimersByTime });
    const server = signedIn((path) => {
      if (path !== "/api/session/lock") return null;
      // The server locks, but its reply never arrives.
      server.state.locked = true;
      return new Promise<Response>(() => {});
    });
    render(<AccountsDesktop />);
    await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Lock Screen/ }));
    // The lock screen shows at once, before the server answers.
    expect(covered()).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS + 1_000);
    });
    // The session is read again and found locked: the lock screen stays, and no error offers the
    // desktop back.
    await waitFor(() => expect(covered()).toBe(true));
    expect(
      server.fetch.mock.calls.filter(([url]) => String(url).split("?")[0] === "/api/session")
        .length,
    ).toBeGreaterThan(1);
    expect(screen.queryByText("The screen could not be locked.")).toBeNull();
  });

  it("tell the person when Log Out fails", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    signedIn((path) =>
      path === "/api/session/sign-out" ? Promise.reject(new TypeError("offline")) : null,
    );
    render(<AccountsDesktop />);
    await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Log Out/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You could not be logged out.");
  });

  it("keep the lock screen and offer Try Again when the lock and the session read both fail", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let offline = false;
    let locks = 0;
    signedIn((path) => {
      if (path === "/api/session/lock") {
        locks += 1;
        offline = true;
      }
      return offline ? Promise.reject(new TypeError("offline")) : null;
    });
    render(<AccountsDesktop />);
    await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Lock Screen/ }));
    // Neither the lock nor the read of the session after it reached the server: what the server
    // has is unknown, so the lock screen stays, and the failure shows over it with Try Again.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The screen could not be locked.");
    expect(covered()).toBe(true);
    await user.click(within(alert).getByRole("button", { name: "Try Again" }));
    await waitFor(() => expect(locks).toBe(2));
  });

  it("keep the lock screen while the lock is on its way, whatever a refresh reads meanwhile", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let answer: (response: Response) => void = () => {};
    const server = signedIn((path) =>
      path === "/api/session/lock"
        ? new Promise<Response>((resolve) => {
            answer = resolve;
          })
        : null,
    );
    const reads = () =>
      server.fetch.mock.calls.filter(([url]) => String(url).split("?")[0] === "/api/session")
        .length;
    render(<AccountsDesktop />);
    await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Lock Screen/ }));
    expect(covered()).toBe(true);
    // The tab comes to the front before the server has the lock: its read still finds the
    // session unlocked.
    const before = reads();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(reads()).toBe(before + 1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(covered()).toBe(true);
    // The lock is refused: the session is read again, found unlocked, and the desktop is back
    // with the error.
    await act(async () => {
      answer(new Response(JSON.stringify({ error: "down" }), { status: 503 }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("The screen could not be locked.");
    await waitFor(() => expect(covered()).toBe(false));
  });

  it("keep the lock screen when a read sent before the lock answers after it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const unlocked = {
      session: "s".repeat(64),
      account: { name: "ada", full_name: "Ada", guest: false },
      locked: false,
    };
    let lockAnswer: (response: Response) => void = () => {};
    const heldReads: ((response: Response) => void)[] = [];
    let holdReads = false;
    const server = signedIn((path) => {
      if (path === "/api/session/lock") {
        return new Promise<Response>((resolve) => {
          lockAnswer = resolve;
        });
      }
      if (path === "/api/session" && holdReads) {
        return new Promise<Response>((resolve) => {
          heldReads.push(resolve);
        });
      }
      return null;
    });
    render(<AccountsDesktop />);
    await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
    holdReads = true;
    await user.click(await screen.findByRole("menuitem", { name: /^Lock Screen/ }));
    // The tab comes to the front while the lock is on its way; the server reads the session
    // before it has the lock, but that answer is held back.
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(heldReads.length).toBe(1));
    // The lock succeeds; every read the page sends from now on is answered at once as locked.
    holdReads = false;
    server.state.locked = true;
    await act(async () => {
      lockAnswer(new Response(JSON.stringify({ ...unlocked, locked: true }), { status: 200 }));
    });
    // Only now does the read from before the lock arrive, saying unlocked. The lock's success
    // read the session again, so this older answer is not taken.
    await act(async () => {
      for (const answer of heldReads) {
        answer(new Response(JSON.stringify(unlocked), { status: 200 }));
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(covered()).toBe(true);
  });
});

/** Let a BroadcastChannel message arrive: it comes on the event loop. */
const delivered = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

describe("the news that the session changed", () => {
  it("is not answered by the page that announced it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const server = signedIn((path) => {
      if (path !== "/api/session/lock") return null;
      server.state.locked = true;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            session: "s".repeat(64),
            account: { name: "ada", full_name: "Ada", guest: false },
            locked: true,
          }),
          { status: 200 },
        ),
      );
    });
    const reads = () =>
      server.fetch.mock.calls.filter(([url]) => String(url).split("?")[0] === "/api/session")
        .length;
    render(<AccountsDesktop />);
    await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
    const before = reads();
    await user.click(await screen.findByRole("menuitem", { name: /^Lock Screen/ }));
    // The lock succeeds, and the page tells the browser's other tabs.
    await waitFor(() => expect(document.cookie).not.toContain("mac_lock"));
    await delivered();
    expect(covered()).toBe(true);
    // Its announcement reached its own listener too, and was passed by: no read of the session
    // followed. Answered, after Log Out that read found the session changed and loaded the page a
    // second time, cutting short the load Log Out had started.
    expect(reads()).toBe(before);
  });

  it("is answered when another tab announces it, from this build or an earlier one", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const server = signedIn(() => null);
    const reads = () =>
      server.fetch.mock.calls.filter(([url]) => String(url).split("?")[0] === "/api/session")
        .length;
    render(<AccountsDesktop />);
    await screen.findByRole("menuitem", { name: "Apple" });
    const before = reads();
    const otherTab = new BroadcastChannel(CHANNEL);
    try {
      otherTab.postMessage({ kind: "changed", from: "page-of-another-tab" });
      await delivered();
      expect(reads()).toBe(before + 1);
      // A tab of an earlier build sends the bare string.
      otherTab.postMessage("changed");
      await delivered();
      expect(reads()).toBe(before + 2);
    } finally {
      otherTab.close();
    }
  });
});
