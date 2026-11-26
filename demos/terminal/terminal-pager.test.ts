import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type DriveStandIn, standInDrive, waitFor } from "./terminal-drive-stand-in";
import { manualNames } from "./terminal-manual";

/*
 * `less`, `more` and `man` as a person uses them: keys typed, the terminal's screen read back. Files
 * go to a stand-in for the drive's routes (`terminal-drive-stand-in`), which replaces the Ferrite
 * server here and only here.
 */

type Session = import("./terminal-shell").TerminalSession;

let drive: DriveStandIn;

async function newSession(): Promise<Session> {
  const { TerminalSession } = await import("./terminal-shell");
  const session = new TerminalSession({ rows: 6, cols: 40 });
  await session.start();
  return session;
}

const screen = (session: Session) =>
  Array.from({ length: session.emulator.rows }, (_, row) => session.emulator.rowText(row));

/** Types a line that starts a full-screen program, and waits for it to take the keyboard. */
async function start(session: Session, line: string): Promise<void> {
  session.input(`${line}\r`);
  await waitFor(() => expect(session.rawReader).not.toBeNull());
}

const atPrompt = (session: Session) => waitFor(() => expect(session.editor.reading).toBe(true));

const LINES = Array.from({ length: 20 }, (_, at) => `line ${at + 1}`).join("\n");

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  drive = standInDrive();
  drive.addFile("documents", "long.txt", `${LINES}\n`);
  drive.addFile("documents", "short.txt", "one\ntwo\n");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("less", () => {
  it("shows a page on the alternate screen, moves by the keys, and leaves the screen as it was", async () => {
    const session = await newSession();
    session.input("cd Documents\r");
    await atPrompt(session);
    await start(session, "less long.txt");
    expect(session.emulator.onAlternate).toBe(true);
    expect(screen(session).slice(0, 5)).toEqual(["line 1", "line 2", "line 3", "line 4", "line 5"]);
    expect(screen(session)[5]).toBe("long.txt");
    session.input(" ");
    expect(screen(session)[0]).toBe("line 6");
    session.input("b");
    expect(screen(session)[0]).toBe("line 1");
    session.input("j");
    expect(screen(session)[0]).toBe("line 2");
    session.input("\x1b[A");
    expect(screen(session)[0]).toBe("line 1");
    session.input("G");
    expect(screen(session)[4]).toBe("line 20");
    expect(screen(session)[5]).toBe("(END)");
    session.input("g");
    expect(screen(session)[0]).toBe("line 1");
    session.input("q");
    await atPrompt(session);
    expect(session.emulator.onAlternate).toBe(false);
    expect(session.rawReader).toBeNull();
    expect(session.scope.status).toBe(0);
  });

  it("searches, and says when it finds nothing", async () => {
    const session = await newSession();
    await start(session, "less Documents/long.txt");
    for (const key of "/line 1\r") session.input(key);
    expect(screen(session)[0]).toBe("line 1");
    session.input("n");
    expect(screen(session)[0]).toBe("line 10");
    session.input("N");
    expect(screen(session)[0]).toBe("line 1");
    for (const key of "/nothing\r") session.input(key);
    expect(screen(session)[5]).toBe("Pattern not found");
    session.input("\x03");
    await atPrompt(session);
  });

  it("pages what a pipe gives, wraps a long line, and follows a new size", async () => {
    const session = await newSession();
    await start(session, `echo ${"x".repeat(50)} | less`);
    expect(screen(session)[0]).toBe("x".repeat(40));
    expect(screen(session)[1]).toBe("x".repeat(10));
    session.resize(6, 60);
    expect(screen(session)[0]).toBe("x".repeat(50));
    session.input("q");
    await atPrompt(session);
  });

  it("writes the text whole into a pipe or a file", async () => {
    const session = await newSession();
    session.input("less Documents/long.txt | wc -l\r");
    await atPrompt(session);
    expect(session.emulator.allText()).toContain("      20");
    session.input("less Documents/short.txt > Documents/copy.txt\r");
    await atPrompt(session);
    expect(drive.textOf("Documents/copy.txt")).toBe("one\ntwo\n");
  });

  it("takes keys typed before the file was read, and leaves what comes after q for the prompt", async () => {
    const session = await newSession();
    session.input("less Documents/long.txt\r G");
    await waitFor(() => expect(session.rawReader).not.toBeNull());
    expect(screen(session)[5]).toBe("(END)");
    session.input("\x1b[A");
    expect(screen(session)[4]).toBe("line 19");
    session.input("qecho after\r");
    await waitFor(() => expect(session.emulator.allText()).toContain("\nafter"));
    expect(session.emulator.onAlternate).toBe(false);
  });

  it("goes on from the last match, even when the page cannot put it at the top", async () => {
    const session = await newSession();
    await start(session, "less Documents/long.txt");
    for (const key of "/line 20\r") session.input(key);
    expect(screen(session)[4]).toBe("line 20");
    session.input("n");
    expect(screen(session)[5]).toBe("Pattern not found");
    for (const key of "/line 1\r") session.input(key);
    session.input("N");
    expect(screen(session)[0]).toBe("line 15");
    session.input("q");
    await atPrompt(session);
  });

  it("keeps its last row to one row, whatever the name or the search", async () => {
    const name = `${"n".repeat(60)}\x1b[?1049l.txt`;
    drive.addFile("documents", name, `${LINES}\n`);
    const session = await newSession();
    session.input("cd Documents\r");
    await atPrompt(session);
    await start(session, "less n*");
    expect(session.emulator.onAlternate).toBe(true);
    expect(screen(session)[0]).toBe("line 1");
    session.input("/");
    for (const key of "q".repeat(60)) session.input(key);
    expect(screen(session)[0]).toBe("line 1");
    expect(screen(session)[4]).toBe("line 5");
    expect(screen(session)[5]).toBe("q".repeat(39));
    session.input("\x1b");
    session.input("q");
    await atPrompt(session);
  });

  it("says what it could not read, and answers for the keyboard and for options", async () => {
    const session = await newSession();
    session.input("less nothing.txt\r");
    await atPrompt(session);
    expect(session.emulator.allText()).toContain("less: nothing.txt: No such file or directory");
    expect(session.scope.status).toBe(1);
    session.input("less\r");
    await atPrompt(session);
    expect(session.emulator.allText()).toContain("less: Missing filename");
    session.input("less -N Documents/short.txt\r");
    await atPrompt(session);
    expect(session.emulator.allText()).toContain("less: illegal option -- N");
  });

  it("leaves the alternate screen when Send Signal stops it", async () => {
    const session = await newSession();
    await start(session, "less Documents/long.txt");
    session.interrupt();
    await atPrompt(session);
    expect(session.emulator.onAlternate).toBe(false);
    expect(session.rawReader).toBeNull();
    expect(session.scope.status).toBe(130);
  });
});

