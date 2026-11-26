import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type DriveStandIn, standInDrive, waitFor } from "./terminal-drive-stand-in";

/*
 * Scripts as a person uses them: lines typed at the prompt and files on the drive, the terminal's
 * text read back. The drive's routes are the stand-in `terminal-drive-stand-in` replaces the Ferrite
 * server with, here and only here.
 */

let drive: DriveStandIn;
type Session = import("./terminal-shell").TerminalSession;

async function newSession(rows = 40, cols = 200): Promise<Session> {
  const { TerminalSession } = await import("./terminal-shell");
  const session = new TerminalSession({ rows, cols });
  await session.start();
  return session;
}

const settled = (session: Session) => waitFor(() => expect(session.editor.reading).toBe(true));

async function run(session: Session, line: string): Promise<string> {
  const before = session.emulator.cursorLine;
  session.input(`${line}\r`);
  await settled(session);
  const { emulator } = session;
  const last = emulator.cursorLine - 1;
  return last <= before
    ? ""
    : emulator.textBetween({ line: before + 1, column: 0 }, { line: last, column: emulator.cols });
}

async function inDocuments(): Promise<Session> {
  const session = await newSession();
  await run(session, "cd Documents");
  return session;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  drive = standInDrive();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("aliases", () => {
  it("stands a name for a command at the head of each one, and forgets it", async () => {
    const session = await newSession();
    expect(await run(session, "alias hi='echo hello'")).toBe("");
    expect(await run(session, "hi there; hi | wc -w")).toMatch(/^hello there\n +1$/);
    expect(await run(session, "echo hi")).toBe("hi");
    expect(await run(session, "alias")).toBe("hi='echo hello'");
    expect(await run(session, "alias hi")).toBe("hi='echo hello'");
    expect(await run(session, "unalias hi")).toBe("");
    expect(await run(session, "hi")).toBe("zsh: command not found: hi");
    expect(await run(session, "unalias hi")).toBe("unalias: no such hash table element: hi");
  });

  it("does not loop on an alias of itself", async () => {
    const session = await newSession();
    await run(session, "alias echo='echo x'");
    expect(await run(session, "echo y")).toBe("x y");
  });
});

describe("here-documents and here-strings", () => {
  it("reads the lines up to the end word, with their variables", async () => {
    const session = await newSession();
    await run(session, "A=one");
    session.input("cat <<END\r");
    await settled(session);
    expect(session.emulator.allText()).toContain("heredoc>");
    session.input("$A two\r");
    await settled(session);
    expect(await run(session, "END")).toBe("one two");
  });

  it("keeps the text as written when the end word is quoted", async () => {
    const session = await newSession();
    session.input("cat <<'END'\r$A\r");
    await settled(session);
    expect(await run(session, "END")).toBe("$A");
  });

  it("gives a word to a command with <<<", async () => {
    const session = await newSession();
    await run(session, "A=apple");
    expect(await run(session, "wc -c <<< $A")).toContain("6");
    expect(await run(session, 'cat <<< "$A pie"')).toBe("apple pie");
  });
});

describe("command substitution and arithmetic", () => {
  it("puts what a command wrote in its place", async () => {
    const session = await newSession();
    expect(await run(session, "echo $(echo a b) c")).toBe("a b c");
    expect(await run(session, 'echo "[$(echo a)]"')).toBe("[a]");
    expect(await run(session, "A=$(pwd); echo $A")).toBe("/Users/shackett");
    expect(await run(session, 'echo "$(echo "in quotes")"')).toBe("in quotes");
  });

  it("splits what an unquoted one wrote into words, and a quoted one not", async () => {
    const session = await newSession();
    expect(await run(session, 'for x in $(echo a b); do echo "<$x>"; done')).toBe("<a>\n<b>");
    expect(await run(session, 'for x in "$(echo a b)"; do echo "<$x>"; done')).toBe("<a b>");
  });

  it("keeps a cd inside one to itself", async () => {
    const session = await newSession();
    expect(await run(session, "echo $(cd Documents; pwd); pwd")).toBe(
      "/Users/shackett/Documents\n/Users/shackett",
    );
  });

  it("works out $((...))", async () => {
    const session = await newSession();
    await run(session, "i=4");
    expect(await run(session, "echo $((i + 2 * 3)) $(( (i + 2) * 3 )) $((7 / 2)) $((7 % 2))")).toBe(
      "10 18 3 1",
    );
    expect(await run(session, "echo $((i > 3 && $i != 9))")).toBe("1");
    expect(await run(session, "echo $((1 / 0))")).toBe("zsh: division by zero");
    expect(session.scope.status).toBe(1);
  });
});

describe("if, for, while and until", () => {
  it("takes the branch of the first test that holds", async () => {
    const session = await newSession();
    expect(await run(session, "if true; then echo yes; else echo no; fi")).toBe("yes");
    expect(await run(session, "if false; then echo yes; else echo no; fi")).toBe("no");
    expect(
      await run(session, "if false; then echo a; elif [ 2 -gt 1 ]; then echo b; else echo c; fi"),
    ).toBe("b");
    expect(await run(session, "if false; then echo a; fi; echo $?")).toBe("0");
  });

  it("goes over a list, and asks for more until the loop closes", async () => {
    const session = await newSession();
    session.input("for x in 1 2\r");
    await settled(session);
    expect(session.emulator.allText()).toContain("for>");
    session.input("do echo $x\r");
    await settled(session);
    expect(await run(session, "done")).toBe("1\n2");
  });

  it("counts with while and until", async () => {
    const session = await newSession();
    expect(await run(session, "i=0; while [ $i -lt 3 ]; do echo $i; i=$((i + 1)); done")).toBe(
      "0\n1\n2",
    );
    expect(await run(session, "i=0; until [ $i -ge 2 ]; do echo $i; i=$((i + 1)); done")).toBe(
      "0\n1",
    );
  });

  it("reads a file a line at a time with while read and done <", async () => {
    drive.addFile("documents", "lines.txt", "one two\nthree\n");
    const session = await inDocuments();
    expect(await run(session, 'while read a b; do echo "<$a><$b>"; done < lines.txt')).toBe(
      "<one><two>\n<three><>",
    );
  });

  it("sends a loop's output to a file", async () => {
    const session = await inDocuments();
    await run(session, "for x in a b; do echo $x; done > out.txt");
    expect(await run(session, "cat out.txt")).toBe("a\nb");
  });

  it("stops a loop that never ends with Control-C", async () => {
    const session = await newSession();
    session.input("while true; do echo y > /dev/null 2>&1; true; done\r");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(session.editor.reading).toBe(false);
    session.input("\x03");
    await settled(session);
    expect(session.scope.status).toBe(130);
  });

  it("refuses what it does not have, naming it", async () => {
    const session = await newSession();
    expect(await run(session, "case a in")).toContain("not here yet");
    expect(await run(session, "fi")).toBe("zsh: parse error near `fi'");
  });
});

describe("scripts", () => {
  const SCRIPT =
    '#!/bin/sh\n# a comment\nname=$1\necho "hello $name, $# of $0"\ncd /\nexit 4\necho never\n';

  it("runs one with sh, in a shell of its own, with its arguments", async () => {
    drive.addFile("documents", "say.sh", SCRIPT);
    const session = await inDocuments();
    expect(await run(session, "sh say.sh world")).toBe("hello world, 1 of say.sh");
    expect(session.scope.status).toBe(4);
    expect(session.scope.cwd).toBe("/Users/shackett/Documents");
    expect(session.ended).toBe(false);
    expect(await run(session, 'echo "<$name>"')).toBe("<>");
  });

  it("keeps what source sets, in this shell", async () => {
    drive.addFile("documents", "set.sh", "A=kept\nalias hi='echo hi there'\ncd ..\n");
    const session = await inDocuments();
    expect(await run(session, "source set.sh")).toBe("");
    expect(await run(session, "echo $A; hi; pwd")).toBe("kept\nhi there\n/Users/shackett");
  });

  it("ends the shell when a sourced script exits", async () => {
    drive.addFile("documents", "end.sh", "exit 3\n");
    const session = await inDocuments();
    session.input(". end.sh\r");
    await waitFor(() => expect(session.ended).toBe(true));
    expect(session.scope.status).toBe(3);
  });

  it("pipes and redirects a script's output, and takes a here-document in it", async () => {
    drive.addFile("documents", "two.sh", "cat <<END\nb\na\nEND\n");
    const session = await inDocuments();
    expect(await run(session, "sh two.sh | sort")).toBe("a\nb");
    await run(session, "sh two.sh > out.txt");
    expect(await run(session, "cat out.txt")).toBe("b\na");
  });

  it("stops at a line it cannot read, and says which script", async () => {
    drive.addFile("documents", "bad.sh", "if true\n");
    const session = await inDocuments();
    expect(await run(session, "sh bad.sh")).toBe("bad.sh: parse error: the file ends too soon");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "sh nosuch.sh")).toContain("No such file or directory");
    expect(session.scope.status).toBe(127);
  });

  it("runs sh -c and what a pipe gives it", async () => {
    const session = await newSession();
    expect(await run(session, "sh -c 'echo $1' x y")).toBe("y");
    expect(await run(session, "echo 'echo piped' | sh")).toBe("piped");
  });

  it("walks a script's arguments with $@ and shift", async () => {
    drive.addFile(
      "documents",
      "args.sh",
      'for a in "$@"; do echo "<$a>"; done\nshift\necho $#\necho "$*"\n',
    );
    const session = await inDocuments();
    expect(await run(session, "sh args.sh 'a b' c")).toBe("<a b>\n<c>\n1\nc");
  });
});

