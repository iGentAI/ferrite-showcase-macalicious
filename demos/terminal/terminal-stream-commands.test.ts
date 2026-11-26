import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { standInDrive, waitFor } from "./terminal-drive-stand-in";

/*
 * `sed`, `tr`, `cut`, `which` and `env` as a person uses them: a line typed at the prompt, the
 * terminal's text read back. Files go to a stand-in for the drive's routes (`terminal-drive-stand-in`),
 * which replaces the Ferrite server here and only here.
 */

type Session = import("./terminal-shell").TerminalSession;

async function newSession(): Promise<Session> {
  const { TerminalSession } = await import("./terminal-shell");
  const session = new TerminalSession({ rows: 24, cols: 100 });
  await session.start();
  return session;
}

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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sed", () => {
  it.each([
    ["abc", "s/^/x/g", "xabc"],
    ["abc", "s/$/x/g", "abcx"],
    ["abc", "s/x*/-/g", "-a-b-c-"],
    ["abc", "s/b*/x/g", "xaxcx"],
    ["aXbXc", "s/X/-/g", "a-b-c"],
    ["aaa", "s/a/x/2", "axa"],
    ["aaa", "s/a/x/2g", "axx"],
    ["aaa", "s/a/x/4", "aaa"],
    ["ab", "y/ab/xy/", "xy"],
    ["a/b", "s|/|-|", "a-b"],
    ["a", "/a/s//b/", "b"],
    ["a", "s&a&\\&&", "&"],
    ["aa", "s/A/x/i;s//y/", "xy"],
    ["a", "y/a/\\\\/", "\\"],
    ["a", "s//b/", "sed: no previous regular expression"],
    ["ab", "s/a/[&]/", "[a]b"],
  ])("on %s, %s gives %s", async (text, script, answer) => {
    const session = await newSession();
    expect(await run(session, `echo ${text} | sed '${script}'`)).toBe(answer);
  });

  it("takes addresses, ranges and -n", async () => {
    const session = await newSession();
    await run(session, "cd Documents");
    await run(session, "echo one > lines");
    await run(session, "echo two >> lines");
    await run(session, "echo three >> lines");
    expect(await run(session, "sed -n 2p lines")).toBe("two");
    expect(await run(session, "sed '1d' lines")).toBe("two\nthree");
    expect(await run(session, "sed -n '$p' lines")).toBe("three");
    expect(await run(session, "sed -n '1,2p' lines")).toBe("one\ntwo");
    expect(await run(session, "sed -n 's/e/e/g;//p' lines")).toBe("one\nthree");
    expect(await run(session, "sed -n '/t/,$p' lines")).toBe("two\nthree");
    expect(await run(session, "sed '2q' lines")).toBe("one\ntwo");
    expect(await run(session, "sed 1q lines nothing-here")).toBe("one");
    expect(session.scope.status).toBe(0);
    await run(session, "echo two > second");
    await run(session, "echo one > first");
    expect(await run(session, "sed '$d;1q' first second")).toBe("one");
    expect(await run(session, "sed '$s/one/changed/;1q' first second")).toBe("one");
    expect(await run(session, "sed '$d;1q' first")).toBe("");
    expect(await run(session, "sed '$d;1q' missing first")).toBe(
      "sed: missing: No such file or directory",
    );
    expect(session.scope.status).toBe(1);
    expect(await run(session, "sed '1!d' lines")).toBe("one");
    expect(await run(session, "sed -n '1! p' lines")).toBe("two\nthree");
    expect(await run(session, "sed -n -E -e 's/(t)(w)/\\2\\1/p' lines")).toBe("wto");
  });

  it("writes back with -i, after a backup when an ending is given", async () => {
    const session = await newSession();
    await run(session, "cd Documents");
    await run(session, "echo one > edit.txt");
    await run(session, "sed -i '' s/one/two/ edit.txt");
    expect(await run(session, "cat edit.txt")).toBe("two");
    await run(session, "sed -i.bak s/two/three/ edit.txt");
    expect(await run(session, "cat edit.txt")).toBe("three");
    expect(await run(session, "cat edit.txt.bak")).toBe("two");
    expect(await run(session, "echo a | sed -i '' s/a/b/")).toBe(
      "sed: -i may not be used with stdin",
    );
  });

  it("adds lines with a, i and c", async () => {
    const session = await newSession();
    expect(await run(session, "printf 'x\\ny\\n' | sed '1a after'")).toBe("x\nafter\ny");
    expect(await run(session, "printf 'x\\ny\\n' | sed '2i before'")).toBe("x\nbefore\ny");
    expect(await run(session, "printf 'x\\ny\\nz\\n' | sed '1,2c new'")).toBe("new\nz");
  });

  it("refuses an unknown command and a pattern that could run forever", async () => {
    const session = await newSession();
    expect(await run(session, "echo a | sed 'k'")).toBe("sed: invalid command code k");
    expect(await run(session, "echo a | sed -E 's/(a+)+/b/'")).toBe(
      "sed: this pattern could take too long to run here",
    );
  });

  it("says when a file cannot be read, and exits 1", async () => {
    const session = await newSession();
    await run(session, "sed s/a/b/ nothing-here");
    expect(session.scope.status).toBe(1);
  });
});

