import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

const observers: (() => void)[] = [];
afterEach(() => {
  cleanup();
  for (const stop of observers.splice(0)) stop();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

async function desktop() {
  vi.resetModules();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const reloads: unknown[] = [];
  const errors: unknown[][] = [];
  const dom: unknown = Reflect.get(globalThis, "jsdom");
  if (!dom || typeof dom !== "object" || !("virtualConsole" in dom))
    throw new Error("Vitest JSDOM environment unavailable");
  const virtualConsole = dom.virtualConsole;
  if (
    !virtualConsole ||
    typeof virtualConsole !== "object" ||
    !("on" in virtualConsole) ||
    typeof virtualConsole.on !== "function" ||
    !("off" in virtualConsole) ||
    typeof virtualConsole.off !== "function"
  )
    throw new Error("JSDOM navigation observer unavailable");
  const off = virtualConsole.off.bind(virtualConsole);
  // JSDOM leaves the outgoing document alive rather than committing navigation, like the
  // hosted regression's held document response. Observe actual Location.reload calls.
  const onError = (error: unknown) => {
    if (String(error).includes("navigation")) reloads.push(error);
  };
  virtualConsole.on("jsdomError", onError);
  observers.push(() => off("jsdomError", onError));
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    // Unrelated app documents are deliberately unavailable in this transport fixture.
    if (!args.some((value) => String(value).includes("navigation fixture: route unavailable"))) {
      errors.push(args);
    }
  });
  let answerTicket: (response: Response) => void = () => {
    throw new Error("the actual live ticket has not started");
  };
  let answerLogout: (response: Response) => void = () => {
    throw new Error("the actual logout has not started");
  };
  let answerSignIn: (response: Response) => void = () => {
    throw new Error("UI sign-in not started");
  };
  let signInStarted = false;
  let ticketStarted = false;
  let logoutStarted = false;
  let signedIn = true;
  const session = () => ({
    session: (signedIn ? "a" : "b").repeat(64),
    account: signedIn ? { name: "ada", full_name: "Ada", guest: false } : null,
    locked: false,
    adopt: false,
    sign_in_ready: true,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url).split("?")[0];
      if (path === "/api/session/ticket") {
        ticketStarted = true;
        return new Promise<Response>((resolve) => {
          answerTicket = resolve;
        });
      }
      if (path === "/api/session/sign-in") {
        signInStarted = true;
        return new Promise<Response>((resolve) => {
          answerSignIn = resolve;
        });
      }
      if (path === "/api/session/sign-out") {
        logoutStarted = true;
        return new Promise<Response>((resolve) => {
          answerLogout = resolve;
        });
      }
      if (path === "/api/session") return new Response(JSON.stringify(session()), { status: 200 });
      return new Response(JSON.stringify({ error: "navigation fixture: route unavailable" }), {
        status: 404,
      });
    }),
  );
  const { AccountsDesktop } = await import("./desktop-accounts");
  const server = await import("./desktop-server");
  const live = await import("./desktop-live");
  render(<AccountsDesktop />);
  await waitFor(() => expect(ticketStarted).toBe(true));
  expect(errors).toEqual([]);
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  return {
    reloads,
    errors,
    server,
    async remoteLogout() {
      signedIn = false;
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
    },
    async logOut() {
      await user.click(await screen.findByRole("menuitem", { name: "Apple" }));
      await user.click(await screen.findByRole("menuitem", { name: /^Log Out/ }));
      await waitFor(() => expect(logoutStarted).toBe(true));
    },
    async finishLogout(status = 200) {
      if (status === 200) signedIn = false;
      await act(async () => {
        answerLogout(
          new Response(JSON.stringify(status === 409 ? { session_changed: true } : session()), {
            status,
          }),
        );
      });
    },
    async switchUser() {
      await user.click(await screen.findByRole("menuitem", { name: "Ada" }));
      await user.click(await screen.findByRole("menuitem", { name: "Login Window…" }));
      await user.click(await screen.findByRole("button", { name: "Other…" }));
      await user.type(screen.getByLabelText("Account Name:"), "grace");
      await user.type(screen.getByLabelText("Password:"), "synthetic-password");
      await user.click(screen.getByRole("button", { name: "Log In" }));
      await waitFor(() => expect(signInStarted).toBe(true));
      await act(async () => {
        answerSignIn(
          new Response(
            JSON.stringify({
              ...session(),
              session: "c".repeat(64),
              account: { name: "grace", full_name: "Grace", guest: false },
            }),
            { status: 200 },
          ),
        );
      });
    },
    async refuseTicket(expectSessionEnd = true) {
      await act(async () => {
        answerTicket(new Response(JSON.stringify({ session_ended: true }), { status: 409 }));
      });
      // The late refusal must still clear live data and reject replies from the old session.
      expect(live.liveState().items).toEqual([]);
      if (expectSessionEnd)
        expect(server.replyOfPageSession(200, { session: "a".repeat(64) })).toBe(false);
    },
  };
}