describe("chmod and running a file", () => {
  it("runs a file by its path only once it may", async () => {
    drive.addFile("documents", "go.sh", "echo ran $1\n");
    const session = await inDocuments();
    expect(await run(session, "./go.sh x")).toBe("zsh: permission denied: ./go.sh");
    expect(session.scope.status).toBe(126);
    expect(await run(session, "chmod +x go.sh")).toBe("");
    expect(await run(session, "./go.sh x")).toBe("ran x");
    expect(await run(session, "ls -l go.sh")).toContain("-rwxr-xr-x");
    expect(await run(session, "chmod 640 go.sh")).toBe("");
    expect(await run(session, "ls -l go.sh")).toContain("-rw-r-----");
    const { desktopValues } = await import("../desktop/desktop-personal");
    const id = Object.keys(desktopValues()).find((key) => key.startsWith("terminal-file-mode."));
    expect(id).toMatch(/^terminal-file-mode\.[A-Za-z0-9._-]+$/);
    expect(await run(session, "./nosuch")).toBe("zsh: no such file or directory: ./nosuch");
  });

  it("refuses to write a file its mode closes, and a mode it cannot read", async () => {
    drive.addFile("documents", "kept.txt", "K\n");
    const session = await inDocuments();
    await run(session, "chmod a-w kept.txt");
    expect(await run(session, "echo no > kept.txt")).toBe("zsh: permission denied: kept.txt");
    expect(await run(session, "cat kept.txt")).toBe("K");
    expect(await run(session, "chmod zz kept.txt")).toBe("chmod: Invalid file mode: zz");
    expect(await run(session, "chmod +x nosuch")).toBe("chmod: nosuch: No such file or directory");
  });
});