describe("tr", () => {
  it.each([
    ["echo hello | tr a-z A-Z", "HELLO"],
    ["echo hello | tr -d l", "heo"],
    ["echo aabbcc | tr -s a-c", "abc"],
    ["echo a1b2 | tr -cd '[:digit:]'", "12%"],
    ["echo hello | tr el ip", "hippo"],
    ["echo a | tr aba xyz", "z"],
    ["echo a | tr -c a 0123456789ABCDEF", "aA%"],
    ["echo abbb | tr -ds a b", "b"],
    ["echo az- | tr 'a\\-z' XYZ", "XZY"],
    ["echo a | tr '\\012' ':'", "a:%"],
    ["echo a b | tr ' ' '\\t'", "a\tb"],
  ])("%s gives %s", async (line, answer) => {
    const session = await newSession();
    const said = await run(session, line);
    expect(said.replace(/ +/g, "\t")).toBe(answer.replace(/\n$/, ""));
  });

  it("asks for what to do", async () => {
    const session = await newSession();
    expect(await run(session, "echo a | tr a")).toContain("usage: tr");
    expect(await run(session, "echo a | tr a ''")).toBe("tr: empty string2");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo a | tr -s a ''")).toBe("tr: empty string2");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo abbb | tr -ds a")).toContain("usage: tr");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo a | tr a b c")).toContain("usage: tr");
    expect(session.scope.status).toBe(1);
  });
});

describe("cut", () => {
  it("takes fields and characters", async () => {
    const session = await newSession();
    expect(await run(session, "echo a:b:c | cut -d : -f 2")).toBe("b");
    expect(await run(session, "echo a:b:c | cut -d: -f1,3")).toBe("a:c");
    expect(await run(session, "echo a:b:c | cut -d: -f2-")).toBe("b:c");
    expect(await run(session, "echo abcdef | cut -c 2-4")).toBe("bcd");
    expect(await run(session, "echo nothing | cut -d: -f2")).toBe("nothing");
    expect(await run(session, "echo a | cut")).toContain("usage: cut");
    expect(await run(session, "echo a::b | cut -d :: -f 2")).toBe("cut: bad delimiter");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo a | cut -f x")).toContain("usage: cut");
    for (const list of ["-c 0", "-c 3-1", "-c 1 -f 1"]) {
      expect(await run(session, `echo a | cut ${list}`)).toContain("usage: cut");
      expect(session.scope.status).toBe(1);
    }
  });
});

describe("which and env", () => {
  it("which names what the shell has, and fails on the rest", async () => {
    const session = await newSession();
    expect(await run(session, "which sed tr")).toBe("/bin/sed\n/bin/tr");
    expect(await run(session, "which nosuch")).toBe("nosuch not found");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "which -s sed")).toBe("");
    expect(session.scope.status).toBe(0);
  });

  it("which answers for what really runs", async () => {
    const session = await newSession();
    expect(await run(session, "which vim")).toBe("vim not found");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "which -s vim")).toBe("");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "which cd")).toBe("cd: shell built-in command");
    expect(await run(session, "which -a echo")).toBe("echo: shell built-in command\n/bin/echo");
    await run(session, "alias ll='ls -l'");
    expect(await run(session, "which ll")).toBe("ll: aliased to ls -l");
    expect(await run(session, "/bin/echo plum")).toBe("plum");
    expect(await run(session, "/bin/vim")).toBe("zsh: no such file or directory: /bin/vim");
    expect(session.scope.status).toBe(127);
  });

  it("env lists the environment, with where the shell is", async () => {
    const session = await newSession();
    await run(session, "cd /");
    const said = await run(session, "env | grep PWD");
    expect(said).toContain("\nPWD=/");
    expect(await run(session, "env FRUIT=plum env | grep FRUIT")).toBe("FRUIT=plum");
    expect(await run(session, "env FRUIT=plum echo done")).toBe("done");
    expect(await run(session, "echo x$FRUIT")).toBe("x");
    expect(await run(session, "env -i pwd")).toBe("env: illegal option -- i");
    expect(session.scope.status).toBe(1);
  });
});
