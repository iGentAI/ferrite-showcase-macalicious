import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onDesktopEffects } from "../desktop/desktop-effects";
import { standInDrive, waitFor } from "./terminal-drive-stand-in";

/*
 * `kill` and `top` as a person uses them: a line typed, the terminal read back. Files and the
 * figures come from stand-ins for the server's routes; the desktop's windows are elements with the
 * hooks `scanWindows` reads, and the desktop that would quit an application is a listener here.
 */

type Session = import("./terminal-shell").TerminalSession;

async function newSession(): Promise<Session> {
  const { TerminalSession } = await import("./terminal-shell");
  const session = new TerminalSession({ rows: 8, cols: 70 });
  await session.start();
  return session;
}

const atPrompt = (session: Session) => waitFor(() => expect(session.editor.reading).toBe(true));

async function run(session: Session, line: string): Promise<string> {
  const before = session.emulator.cursorLine;
  session.input(`${line}\r`);
  await atPrompt(session);
  const { emulator } = session;
  return emulator.textBetween(
    { line: before + 1, column: 0 },
    { line: emulator.cursorLine - 1, column: emulator.cols },
  );
}

function openWindow(id: string, title: string): void {
  const element = document.createElement("div");
  element.setAttribute("data-window-id", id);
  const frame = document.createElement("div");
  frame.setAttribute("role", "region");
  frame.setAttribute("aria-label", title);
  element.append(frame);
  document.body.append(element);
}

const pidIn = (listing: string, app: string) =>
  new RegExp(`(\\d+) ${app}`).exec(listing)?.[1] as string;

const FIGURES = (requests: number) => ({
  generation: 3,
  instance: "one",
  window_ms: 300_000,
  total: { requests, per_second: 1.5, errors: 2, store_ops: 9 },
  apps: [
    { name: "notes", title: "Notes", requests: 5, per_second: 0.5, errors: 0, store_ops: 7 },
    { name: "mail", title: "Mail", requests, per_second: 1, errors: 2, store_ops: 2 },
  ],
});

let quit: string[];
let stopListening: () => void;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  standInDrive();
  quit = [];
  stopListening = onDesktopEffects((effects) => {
    for (const effect of effects) if ("quit" in effect) quit.push(effect.quit);
  });
  openWindow("calculator", "Calculator");
  openWindow("calculator:2", "Calculator 2");
  openWindow("terminal", "zsh");
});

afterEach(() => {
  stopListening();
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ps", () => {
  it("names a window by the title its bar shows when it has no label of its own", async () => {
    const holder = document.createElement("div");
    holder.setAttribute("data-window-id", "textedit");
    holder.innerHTML =
      '<div role="region" aria-labelledby="bar-title"><span id="bar-title"> Notes.rtf — Edited </span></div>';
    document.body.append(holder);
    const session = await newSession();
    const shown = await run(session, "ps");
    expect(shown.split("\n").find((line) => line.includes("textedit"))).toMatch(
      /^ *\d+ textedit +Notes\.rtf — Edited$/,
    );
    expect(shown).toMatch(/calculator +Calculator 2\n/);
  });
});