describe("~/.zshrc", () => {
  it("is a file to write, read, and run when a shell starts", async () => {
    const first = await newSession();
    await run(first, "echo 'alias ll=\"ls -1\"' > ~/.zshrc");
    await run(first, "echo 'GREETING=hello' >> ~/.zshrc");
    expect(await run(first, "cat ~/.zshrc")).toBe('alias ll="ls -1"\nGREETING=hello');
    expect(await run(first, "ls -a ~")).toContain(".zshrc");
    const second = await newSession();
    expect(await run(second, "echo $GREETING")).toBe("hello");
    expect(await run(second, "alias ll")).toBe("ll='ls -1'");
    expect(second.scope.status).toBe(0);
    // What the settings route takes: `<pane>.<name>`, or it refuses the whole document.
    const { desktopValues } = await import("../desktop/desktop-personal");
    expect(desktopValues()["terminal.zshrc"]).toBe('alias ll="ls -1"\nGREETING=hello\n');
  });

  it("refuses more than the settings route keeps, and leaves what it held", async () => {
    const session = await newSession();
    await run(session, "echo kept > ~/.zshrc");
    expect(await run(session, `echo ${"x".repeat(4100)} > ~/.zshrc`)).toContain(
      "at most 4096 bytes",
    );
    expect(await run(session, "cat ~/.zshrc")).toBe("kept");
  });
});