it.each(["logout-first", "ticket-first"])(
  "reloads once when logout and refused live ticket finish %s",
  async (order) => {
    const app = await desktop();
    await app.logOut();
    if (order === "logout-first") await app.finishLogout();
    else await app.refuseTicket();
    await waitFor(() => expect(app.reloads).toHaveLength(1));
    if (order === "logout-first") await app.refuseTicket();
    else await app.finishLogout();
    expect(app.reloads).toHaveLength(1);
    expect(app.errors).toEqual([]);
  },
);

it("allows explicit logout after a recent prior-document reload without a second ticket reload", async () => {
  const app = await desktop();
  sessionStorage.setItem(app.server.SESSION_RELOAD_KEY, String(Date.now() - 1_000));
  await app.logOut();
  await app.finishLogout();
  await waitFor(() => expect(app.reloads).toHaveLength(1));
  await app.refuseTicket();
  expect(app.reloads).toHaveLength(1);
  expect(app.errors).toEqual([]);
});

it("keeps failed logout retryable and still reloads for a genuine later session expiry", async () => {
  const app = await desktop();
  await app.logOut();
  await app.finishLogout(503);
  expect(await screen.findByRole("alert")).toHaveTextContent("You could not be logged out.");
  expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled();
  expect(app.reloads).toHaveLength(0);
  await app.refuseTicket();
  await waitFor(() => expect(app.reloads).toHaveLength(1));
  expect(app.errors).toEqual([]);
});

it("allows a UI account switch after a recent prior-document reload", async () => {
  const app = await desktop();
  sessionStorage.setItem(app.server.SESSION_RELOAD_KEY, String(Date.now() - 1_000));
  await app.switchUser();
  await waitFor(() => expect(app.reloads).toHaveLength(1));
  // Switching covers the desktop and cancels its live holder before the response arrives.
  await app.refuseTicket(false);
  expect(app.reloads).toHaveLength(1);
  expect(app.errors).toEqual([]);
});

it("follows a confirmed other-tab session change after a recent reload without duplicate navigation", async () => {
  const app = await desktop();
  sessionStorage.setItem(app.server.SESSION_RELOAD_KEY, String(Date.now() - 1_000));
  await app.remoteLogout();
  await waitFor(() => expect(app.reloads).toHaveLength(1));
  await app.refuseTicket();
  expect(app.reloads).toHaveLength(1);
  expect(app.errors).toEqual([]);
});

it("allows a new deliberate account action when the first navigation leaves its document active", async () => {
  const app = await desktop();
  await app.logOut();
  await app.finishLogout();
  await waitFor(() => expect(app.reloads).toHaveLength(1));
  await app.refuseTicket();
  expect(app.reloads).toHaveLength(1);
  // JSDOM never replaces the document, as when the user cancels a beforeunload prompt.
  // Its session has already ended, so the new user action is refused and reads the new one.
  await app.logOut();
  await app.finishLogout(409);
  await waitFor(() => expect(app.reloads).toHaveLength(2));
  expect(app.server.replyOfPageSession(200, { session: "a".repeat(64) })).toBe(false);
  expect(app.errors).toEqual([]);
});
