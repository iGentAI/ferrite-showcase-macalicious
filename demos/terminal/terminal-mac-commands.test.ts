import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { standInDrive, waitFor } from "./terminal-drive-stand-in";

/*
 * The commands of `terminal-mac-commands.ts`, as a person uses them: bytes typed at the prompt, the
 * terminal's text read back. Files go through the desktop's real drive client to a stand-in for its
 * routes (`terminal-drive-stand-in`), which replaces the Ferrite server here and only here.
 */

type Session = import("./terminal-shell").TerminalSession;

async function newSession(): Promise<Session> {
  const { TerminalSession } = await import("./terminal-shell");
  const session = new TerminalSession({ rows: 24, cols: 100 });
  await session.start();
  return session;
}

/** Types a line and answers what it wrote: the text between its line and the next prompt. */
async function run(session: Session, line: string): Promise<string> {
  const before = session.emulator.cursorLine;
  session.input(`${line}\r`);
  await waitFor(() => expect(session.editor.reading).toBe(true));
  const { emulator } = session;
  const last = emulator.cursorLine - 1;
  return last <= before
    ? ""
    : emulator.textBetween({ line: before + 1, column: 0 }, { line: last, column: emulator.cols });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  standInDrive();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("what needs a real computer", () => {
  it.each([
    [
      "sudo ls",
      "sudo: there is no root here: this shell runs in the page, and every file belongs to you",
    ],
    ["ssh host", "ssh: this page has no sockets, so it cannot reach another computer"],
    [
      "brew install x",
      "brew: nothing can be installed: there is no computer underneath this shell",
    ],
    [
      "git status",
      "git: there is no git here: the drive keeps no history and this page has no sockets",
    ],
    ["vim a", "vim: there is no full-screen editor here; use TextEdit, which opens the same files"],
  ])("%s refuses clearly, with status 1", async (line, answer) => {
    const session = await newSession();
    expect(await run(session, line)).toBe(answer);
  });
});

describe("what the shell knows of itself", () => {
  it("answers who and where it is", async () => {
    const session = await newSession();
    expect(await run(session, "whoami")).toBe("shackett");
    expect(await run(session, "hostname")).toBe("ismhpro");
    expect(await run(session, "uname")).toBe("Simulated");
    expect(await run(session, "uname -a")).toBe("Simulated ismhpro 1.0 browser");
    expect(await run(session, "id")).toBe("uid=501(shackett) gid=20(staff) groups=20(staff)");
  });

  it("formats the date as asked", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 3, 9, 5, 7) });
    const session = await newSession();
    expect(await run(session, "date +%Y-%m-%d_%H:%M:%S")).toBe("2026-11-03_09:05:07");
    expect(await run(session, "date +%F")).toBe("2026-11-03");
    expect(await run(session, "date")).toMatch(/^Tue Nov {2}3 09:05:07 .+ 2026$/);
  });
});

describe("defaults", () => {
  it("keeps a value under its domain and key, dots and dashes included", async () => {
    const session = await newSession();
    expect(await run(session, "defaults write com.apple.my-app Show-All yes please")).toBe("");
    expect(await run(session, "defaults read com.apple.my-app Show-All")).toBe("yes please");
    expect(await run(session, "defaults domains")).toBe("com.apple.my-app");
    expect(await run(session, "defaults read com.apple.my-app")).toBe(
      '{\n    "Show-All" = "yes please";\n}',
    );
    await run(session, "defaults delete com.apple.my-app Show-All");
    expect(await run(session, "defaults read com.apple.my-app Show-All")).toBe(
      "The domain/default pair of (com.apple.my-app, Show-All) does not exist",
    );
  });
});

describe("the clipboard", () => {
  it("takes piped text with pbcopy, and gives it back with pbpaste", async () => {
    let held = "";
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: {
        writeText: async (text: string) => {
          held = text;
        },
        readText: async () => held,
      },
    });
    const session = await newSession();
    expect(await run(session, "echo copied | pbcopy")).toBe("");
    expect(held).toBe("copied\n");
    expect(await run(session, "pbpaste")).toBe("copied");
  });

  it("says why when nothing is piped in", async () => {
    const session = await newSession();
    expect(await run(session, "pbcopy")).toContain("give it text through a pipe");
  });
});