describe("more", () => {
  it("returns at once when the text fits on the screen", async () => {
    const session = await newSession();
    session.input("more Documents/short.txt\r");
    await atPrompt(session);
    expect(session.emulator.onAlternate).toBe(false);
    expect(session.emulator.allText()).toContain("one\ntwo");
  });

  it("pages what does not fit", async () => {
    drive.addFile("documents", "wide.txt", "x".repeat(400));
    const session = await newSession();
    await start(session, "more Documents/wide.txt");
    expect(session.emulator.onAlternate).toBe(true);
    session.input("q");
    await atPrompt(session);
    await start(session, "more Documents/long.txt");
    expect(session.emulator.onAlternate).toBe(true);
    session.input("q");
    await atPrompt(session);
  });
});

describe("man", () => {
  it("shows a command's page, and says when there is none", async () => {
    const session = await newSession();
    await start(session, "man ls");
    expect(screen(session)[0]).toContain("LS(1)");
    expect(screen(session)[5]).toBe("Manual page ls(1)");
    session.input("q");
    await atPrompt(session);
    session.input("man git\r");
    await atPrompt(session);
    expect(session.emulator.allText()).toContain("No manual entry for git");
    expect(session.scope.status).toBe(1);
    session.input("man\r");
    await atPrompt(session);
    expect(session.emulator.allText()).toContain("What manual page do you want?");
  });

  it("writes the page into a pipe, and has a page for every command that works here", async () => {
    const session = await newSession();
    session.input("man cd | grep -c SYNOPSIS\r");
    await atPrompt(session);
    expect(session.scope.status).toBe(0);
    const { commandNames } = await import("./terminal-commands");
    expect(
      commandNames()
        .filter((name) => !manualNames().includes(name))
        .sort(),
    ).toEqual([
      "brew",
      "curl",
      "emacs",
      "ftp",
      "gcc",
      "git",
      "make",
      "nano",
      "npm",
      "perl",
      "ping",
      "pip",
      "python",
      "python3",
      "ruby",
      "scp",
      "ssh",
      "sudo",
      "telnet",
      "vi",
      "vim",
      "wget",
    ]);
  });
});