describe("jobs", () => {
  it("runs a command behind the prompt, and says when it has ended", async () => {
    const session = await newSession();
    const started = await run(session, "sleep 0.05 &");
    expect(started).toMatch(/^\[1\] \d+$/);
    expect(await run(session, "jobs")).toBe("[1]  + running    sleep 0.05");
    await waitFor(() => expect(session.jobs[0]?.running).toBe(false));
    expect(await run(session, "echo next")).toBe("next\n[1]  + done    sleep 0.05");
    expect(session.jobs).toEqual([]);
  });

  it("takes up a job with fg, and stops it with Control-C", async () => {
    const session = await newSession();
    await run(session, "sleep 30 &");
    session.input("fg %1\r");
    await waitFor(() => expect(session.emulator.allText()).toContain("running    sleep 30"));
    expect(session.editor.reading).toBe(false);
    session.input("\x03");
    await settled(session);
    expect(session.scope.status).toBe(130);
  });

  it("waits for a job, which keeps its own variables", async () => {
    const session = await newSession();
    await run(session, "A=1; A=2 &");
    expect(await run(session, "wait; echo $A")).toContain("1");
    expect(await run(session, "fg %9")).toBe("fg: job not found: %9");
  });

  it("stops its jobs when the tab closes", async () => {
    const session = await newSession();
    await run(session, "sleep 30 &");
    session.stop();
    await waitFor(() => expect(session.jobs[0]?.running).toBe(false));
    expect(session.jobs[0]?.status).toBe(130);
  });
});

describe("ls", () => {
  beforeEach(() => {
    drive.addFile("documents", "big.txt", "x".repeat(2048));
    drive.addFile("documents", "small.txt", "x");
  });

  it("orders by size, and the other way round", async () => {
    const session = await inDocuments();
    expect(await run(session, "ls -1S")).toBe("big.txt\nsmall.txt");
    expect(await run(session, "ls -1Sr")).toBe("small.txt\nbig.txt");
    expect(await run(session, "ls -1r")).toBe("small.txt\nbig.txt");
  });

  it("marks what each is with -F, and writes sizes for reading with -h", async () => {
    const session = await inDocuments();
    await run(session, "mkdir inner; chmod +x small.txt");
    expect(await run(session, "ls -1F")).toBe("big.txt\ninner/\nsmall.txt*");
    expect(await run(session, "ls -lh big.txt")).toContain(" 2.0K ");
    expect(await run(session, "ls -l big.txt")).toContain(" 2048 ");
  });

  it("lists a folder itself with -d, and goes into folders with -R", async () => {
    const session = await inDocuments();
    await run(session, "mkdir inner; touch inner/deep.txt");
    expect(await run(session, "ls -d inner")).toBe("inner");
    expect(await run(session, "ls -1R inner")).toBe("deep.txt");
    expect(await run(session, "ls -1R .")).toBe("big.txt\ninner\nsmall.txt\n\n./inner:\ndeep.txt");
  });

  it("still refuses what it does not have", async () => {
    const session = await inDocuments();
    expect(await run(session, "ls -i")).toBe("ls: illegal option -- i");
  });
});

describe("the small commands scripts use", () => {
  it.each([
    ["test -z ''; echo $?", "0"],
    ["test -n ''; echo $?", "1"],
    ["[ a = a ]; echo $?", "0"],
    ["[ a != a ]; echo $?", "1"],
    ["[ ! a = b ]; echo $?", "0"],
    ["[ 1 -eq 1 -a 2 -gt 1 ]; echo $?", "0"],
    ["[[ a == a ]]; echo $?", "0"],
    ["[ a; echo $?", "[: ']' expected\n2"],
    ["true; echo $?", "0"],
    ["false; echo $?", "1"],
    [": anything; echo $?", "0"],
    ["printf '%s-%d\\n' a 3", "a-3"],
    ["printf '%s\\n' a b", "a\nb"],
    ["basename /a/b.txt .txt", "b"],
    ["dirname /a/b.txt", "/a"],
    ["dirname b.txt", "."],
    ["seq 3", "1\n2\n3"],
    ["seq 3 -1 2", "3\n2"],
    ["type cd", "cd is a shell builtin"],
    ["type sed", "sed is /bin/sed"],
    ["type vim", "vim not found"],
  ])("%s", async (line, written) => {
    const session = await newSession();
    expect(await run(session, line)).toBe(written);
  });

  it("tests files on the drive", async () => {
    drive.addFile("documents", "a.txt", "A");
    const session = await inDocuments();
    expect(await run(session, "[ -f a.txt ]; echo $?")).toBe("0");
    expect(await run(session, "[ -d a.txt ]; echo $?")).toBe("1");
    expect(await run(session, "[ -e nosuch ]; echo $?")).toBe("1");
    expect(await run(session, "[ -d . ]; echo $?")).toBe("0");
  });

  it("reads from the keyboard with read", async () => {
    const session = await newSession();
    session.input('read A B; echo "<$A><$B>"\r');
    await waitFor(() => expect(session.rawReader).not.toBeNull());
    session.input("one two three\r");
    await settled(session);
    expect(session.emulator.allText()).toContain("<one><two three>");
  });
});