describe("kill", () => {
  it("asks the desktop to quit the application of a window, by the number ps gave it", async () => {
    const session = await newSession();
    const pid = pidIn(await run(session, "ps"), "calculator");
    expect(await run(session, `kill ${pid}`)).toBe("");
    expect(session.scope.status).toBe(0);
    expect(quit).toEqual(["calculator"]);
  });

  it.each(["-9", "-KILL", "-SIGTERM", "-s TERM"])("takes %s", async (signal) => {
    const session = await newSession();
    const pid = pidIn(await run(session, "ps"), "calculator");
    await run(session, `kill ${signal} ${pid}`);
    expect(quit).toEqual(["calculator"]);
  });

  it("only checks with -0, and lists its signals with -l", async () => {
    const session = await newSession();
    const pid = pidIn(await run(session, "ps"), "calculator");
    expect(await run(session, `kill -0 ${pid}`)).toBe("");
    expect(session.scope.status).toBe(0);
    expect(quit).toEqual([]);
    expect(await run(session, "kill -l")).toBe("HUP INT KILL TERM");
  });

  it("refuses Terminal itself, a number with no window, another signal, and no number", async () => {
    const session = await newSession();
    const pid = pidIn(await run(session, "ps"), "terminal");
    expect(await run(session, `kill ${pid}`)).toBe(
      `kill: ${pid} is Terminal; close it with Shell > Close`,
    );
    expect(session.scope.status).toBe(1);
    expect(await run(session, "kill 99")).toBe("kill: kill 99 failed: no such process");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "kill -USR1 99")).toContain("no such signal here");
    expect(await run(session, "kill")).toBe("usage: kill [-signal] pid ...");
    expect(quit).toEqual([]);
  });
});

describe("top", () => {
  const figures = (next: () => unknown) => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("/api/activity-monitor/ferrite")
        ? Promise.resolve(Response.json(next()))
        : realFetch(input, init),
    );
  };
  const shown = (session: Session) =>
    Array.from({ length: session.emulator.rows }, (_, row) => session.emulator.rowText(row));

  it("shows the modules, busiest first, until q, and reads them again", async () => {
    let requests = 40;
    figures(() => FIGURES(requests));
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const session = await newSession();
    session.input("top\r");
    await waitFor(() => expect(session.rawReader).not.toBeNull());
    expect(session.emulator.onAlternate).toBe(true);
    expect(shown(session)[0]).toBe("Requests 40, 1.50/s, errors 2, instance one");
    expect(shown(session)[3]).toContain("Mail");
    expect(shown(session)[4]).toContain("Notes");
    requests = 41;
    vi.advanceTimersByTime(5_000);
    await waitFor(() => expect(shown(session)[0]).toContain("Requests 41"));
    session.input("q");
    await atPrompt(session);
    expect(session.emulator.onAlternate).toBe(false);
    expect(session.scope.status).toBe(0);
  });

  it("writes the figures once into a pipe", async () => {
    figures(() => FIGURES(40));
    const session = await newSession();
    expect(await run(session, "top | grep -c Notes")).toBe("1");
  });

  it("says when the figures cannot be read, and takes no options", async () => {
    figures(() => ({ apps: "none" }));
    const session = await newSession();
    expect(await run(session, "top")).toBe("top: The server's figures could not be read.");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "top -o cpu")).toBe("top: this top takes no options; q quits it");
  });

  it("paints nothing from a reply that comes after it has ended", async () => {
    const held: ((response: Response) => void)[] = [];
    let reads = 0;
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes("/api/activity-monitor/ferrite")) return realFetch(input, init);
      reads += 1;
      if (reads === 1) return Promise.resolve(Response.json(FIGURES(40)));
      return new Promise<Response>((resolve) => held.push(resolve));
    });
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const session = await newSession();
    session.input("top\r");
    await waitFor(() => expect(session.rawReader).not.toBeNull());
    vi.advanceTimersByTime(5_000);
    await waitFor(() => expect(held).toHaveLength(1));
    session.input("q");
    await atPrompt(session);
    session.input("echo after\r");
    await atPrompt(session);
    held[0]?.(Response.json(FIGURES(99)));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(session.emulator.allText()).not.toContain("Requests 99");
    expect(session.emulator.allText()).toContain("after");
  });

  it("stops reading once it has ended", async () => {
    figures(() => FIGURES(40));
    const session = await newSession();
    session.input("top\r");
    await waitFor(() => expect(session.rawReader).not.toBeNull());
    session.interrupt();
    await atPrompt(session);
    expect(session.emulator.onAlternate).toBe(false);
    expect(session.scope.status).toBe(130);
  });
});