describe("say", () => {
  it("waits for the voices a browser loads late", async () => {
    let voices: { name: string }[] = [];
    const spoken: unknown[] = [];
    const heard = new Set<() => void>();
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        rate = 1;
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => voices,
      addEventListener: (_: string, listener: () => void) => heard.add(listener),
      removeEventListener: (_: string, listener: () => void) => heard.delete(listener),
      cancel: () => {},
      speak: (utterance: { voice: unknown; onend: () => void }) => {
        spoken.push(utterance.voice);
        utterance.onend();
      },
    });
    const session = await newSession();
    setTimeout(() => {
      voices = [{ name: "Samantha" }];
      for (const listener of [...heard]) listener();
    }, 20);
    expect(await run(session, "say -v Samantha hello")).toBe("");
    expect(spoken).toEqual([{ name: "Samantha" }]);
    expect(await run(session, "say -v Nobody hello")).toBe("say: Voice `Nobody' not found.");
  });

  it("answers 1 when the browser cannot speak, and does not speak after Control-C", async () => {
    const spoken: string[] = [];
    let failure: string | null = "synthesis-unavailable";
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        rate = 1;
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: ((event: { error: string }) => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [],
      cancel: () => {},
      speak: (utterance: {
        text: string;
        onend: () => void;
        onerror: (event: { error: string }) => void;
      }) => {
        spoken.push(utterance.text);
        if (failure) utterance.onerror({ error: failure });
        else utterance.onend();
      },
    });
    const session = await newSession();
    expect(await run(session, "say hello || echo failed")).toBe(
      "say: the browser could not speak: synthesis-unavailable\nfailed",
    );
    failure = null;
    expect(await run(session, "say again && echo spoke")).toBe("spoke");
    expect(spoken).toEqual(["hello", "again"]);
  });

  it("stops mdfind's search on Control-C and writes nothing of its answer", async () => {
    const realFetch = globalThis.fetch;
    const asked: AbortSignal[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes("/api/spotlight/search")) return realFetch(input, init);
      if (init?.signal) asked.push(init.signal);
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("stopped", "AbortError")),
        );
      });
    });
    const session = await newSession();
    session.input("mdfind plum\r");
    await waitFor(() => expect(asked).toHaveLength(1));
    session.input("\u0003");
    await waitFor(() => expect(session.editor.reading).toBe(true));
    expect(asked[0]?.aborted).toBe(true);
    const text = session.emulator.textBetween(
      { line: 0, column: 0 },
      { line: session.emulator.cursorLine, column: session.emulator.cols },
    );
    expect(text).not.toContain("mdfind: ");
  });

  it("refuses -o and an unknown voice, and speaks at the rate asked", async () => {
    const spoken: { text: string; rate: number }[] = [];
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        rate = 1;
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [{ name: "Samantha" }],
      cancel: () => {},
      speak: (utterance: { text: string; rate: number; onend: () => void }) => {
        spoken.push({ text: utterance.text, rate: utterance.rate });
        utterance.onend();
      },
    });
    const session = await newSession();
    expect(await run(session, "say -o out.aiff hello")).toContain("cannot write a sound file");
    expect(await run(session, "say -v Nobody hello")).toBe("say: Voice `Nobody' not found.");
    expect(spoken).toEqual([]);
    expect(await run(session, "say -v Samantha -r 350 hello")).toBe("");
    expect(spoken).toEqual([{ text: "hello", rate: 2 }]);
  });
});

describe("open", () => {
  it("says what it cannot find", async () => {
    const session = await newSession();
    expect(await run(session, "open -a Nothing")).toBe(
      "Unable to find application named 'Nothing'",
    );
    expect(await run(session, "open")).toBe("usage: open [-a application] file ...");
    expect(await run(session, "open /no/such")).toBe("The file /no/such does not exist.");
  });
});
