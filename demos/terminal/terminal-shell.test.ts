import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type DriveStandIn, standInDrive, waitFor } from "./terminal-drive-stand-in";
import { columnize } from "./terminal-line-editor";

/*
 * The shell as a person uses it: bytes typed at the prompt, the terminal's text read back. Files go
 * through the desktop's real drive client to a stand-in for its routes (`terminal-drive-stand-in`),
 * which replaces the Ferrite server here and only here.
 */

let drive: DriveStandIn;
type Session = import("./terminal-shell").TerminalSession;

async function newSession(rows = 24, cols = 80): Promise<Session> {
  const { TerminalSession } = await import("./terminal-shell");
  const session = new TerminalSession({ rows, cols });
  await session.start();
  return session;
}

const settled = (session: Session) => waitFor(() => expect(session.editor.reading).toBe(true));

/** Types a line and answers what it wrote: the text between its line and the next prompt. */
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

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  drive = standInDrive();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a session", () => {
  it("⌃Z with no job does nothing, as at zsh's own prompt", async () => {
    const session = await newSession();
    session.input("echo kept");
    session.input("\x1a");
    await settled(session);
    expect(
      session.emulator.textBetween(
        { line: session.emulator.cursorLine, column: 0 },
        { line: session.emulator.cursorLine, column: session.emulator.cols },
      ),
    ).toContain("echo kept");
    expect(await run(session, "")).toBe("kept");
  });

  it("says what it is, and prompts as zsh does", async () => {
    const session = await newSession();
    expect(session.emulator.rowText(0)).toBe(
      "This is a simulated shell in the page. It works on the files of this desktop.",
    );
    expect(session.emulator.rowText(1)).toContain("help lists its commands");
    expect(session.emulator.rowText(2)).toBe("shackett@ismhpro ~ %");
  });

  it("ends with exit, at its status", async () => {
    const session = await newSession();
    session.input("exit 7\r");
    await waitFor(() => expect(session.ended).toBe(true));
    expect(session.scope.status).toBe(7);
    expect(session.emulator.allText()).toContain("[Process completed]");
  });

  it("keeps what was typed on the live line across Up and Down, each time", async () => {
    const session = await newSession();
    await run(session, "echo past");
    session.input("draft\x1b[A\x1b[B more\x1b[A\x1b[B");
    expect(session.editor.line).toBe("draft more");
  });
});

describe("the words of a line", () => {
  it("takes quotes and backslashes off", async () => {
    const session = await newSession();
    expect(await run(session, `echo 'a  b' "c d" e\\ f`)).toBe("a  b c d e f");
  });

  it.each([
    "echo `pwd`",
    "echo ${HOME:?x}",
    "echo $$",
    "A=1 pwd",
    "A=1 > out.txt",
    "ls {a",
    "ls [ab",
    "ls > *.txt",
    "(pwd)",
    "# a comment",
  ])("refuses %s, with a status of 1", async (line) => {
    const session = await newSession();
    expect(await run(session, line)).toContain("not here yet");
    expect(session.scope.status).toBe(1);
  });

  it("expands braces into words, inside out, and leaves quoted ones alone", async () => {
    const session = await newSession();
    expect(await run(session, "echo a{b,c}d")).toBe("abd acd");
    expect(await run(session, "echo {1..3} {c..a}")).toBe("1 2 3 c b a");
    expect(await run(session, "echo {a,{b,c}}x")).toBe("ax bx cx");
    expect(await run(session, "echo '{a,b}' \\{a")).toBe("{a,b} {a");
    expect(await run(session, 'V=1; echo ${V}{x,y} "{p,q}"')).toBe("1x 1y {p,q}");
  });

  it("refuses more brace words than a line should make", async () => {
    const session = await newSession();
    expect(await run(session, "echo {1..100000}")).toContain("not here yet");
  });

  it("applies a parameter's modifier", async () => {
    const session = await newSession();
    await run(session, "F=archive.tar.gz; E=");
    expect(await run(session, "echo ${#F}")).toBe("14");
    expect(await run(session, "echo ${E:-empty} ${F:-empty}")).toBe("empty archive.tar.gz");
    expect(await run(session, "echo ${F:+set}x ${E:+set}x")).toBe("setx x");
    expect(await run(session, "echo ${N:=made}; echo $N")).toBe("made\nmade");
    expect(await run(session, "echo ${F%.*} ${F%%.*}")).toBe("archive.tar archive");
    expect(await run(session, "echo ${F#*.} ${F##*.}")).toBe("tar.gz gz");
    expect(await run(session, "echo ${F/a/A} ${F//a/A}")).toBe("Archive.tar.gz Archive.tAr.gz");
    expect(await run(session, 'echo "${E:-two words}"')).toBe("two words");
  });

  it("expands *, ? and [...] on the drive's names, sorted", async () => {
    drive.addFile("documents", "b.txt", "two");
    drive.addFile("documents", "a.txt", "one");
    drive.addFile("documents", "a.md", "three");
    drive.addFile("documents", ".hidden.txt", "secret");
    const folder = drive.addFolder("documents", "sub");
    drive.addFile(folder, "c.txt", "four");
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "echo *.txt")).toBe("a.txt b.txt");
    expect(await run(session, "echo ?.md")).toBe("a.md");
    expect(await run(session, "echo [ab].txt")).toBe("a.txt b.txt");
    expect(await run(session, "echo [!a].txt")).toBe("b.txt");
    expect(await run(session, "echo [a-b].md")).toBe("a.md");
    expect(await run(session, "echo .*.txt")).toBe(".hidden.txt");
    expect(await run(session, "echo */c.txt")).toBe("sub/c.txt");
    expect(await run(session, "echo s*/")).toBe("sub/");
    expect(await run(session, "echo a*/")).toBe("zsh: no matches found: a*/");
    expect(await run(session, "echo ~/Doc*")).toBe("/Users/shackett/Documents");
    expect(await run(session, "cat *.txt")).toContain("onetwo");
  });

  it("keeps a quoted, escaped or stored pattern as text", async () => {
    drive.addFile("documents", "a.txt", "one");
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "echo '*' \"*\" \\*")).toBe("* * *");
    expect(await run(session, 'A=*; echo "$A"; echo $A')).toBe("*\n*");
    expect(await run(session, "D=Doc; cd ..; echo $D*")).toBe("Documents");
  });

  it("ends the line when a pattern matches nothing, as zsh does", async () => {
    const session = await newSession();
    expect(await run(session, "echo first; echo *.nothing; echo after")).toBe(
      "first\nzsh: no matches found: *.nothing",
    );
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo *.nothing | wc -l; echo after")).toBe(
      "zsh: no matches found: *.nothing",
    );
    expect(await run(session, "echo [z-a]")).toBe("zsh: no matches found: [z-a]");
    expect(await run(session, "echo [/]")).toBe("zsh: no matches found: [/]");
    expect(await run(session, "echo [a/b]")).toBe("zsh: no matches found: [a/b]");
  });

  it("goes only through folders on the way to a name", async () => {
    drive.addFile("documents", "a.txt", "one");
    drive.addFile("documents", "kept", "two");
    drive.addFolder("documents", "sub");
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "echo *.txt/../kept")).toBe("zsh: no matches found: *.txt/../kept");
    expect(await run(session, "echo s*/../kept")).toBe("sub/../kept");
  });

  it("erases what a pattern names, and only that", async () => {
    drive.addFile("documents", "a.tmp", "one");
    drive.addFile("documents", "b.tmp", "two");
    drive.addFile("documents", "kept.txt", "three");
    const session = await newSession();
    await run(session, "cd Documents");
    await run(session, "rm *.tmp");
    expect(drive.idOf("Documents/a.tmp")).toBeUndefined();
    expect(drive.idOf("Documents/b.tmp")).toBeUndefined();
    expect(drive.textOf("Documents/kept.txt")).toBe("three");
  });

  it("expands variables, sets them and tells the last status", async () => {
    const session = await newSession();
    expect(await run(session, "echo $HOME")).toBe("/Users/shackett");
    expect(await run(session, 'echo "${USER}x"')).toBe("shackettx");
    expect(await run(session, "echo '$HOME'")).toBe("$HOME");
    expect(await run(session, "echo \\$HOME")).toBe("$HOME");
    expect(await run(session, "echo 5$")).toBe("5$");
    expect(await run(session, "A='two words'")).toBe("");
    expect(await run(session, 'echo "$A"; echo $A')).toBe("two words\ntwo words");
    expect(await run(session, "B=$A!; echo $B")).toBe("two words!");
    expect(await run(session, "cat nosuch; echo $?")).toBe(
      "cat: nosuch: No such file or directory\n1",
    );
    expect(await run(session, "echo $?")).toBe("0");
    expect(await run(session, "nosuchcommand; echo ${?}")).toBe(
      "zsh: command not found: nosuchcommand\n127",
    );
  });

  it("drops a word that was only an empty variable, but not one with a quote in it", async () => {
    const session = await newSession();
    expect(await run(session, 'echo x $NOSUCH y "$NOSUCH" z')).toBe("x y  z");
    expect(await run(session, 'echo x ""$NOSUCH y')).toBe("x  y");
    expect(await run(session, "$NOSUCH")).toBe("");
    expect(session.scope.status).toBe(0);
    expect(await run(session, "$NOSUCH > out.txt")).toContain("needs a command");
    expect(session.scope.status).toBe(1);
  });

  it("assigns one word at a time, and only a word written as an assignment", async () => {
    const session = await newSession();
    expect(await run(session, "A=first B=$A; echo $B")).toBe("first");
    expect(await run(session, "'C=1'")).toBe("zsh: command not found: C=1");
    expect(session.scope.status).toBe(127);
    expect(await run(session, "\\D=1")).toBe("zsh: command not found: D=1");
    expect(await run(session, "E=1=2; echo $E")).toBe("1=2");
    expect(await run(session, "echo F=1; echo x$F")).toBe("F=1\nx");
  });

  it("refuses an assignment before a command before anything on the line runs", async () => {
    drive.addFile("documents", "note.txt", "kept");
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "echo changed > note.txt; A=1 pwd")).toContain("not here yet");
    expect(drive.textOf("Documents/note.txt")).toBe("kept");
  });

  it("keeps what it inherited in the same store as the rest", async () => {
    const session = await newSession();
    expect(await run(session, "export HOME; echo $HOME")).toBe("/Users/shackett");
    expect(await run(session, "USER=me; env | grep '^USER='")).toBe("USER=me");
    expect(await run(session, "unset HOME; echo x$HOME; env | grep -c '^HOME='")).toBe("x\n0");
    await run(session, "cd Documents");
    expect(await run(session, "echo $PWD $OLDPWD")).toBe(
      "/Users/shackett/Documents /Users/shackett",
    );
    expect(await run(session, "cd .; echo $OLDPWD; env | grep '^OLDPWD='")).toBe(
      "/Users/shackett/Documents\nOLDPWD=/Users/shackett/Documents",
    );
    expect(await run(session, 'PWD=wrong; OLDPWD=wrong; cd .; echo "$PWD|$OLDPWD"')).toBe(
      "/Users/shackett/Documents|/Users/shackett/Documents",
    );
    expect(await run(session, "env | grep -c '^PWD=/Users/shackett/Documents$'")).toBe("1");
  });

  it("exports and unsets; only the last command of a pipeline reaches the shell, as in zsh", async () => {
    const session = await newSession();
    expect(await run(session, "A=1")).toBe("");
    expect(await run(session, "env | grep -c '^A='")).toBe("0");
    expect(await run(session, "export A")).toBe("");
    expect(await run(session, "env | grep '^A='")).toBe("A=1");
    expect(await run(session, "export B=2; export | grep -c 'B=2'")).toBe("1");
    expect(await run(session, "unset A; echo x$A")).toBe("x");
    expect(await run(session, "C=3 | cat; echo x$C")).toBe("x");
    expect(await run(session, "export D=4 | cat; echo x$D")).toBe("x");
    expect(await run(session, "echo hi | E=5; echo $E")).toBe("5");
    expect(await run(session, "echo hi | export F=6; echo $F")).toBe("6");
    expect(await run(session, "export 1a")).toBe("export: not an identifier: 1a");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "unset 1a")).toBe("unset: 1a: invalid parameter name");
    expect(await run(session, "echo hi > $HOME/Documents/out.txt; cat ~/Documents/out.txt")).toBe(
      "hi",
    );
  });

  it("runs the commands of a line with ;, && and ||", async () => {
    const session = await newSession();
    expect(await run(session, "echo a; echo b")).toBe("a\nb");
    expect(await run(session, "echo a;")).toBe("a");
    expect(await run(session, "echo a && echo b")).toBe("a\nb");
    expect(await run(session, "cat nosuch && echo b")).toBe(
      "cat: nosuch: No such file or directory",
    );
    expect(session.scope.status).toBe(1);
    expect(await run(session, "cat nosuch || echo b")).toBe(
      "cat: nosuch: No such file or directory\nb",
    );
    expect(session.scope.status).toBe(0);
    expect(await run(session, "echo a || echo b; echo c")).toBe("a\nc");
    expect(await run(session, "cat nosuch && echo b || echo c")).toBe(
      "cat: nosuch: No such file or directory\nc",
    );
    expect(await run(session, "echo 'a; b' \"c && d\" e\\;f")).toBe("a; b c && d e;f");
  });

  it("keeps a change of folder for the next command of the line", async () => {
    const session = await newSession();
    expect(await run(session, "cd Documents; pwd")).toBe("/Users/shackett/Documents");
  });

  it.each([
    ["; echo a", "zsh: parse error near `;'"],
    ["echo a;; echo b", "zsh: parse error near `;'"],
    ["&& echo a", "zsh: parse error near `&&'"],
    ["echo a || || echo b", "zsh: parse error near `||'"],
    ["echo a &&", "zsh: parse error near `\\n'"],
    ["echo a ||", "zsh: parse error near `\\n'"],
  ])("refuses %s and runs none of it", async (line, message) => {
    const session = await newSession();
    expect(await run(session, line)).toBe(message);
    expect(session.scope.status).toBe(1);
  });

  it("ends the line at exit, and runs nothing after it", async () => {
    drive.addFile("documents", "kept.txt", "K");
    const session = await newSession();
    session.input("exit 3; rm Documents/kept.txt\r");
    await waitFor(() => expect(session.ended).toBe(true));
    expect(session.scope.status).toBe(3);
    expect(drive.textOf("Documents/kept.txt")).toBe("K");
  });

  it("takes those characters as text in quotes", async () => {
    const session = await newSession();
    expect(await run(session, "echo 'a | b > c'")).toBe("a | b > c");
  });

  it("asks for more when a quote is not closed, and takes the new line into it", async () => {
    const session = await newSession();
    session.input("echo 'a\r");
    await settled(session);
    expect(session.emulator.allText()).toContain("quote>");
    expect(await run(session, "b'")).toBe("a\nb");
  });
});

describe("pipes and the text tools", () => {
  const FRUIT = "pear 3\napple 10\nPlum 2\napple 10\n";
  async function inDocuments() {
    drive.addFile("documents", "fruit.txt", FRUIT);
    const session = await newSession();
    await run(session, "cd Documents");
    return session;
  }

  it("feeds each command what the one before wrote, and takes the last one's status", async () => {
    const session = await inDocuments();
    expect(await run(session, "echo one two | cat")).toBe("one two");
    expect(await run(session, "cat fruit.txt | grep apple | wc -l")).toBe("       2");
    expect(await run(session, "cat nosuch | wc -l")).toBe(
      "cat: nosuch: No such file or directory\n       0",
    );
    expect(session.scope.status).toBe(0);
    expect(await run(session, "echo a | grep b")).toBe("");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo a | grep a && echo yes")).toBe("a\nyes");
    expect(await run(session, "nosuch | wc -l")).toBe("zsh: command not found: nosuch\n       0");
  });

  it("lists one name a line into a pipe, however wide the window", async () => {
    drive.addFile("documents", "a.txt", "");
    const session = await inDocuments();
    expect(await run(session, "ls | wc -l")).toBe("       2");
    expect(await run(session, "ls | head -n 1")).toBe("a.txt");
  });

  it("keeps the shell as it was when cd or exit runs before a pipe, and not after", async () => {
    const session = await inDocuments();
    await run(session, "cd .. | cat");
    expect(session.scope.cwd).toBe("/Users/shackett/Documents");
    await run(session, "exit 3 | cat");
    expect(session.ended).toBe(false);
    await run(session, "echo a | cd ..");
    expect(session.scope.cwd).toBe("/Users/shackett");
    session.input("echo a | exit 4\r");
    await waitFor(() => expect(session.ended).toBe(true));
    expect(session.scope.status).toBe(4);
  });

  it.each([
    ["| wc", "zsh: parse error near `|'"],
    ["echo a | | wc", "zsh: parse error near `|'"],
    ["echo a | ; wc", "zsh: parse error near `;'"],
    ["echo a |", "zsh: parse error near `\\n'"],
  ])("refuses %s whole", async (line, problem) => {
    const session = await newSession();
    expect(await run(session, line)).toBe(problem);
  });

  it("takes | as text in quotes", async () => {
    const session = await newSession();
    expect(await run(session, "echo 'a | b' a\\|b")).toBe("a | b a|b");
  });

  it("reads the keyboard until Control-D, when no file and no pipe gives it anything", async () => {
    const session = await newSession();
    const typed = async (line: string, keys: string) => {
      const before = session.emulator.cursorLine;
      session.input(`${line}\r`);
      await waitFor(() => expect(session.editor.reading).toBe(false));
      session.input(keys);
      await settled(session);
      return session.emulator.textBetween(
        { line: before + 1, column: 0 },
        { line: session.emulator.cursorLine - 1, column: session.emulator.cols },
      );
    };
    expect(await typed("sort", "b\ra\r\x04")).toBe("b\na\na\nb");
    expect(await typed("cat", "one\r\x04")).toBe("one\none");
    expect(await typed("wc -l", "x\ry\r\x04")).toBe("x\ny\n       2");
    expect(await typed("tr a b", "aa\r\x04")).toBe("aa\nbb");
    expect(session.scope.status).toBe(0);
  });

  it("stops reading the keyboard at Control-C", async () => {
    const session = await newSession();
    session.input("head\r");
    await waitFor(() => expect(session.editor.reading).toBe(false));
    session.input("\x03");
    await settled(session);
    expect(session.scope.status).toBe(130);
  });

  it.each([
    ["grep apple fruit.txt", "apple 10\napple 10"],
    ["grep -c apple fruit.txt", "2"],
    ["grep -i plum fruit.txt", "Plum 2"],
    ["grep -v apple fruit.txt", "pear 3\nPlum 2"],
    ["grep -n pear fruit.txt", "1:pear 3"],
    ["grep -l pear fruit.txt", "fruit.txt"],
    ["grep -H pear fruit.txt", "fruit.txt:pear 3"],
    ["grep -o '[0-9][0-9]*' fruit.txt", "3\n10\n2\n10"],
    ["grep -E 'pear|Plum' fruit.txt", "pear 3\nPlum 2"],
    ["grep 'pear|Plum' fruit.txt", ""],
    ["grep -F . fruit.txt", ""],
    ["grep -w app fruit.txt", ""],
    ["grep -x 'pear 3' fruit.txt", "pear 3"],
    ["grep '^[[:upper:]]' fruit.txt", "Plum 2"],
    ["grep '[^a-z 0-9]' fruit.txt", "Plum 2"],
    ["echo 'a]' | grep 'a]'", "a]"],
    ["head -n 1 fruit.txt", "pear 3"],
    ["head -1 fruit.txt", "pear 3"],
    ["cat fruit.txt | head -n 2", "pear 3\napple 10"],
    ["tail -n 1 fruit.txt", "apple 10"],
    ["tail -1 fruit.txt", "apple 10"],
    ["tail -n +3 fruit.txt", "Plum 2\napple 10"],
    ["tail -n 0 fruit.txt", ""],
    ["wc fruit.txt", "       4       8      32 fruit.txt"],
    ["wc -w fruit.txt", "       8 fruit.txt"],
    ["cat fruit.txt | wc -c", "      32"],
    ["echo é | wc -m", "       2"],
    ["sort fruit.txt", "Plum 2\napple 10\napple 10\npear 3"],
    ["sort -f fruit.txt", "apple 10\napple 10\npear 3\nPlum 2"],
    ["sort -r fruit.txt", "pear 3\napple 10\napple 10\nPlum 2"],
    ["sort -u fruit.txt", "Plum 2\napple 10\npear 3"],
    ["sort -n -k 2 fruit.txt", "Plum 2\npear 3\napple 10\napple 10"],
    ["sort -t ' ' -k 2 fruit.txt", "apple 10\napple 10\nPlum 2\npear 3"],
    ["sort fruit.txt | uniq", "Plum 2\napple 10\npear 3"],
    ["sort fruit.txt | uniq -c", "   1 Plum 2\n   2 apple 10\n   1 pear 3"],
    ["sort fruit.txt | uniq -d", "apple 10"],
    ["sort fruit.txt | uniq -u", "Plum 2\npear 3"],
    ["sort fruit.txt | uniq -du", ""],
    ["sort fruit.txt | uniq -ud", ""],
    ["echo -error | grep -e -error", "-error"],
    ["echo - | grep -w -", "-"],
    ["echo a-b | grep -w -", ""],
    ["tail -n -2 fruit.txt", "Plum 2\napple 10"],
    ["tail +3 fruit.txt", "Plum 2\napple 10"],
  ])("%s", async (line, expected) => {
    const session = await inDocuments();
    expect(await run(session, line)).toBe(expected);
  });

  it("names files when there are several, and carries on past one it cannot read", async () => {
    drive.addFile("documents", "more.txt", "pear 9\n");
    const session = await inDocuments();
    expect(await run(session, "grep pear fruit.txt more.txt")).toBe(
      "fruit.txt:pear 3\nmore.txt:pear 9",
    );
    expect(await run(session, "grep -h pear fruit.txt more.txt")).toBe("pear 3\npear 9");
    expect(await run(session, "grep pear nosuch more.txt")).toBe(
      "grep: nosuch: No such file or directory\nmore.txt:pear 9",
    );
    expect(session.scope.status).toBe(2);
    expect(await run(session, "head -n 1 fruit.txt more.txt")).toBe(
      "==> fruit.txt <==\npear 3\n\n==> more.txt <==\npear 9",
    );
    expect(await run(session, "wc -l fruit.txt more.txt")).toBe(
      "       4 fruit.txt\n       1 more.txt\n       5 total",
    );
    expect(await run(session, "sort nosuch more.txt")).toBe(
      "sort: nosuch: No such file or directory",
    );
    expect(session.scope.status).toBe(2);
  });

  it("takes what comes after -- as names, and reads numbers without exponents", async () => {
    drive.addFile("documents", "-1", "minus\n");
    drive.addFile("documents", "+3", "plus\n");
    drive.addFile("documents", "numbers.txt", "1e3\n2\n");
    const session = await inDocuments();
    expect(await run(session, "head -- -1")).toBe("minus");
    expect(await run(session, "tail -- +3")).toBe("plus");
    expect(await run(session, "sort -n numbers.txt")).toBe("1e3\n2");
  });

  it("refuses a pattern that could hang the page, and takes the same group unrepeated", async () => {
    drive.addFile("documents", "bad.txt", `${"a".repeat(40)}!\n`);
    const session = await inDocuments();
    for (const pattern of ["^(a+)+$", "(a|a)*b", "((a*))+", "(a{2,})*"]) {
      expect(await run(session, `grep -E '${pattern}' bad.txt`)).toContain("could hang the page");
      expect(session.scope.status).toBe(2);
    }
    expect(await run(session, "grep '\\(a*\\)*b' bad.txt")).toContain("could hang the page");
    expect(await run(session, "grep 'a*a*a*a*a*a*a*a*b' bad.txt")).toContain("could hang the page");
    expect(session.scope.status).toBe(2);
    expect(await run(session, "grep -c 'a*a*a*a*!' bad.txt")).toBe("1");
    expect(await run(session, "grep -cE '(a+)!' bad.txt")).toBe("1");
    expect(await run(session, "grep -cE '(ab)+|a' bad.txt")).toBe("1");
  });

  it("keeps the separators inside a sort key", async () => {
    drive.addFile("documents", "keys.txt", "a:b\na b:a\n");
    const session = await inDocuments();
    expect(await run(session, "sort -t : -k 1 keys.txt")).toBe("a b:a\na:b");
  });

  it("takes several patterns with -e, a line matching any", async () => {
    const session = await inDocuments();
    expect(await run(session, "grep -e pear -e Plum fruit.txt")).toBe("pear 3\nPlum 2");
    expect(await run(session, "grep -c -e apple -e pear fruit.txt")).toBe("3");
    expect(await run(session, "grep -v -e apple -e pear fruit.txt")).toBe("Plum 2");
    expect(await run(session, "grep -F -e . -e pear fruit.txt")).toBe("pear 3");
    expect(await run(session, "grep -epear -ePlum fruit.txt")).toBe("pear 3\nPlum 2");
    expect(await run(session, "grep -w -e pear -e app fruit.txt")).toBe("pear 3");
    expect(await run(session, "grep -e pear -e '(a+)+' fruit.txt")).toBe("pear 3");
    expect(await run(session, "grep -E -e pear -e '(a+)+' fruit.txt")).toContain(
      "could hang the page",
    );
  });

  it("searches under a folder with -r, naming each file from where it started", async () => {
    const session = await inDocuments();
    await run(session, "mkdir Deep Deep/Deeper Empty");
    await run(session, "echo pear 8 > Deep/one.txt; echo pear 9 > Deep/Deeper/two.txt");
    await run(session, "echo plum > Deep/none.txt");
    expect(await run(session, "grep -r pear Deep")).toBe(
      "Deep/Deeper/two.txt:pear 9\nDeep/one.txt:pear 8",
    );
    expect(await run(session, "grep -R pear Deep/")).toBe(
      "Deep/Deeper/two.txt:pear 9\nDeep/one.txt:pear 8",
    );
    expect(await run(session, "grep -rh pear Deep")).toBe("pear 9\npear 8");
    expect(await run(session, "grep -rl pear Deep")).toBe("Deep/Deeper/two.txt\nDeep/one.txt");
    expect(await run(session, "grep -rc pear Deep/Deeper")).toBe("Deep/Deeper/two.txt:1");
    expect(await run(session, "grep -r pear fruit.txt")).toBe("fruit.txt:pear 3");
    expect(await run(session, "grep -r pear Empty")).toBe("");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "grep -r pear nosuch")).toBe(
      "grep: nosuch: No such file or directory",
    );
    expect(session.scope.status).toBe(2);
    expect(await run(session, "grep pear Deep")).toBe("grep: Deep: Is a directory");
    expect(await run(session, "echo pear | grep -r pear")).toBe(
      "grep: warning: recursive search of stdin\npear",
    );
  });

  it("says a binary file matches instead of writing it", async () => {
    drive.addFile("documents", "data.bin", "pear\0\x01\n");
    const session = await inDocuments();
    expect(await run(session, "grep pear data.bin")).toBe("Binary file data.bin matches");
    expect(await run(session, "grep -c pear data.bin")).toBe("1");
    expect(await run(session, "grep plum data.bin")).toBe("");
  });

  it("answers grep's statuses", async () => {
    const session = await inDocuments();
    expect(await run(session, "grep -q pear fruit.txt")).toBe("");
    expect(session.scope.status).toBe(0);
    await run(session, "grep -q nothing fruit.txt");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "grep '(' fruit.txt")).toBe("");
    expect(await run(session, "grep -E '(' fruit.txt")).toBe("grep: invalid regular expression");
    expect(session.scope.status).toBe(2);
    expect(await run(session, "grep")).toContain("usage: grep");
    expect(await run(session, "grep -e")).toContain("usage: grep");
    expect(await run(session, "echo '[' | grep '['")).toBe("grep: invalid regular expression");
    expect(session.scope.status).toBe(2);
    expect(await run(session, "echo -error | grep -e -error")).toBe("-error");
    expect(session.scope.status).toBe(0);
  });

  it("refuses options and counts it does not have, and an empty file name", async () => {
    const session = await inDocuments();
    expect(await run(session, "grep -z a fruit.txt")).toBe("grep: illegal option -- z");
    expect(await run(session, "head -q 1 fruit.txt")).toBe("head: illegal option -- q");
    expect(await run(session, "head -n x fruit.txt")).toBe("head: illegal line count -- x");
    expect(await run(session, "tail -n x fruit.txt")).toBe("tail: illegal offset -- x");
    expect(await run(session, "wc -L fruit.txt")).toBe("wc: illegal option -- L");
    expect(await run(session, "sort -k x fruit.txt")).toContain("takes one key");
    expect(await run(session, "echo a | head -n")).toBe("head: illegal line count --");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo a | tail -n")).toBe("tail: illegal offset --");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo a | sort -t")).toBe("sort: option requires an argument -- t");
    expect(session.scope.status).toBe(2);
    expect(await run(session, 'wc ""')).toBe("wc: : No such file or directory");
  });
});

describe("redirection", () => {
  async function inDocuments() {
    drive.addFile("documents", "kept.txt", "kept\n");
    const session = await newSession();
    await run(session, "cd Documents");
    return session;
  }

  it("writes with > and adds with >>, on the screen nothing", async () => {
    const session = await inDocuments();
    expect(await run(session, "echo one > new.txt")).toBe("");
    expect(drive.textOf("Documents/new.txt")).toBe("one\n");
    expect(await run(session, "echo two >> new.txt")).toBe("");
    expect(drive.textOf("Documents/new.txt")).toBe("one\ntwo\n");
    expect(await run(session, "echo three > new.txt")).toBe("");
    expect(drive.textOf("Documents/new.txt")).toBe("three\n");
    expect(await run(session, "echo first >> other.txt")).toBe("");
    expect(drive.textOf("Documents/other.txt")).toBe("first\n");
    expect(await run(session, "echo squeezed>tight.txt")).toBe("");
    expect(drive.textOf("Documents/tight.txt")).toBe("squeezed\n");
    expect(session.scope.status).toBe(0);
  });

  it("writes one name a line when ls goes to a file", async () => {
    drive.addFile("documents", "more.txt", "");
    const session = await inDocuments();
    await run(session, "ls > list");
    expect(drive.textOf("Documents/list")).toBe("kept.txt\nmore.txt\n");
  });

  it("reads with <, for what reads a pipe", async () => {
    const session = await inDocuments();
    expect(await run(session, "wc -l < kept.txt")).toBe("       1");
    expect(await run(session, "cat < nosuch")).toBe("zsh: no such file or directory: nosuch");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "cat < kept.txt > copy.txt")).toBe("");
    expect(drive.textOf("Documents/copy.txt")).toBe("kept\n");
  });

  it("sends errors with 2>, and with 2>&1 where the output goes", async () => {
    const session = await inDocuments();
    expect(await run(session, "cat nosuch 2> errors.txt")).toBe("");
    expect(drive.textOf("Documents/errors.txt")).toBe("cat: nosuch: No such file or directory\n");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "cat kept.txt nosuch > both.txt 2>&1")).toBe("");
    expect(drive.textOf("Documents/both.txt")).toBe(
      "kept\ncat: nosuch: No such file or directory\n",
    );
    expect(await run(session, "cat nosuch 2>&1 > out.txt")).toBe(
      "cat: nosuch: No such file or directory",
    );
    expect(drive.textOf("Documents/out.txt")).toBe("");
    expect(await run(session, "cat nosuch 2>&1 | wc -l")).toBe("       1");
    expect(await run(session, "nosuch 2> notfound.txt")).toBe("");
    expect(drive.textOf("Documents/notfound.txt")).toBe("zsh: command not found: nosuch\n");
    expect(session.scope.status).toBe(127);
  });

  it("reads 2> after a connector or a pipe with no space", async () => {
    const session = await inDocuments();
    expect(await run(session, "echo first;2> errors.txt cat nosuch")).toBe("first");
    expect(drive.textOf("Documents/errors.txt")).toBe("cat: nosuch: No such file or directory\n");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo a|2> piped.txt cat nosuch")).toBe("");
    expect(drive.textOf("Documents/piped.txt")).toBe("cat: nosuch: No such file or directory\n");
  });

  it("refuses a descriptor other than 1 and writes nothing", async () => {
    const session = await inDocuments();
    expect(await run(session, "echo changed 2>&12 > kept.txt")).toContain("not here yet");
    expect(await run(session, "echo changed 3>kept.txt")).toContain("not here yet");
    expect(await run(session, "echo changed 12>kept.txt")).toContain("not here yet");
    expect(await run(session, "cat 0<kept.txt")).toContain("not here yet");
    expect(drive.textOf("Documents/kept.txt")).toBe("kept\n");
    expect(await run(session, "echo one 1> one.txt")).toBe("");
    expect(drive.textOf("Documents/one.txt")).toBe("one\n");
  });

  it("leaves a 2 that is not alone as a word", async () => {
    const session = await inDocuments();
    expect(await run(session, "echo a2 > two.txt")).toBe("");
    expect(drive.textOf("Documents/two.txt")).toBe("a2\n");
    expect(await run(session, "echo '2' > two.txt")).toBe("");
    expect(drive.textOf("Documents/two.txt")).toBe("2\n");
  });

  it("writes what a failing command wrote, and an empty file when it wrote nothing", async () => {
    const session = await inDocuments();
    await run(session, "cat kept.txt nosuch > part.txt");
    expect(drive.textOf("Documents/part.txt")).toBe("kept\n");
    expect(session.scope.status).toBe(1);
    await run(session, "grep nothing kept.txt > empty.txt");
    expect(drive.textOf("Documents/empty.txt")).toBe("");
  });

  it("runs nothing and changes nothing when a target cannot be used", async () => {
    const session = await inDocuments();
    expect(await run(session, "echo a > none/new.txt")).toBe(
      "zsh: no such file or directory: none/new.txt",
    );
    expect(session.scope.status).toBe(1);
    expect(await run(session, "echo a > ../x")).toContain("the home folder holds only");
    expect(await run(session, "echo a > ..")).toBe("zsh: is a directory: ..");
    drive.addFolder("documents", "tree");
    expect(await run(session, "echo a > tree")).toBe("zsh: is a directory: tree");
    expect(await run(session, "echo a > kept.txt/x")).toBe("zsh: not a directory: kept.txt/x");
    expect(await run(session, 'echo a > ""')).toBe("zsh: no such file or directory:");
    expect(await run(session, "rm kept.txt > tree")).toBe("zsh: is a directory: tree");
    expect(drive.textOf("Documents/kept.txt")).toBe("kept\n");
  });

  it("keeps a shell command's effect when it is redirected", async () => {
    const session = await inDocuments();
    await run(session, "cd .. > cd.txt");
    expect(session.scope.cwd).toBe("/Users/shackett");
    expect(drive.textOf("Documents/cd.txt")).toBe("");
  });

  it.each([
    ["echo a >", "zsh: parse error near `\\n'"],
    ["echo a > | wc", "zsh: parse error near `|'"],
    ["echo a > ; echo b", "zsh: parse error near `;'"],
    ["echo a > > f", "zsh: parse error near `>'"],
    ["> f", "zsh: this first version needs a command before a redirection"],
    ["< f", "zsh: this first version needs a command before a redirection"],
  ])("refuses %s whole", async (line, problem) => {
    const session = await inDocuments();
    expect(await run(session, line)).toBe(problem);
    expect(drive.idOf("Documents/f")).toBeUndefined();
  });

  it.each([
    "echo a > f > g",
    "echo a 2> f 2> g",
    "cat < f < g",
    "echo a > f | wc",
    "echo a | cat < f",
    "echo a 2> f 2>&1",
    "echo a 2>&1 2> f",
  ])("refuses %s, which zsh would read as several, and writes nothing", async (line) => {
    const session = await inDocuments();
    expect(await run(session, line)).toContain("one redirection of each stream");
    expect(drive.idOf("Documents/f")).toBeUndefined();
    expect(drive.idOf("Documents/g")).toBeUndefined();
  });

  it.each(["cat <> f", "echo a >| f", "echo a >& f", "echo a &> f"])(
    "refuses %s as not here yet",
    async (line) => {
      const session = await inDocuments();
      expect(await run(session, line)).toContain("not here yet");
      expect(drive.idOf("Documents/f")).toBeUndefined();
    },
  );

  it("takes those characters as text in quotes, and completes a file after them", async () => {
    const session = await inDocuments();
    expect(await run(session, "echo 'a > b' a\\>b")).toBe("a > b a>b");
    session.input("echo a >ke\t");
    await waitFor(() => expect(session.editor.line).toBe("echo a >kept.txt "));
  });

  it("keeps both streams when they go to the same file", async () => {
    const session = await inDocuments();
    expect(await run(session, "echo hello > same.txt 2> same.txt")).toBe("");
    expect(drive.textOf("Documents/same.txt")).toBe("hello\n");
    expect(await run(session, "cat kept.txt nosuch > same.txt 2> ./same.txt")).toBe("");
    expect(drive.textOf("Documents/same.txt")).toBe(
      "kept\ncat: nosuch: No such file or directory\n",
    );
    expect(await run(session, "echo hello >> same.txt 2> same.txt")).toBe("");
    expect(drive.textOf("Documents/same.txt")).toBe("hello\n");
  });

  it("leaves the file alone when Control-C comes while the input is read", async () => {
    drive.addFile("documents", "existing.txt", "old\n");
    const session = await inDocuments();
    const realFetch = globalThis.fetch;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reading = false;
    vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
      if (String(input).includes("/content/")) {
        reading = true;
        await gate;
      }
      return realFetch(input, init);
    });
    session.input("cat < kept.txt > existing.txt\r");
    await waitFor(() => expect(reading).toBe(true));
    session.input("\x03");
    release();
    await settled(session);
    expect(session.scope.status).toBe(130);
    expect(drive.textOf("Documents/existing.txt")).toBe("old\n");
    expect(await run(session, "echo next")).toBe("next");
  });

  it("leaves the file alone when Control-C comes while >> reads it", async () => {
    drive.addFile("documents", "existing.txt", "old\n");
    const session = await inDocuments();
    const realFetch = globalThis.fetch;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reading = false;
    vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
      if (String(input).includes("/content/")) {
        reading = true;
        await gate;
      }
      return realFetch(input, init);
    });
    session.input("echo new >> existing.txt\r");
    await waitFor(() => expect(reading).toBe(true));
    session.input("\x03");
    release();
    await settled(session);
    expect(session.scope.status).toBe(130);
    expect(drive.textOf("Documents/existing.txt")).toBe("old\n");
    expect(await run(session, "echo next")).toBe("next");
  });

  it("says so and leaves the file alone when a command writes too much for it", async () => {
    const big = "x".repeat(9 * 1024 * 1024);
    drive.addFile("documents", "big1", big);
    drive.addFile("documents", "big2", big);
    const session = await inDocuments();
    expect(await run(session, "cat big1 big2 > out.txt 2>&1")).toBe(
      "zsh: too much for a redirection here",
    );
    expect(session.scope.status).toBe(1);
    expect(drive.idOf("Documents/out.txt")).toBeUndefined();
    expect(await run(session, "echo next")).toBe("next");
  });

  it("adds to the file's bytes as they are", async () => {
    const id = drive.addFile("documents", "bytes.bin", "");
    drive.bytes.set(id, new Uint8Array([0xff, 0xfe]));
    (drive.entries.get(id) as { size: number }).size = 2;
    const session = await inDocuments();
    expect(await run(session, "echo a >> bytes.bin")).toBe("");
    expect([...(drive.bytes.get(id) as Uint8Array)]).toEqual([0xff, 0xfe, 0x61, 0x0a]);
  });
});

describe("the commands", () => {
  it("reads echo's escapes, as zsh's does", async () => {
    const session = await newSession();
    expect(await run(session, "echo 'a\\tb'")).toBe("a       b");
    expect(await run(session, "echo 'one\\ntwo'")).toBe("one\ntwo");
    expect(await run(session, "echo 'a\\\\nb'")).toBe("a\\nb");
  });

  it("puts the terminal back as it started with reset", async () => {
    const session = await newSession();
    await run(session, "echo marked");
    await run(session, "reset");
    expect(session.scope.status).toBe(0);
    expect(session.emulator.cursor.column).toBeLessThan(80);
    expect(await run(session, "echo after")).toBe("after");
  });

  it("answers an unknown name, and a name from another version, as not found", async () => {
    const session = await newSession();
    for (const name of ["nosuch", "pico", "constructor"]) {
      expect(await run(session, `${name} x`)).toBe(`zsh: command not found: ${name}`);
      expect(session.scope.status).toBe(127);
    }
  });

  it("lists its commands with help, and says what is not here", async () => {
    const session = await newSession();
    const text = await run(session, "help");
    for (const name of [
      "pwd",
      "cd",
      "ls",
      "cat",
      "mkdir",
      "rm",
      "mv",
      "cp",
      "touch",
      "echo",
      "exit",
    ]) {
      expect(text).toContain(name);
    }
    expect(text).toContain("erase for real");
    expect(text).toContain("not here yet");
  });

  it("moves with cd and tells with pwd, and cd - goes back", async () => {
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "pwd")).toBe("/Users/shackett/Documents");
    expect(await run(session, "cd -")).toBe("/Users/shackett");
    expect(await run(session, "cd nosuch")).toBe("cd: no such file or directory: nosuch");
    expect(session.scope.status).toBe(1);
    expect(await run(session, "cd ~/Documents")).toBe("");
    expect(session.scope.cwd).toBe("/Users/shackett/Documents");
  });

  it("lists a folder and shows a file, from the drive", async () => {
    drive.addFile("documents", "note.txt", "hello\nthere\n");
    drive.addFile("documents", ".hidden", "x");
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "ls")).toBe("note.txt");
    expect(await run(session, "ls -a -1")).toBe(".\n..\n.hidden\nnote.txt");
    expect(await run(session, "ls -am")).toBe("., .., .hidden, note.txt");
    const longly = await run(session, "ls -l note.txt");
    const noGroup = await run(session, "ls -o note.txt");
    const noOwner = await run(session, "ls -g note.txt");
    expect(longly).toContain("  staff  ");
    expect(noGroup).not.toContain("staff");
    expect(noOwner).toContain("staff");
    expect(noGroup.length).toBeLessThan(longly.length);
    expect(noOwner.length).toBeLessThan(longly.length);
    await run(session, "mkdir Sub");
    expect(await run(session, "ls -G -1 | grep Sub")).toBe("Sub");
    expect(await run(session, "ls -G -1 -d Sub")).toBe("Sub");
    expect(columnize(["Sub", "a"], 80, (name) => (name === "Sub" ? `<${name}>` : name))).toEqual([
      "<Sub>  a",
    ]);
    expect(await run(session, "cat note.txt")).toBe("hello\nthere");
    expect(await run(session, "cat nosuch")).toBe("cat: nosuch: No such file or directory");
    expect(session.scope.status).toBe(1);
  });

  it("refuses an option it does not have", async () => {
    const session = await newSession();
    expect(await run(session, "ls -u")).toBe("ls: illegal option -- u");
    expect(session.scope.status).toBe(1);
  });

  it("lists with the rest of a Mac's options the drive can answer", async () => {
    drive.addFile("documents", "a.txt", "x".repeat(600));
    drive.addFile("documents", "b.txt", "y");
    drive.addFile("documents", ".c", "z");
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "ls -s -1")).toBe("total 3\n2 a.txt\n1 b.txt");
    expect(await run(session, "ls -sk -1 a.txt")).toBe("1 a.txt");
    expect(await run(session, "ls -C | cat")).toBe("a.txt  b.txt");
    expect(await run(session, "ls -x | cat")).toBe("a.txt  b.txt");
    expect(await run(session, "ls -f -1")).toBe(".\n..\n.c\na.txt\nb.txt");
    expect(await run(session, "ls -ftr -1")).toBe(".\n..\n.c\na.txt\nb.txt");
    expect(await run(session, "ls -1HLPWeqw")).toBe("a.txt\nb.txt");
    const numeric = await run(session, "ls -n b.txt");
    expect(numeric).toMatch(/^-rw-r--r-- {2}1 501 {2}20 {2}1 /);
    const flagged = await run(session, "ls -lO b.txt");
    expect(flagged).toContain("  staff  -  1 ");
    const full = await run(session, "ls -lT b.txt");
    expect(full).toMatch(/ [A-Z][a-z]{2} [ \d]\d \d\d:\d\d:\d\d \d{4} b\.txt$/);
    expect(await run(session, "ls -l")).toMatch(/^total 3\n/);
    expect(columnize(["a", "b", "c", "d"], 6, (name) => name, "across")).toEqual(["a  b", "c  d"]);
    expect(columnize(["a", "b", "c", "d"], 6)).toEqual(["a  c", "b  d"]);
  });

  it("cp -p keeps the mode and asks the drive to keep the date, -a through a folder", async () => {
    drive.addFile("documents", "go.sh", "echo hi\n");
    const session = await newSession();
    await run(session, "cd Documents");
    await run(session, "chmod 750 go.sh");
    const said = await run(session, "cp -p go.sh kept.sh");
    expect(said).toBe("");
    expect(await run(session, "ls -l kept.sh")).toContain("-rwxr-x---");
    await run(session, "cp go.sh plain.sh");
    expect(await run(session, "ls -l plain.sh")).toContain("-rw-r--r--");
    await run(session, "mkdir tree");
    await run(session, "mv kept.sh tree");
    await run(session, "cp -a tree copied");
    expect(await run(session, "ls -l copied/kept.sh")).toContain("-rwxr-x---");
    expect(await run(session, "cp -X go.sh other.sh")).toBe("cp: illegal option -- X");
  });

  it("leaves a file alone when a line is refused", async () => {
    drive.addFile("documents", "note.txt", "kept");
    const session = await newSession();
    await run(session, "cd Documents");
    await run(session, "echo `pwd` > note.txt");
    await run(session, "rm (note).txt");
    expect(drive.textOf("Documents/note.txt")).toBe("kept");
  });

  it("makes and removes folders with mkdir, -p and rmdir", async () => {
    const session = await newSession();
    await run(session, "mkdir Documents/a");
    expect(drive.idOf("Documents/a")).toBeDefined();
    expect(await run(session, "mkdir Documents/a")).toBe("mkdir: Documents/a: File exists");
    await run(session, "mkdir -p Documents/b/c/d");
    expect(drive.idOf("Documents/b/c/d")).toBeDefined();
    expect(await run(session, "rmdir Documents/b")).toBe("rmdir: Documents/b: Directory not empty");
    await run(session, "rmdir Documents/a");
    expect(drive.idOf("Documents/a")).toBeUndefined();
    expect(drive.ops.at(-1)).toBe("trash");
  });

  it("says the home folder holds no files of its own, and / is not the person's", async () => {
    const session = await newSession();
    expect(await run(session, "mkdir here")).toBe(
      "mkdir: here: the home folder holds only the drive's six folders; use one of them",
    );
    expect(await run(session, "touch /here")).toBe("touch: /here: Read-only file system");
    expect(await run(session, "rm -rf ~")).toBe("rm: /Users/shackett: Operation not permitted");
    expect(await run(session, "rm -rf /")).toBe("rm: /: Read-only file system");
  });

  it("makes an empty file with touch, and gives one that is there a new time and the same bytes", async () => {
    const id = drive.addFile("documents", "kept.txt", "K");
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "touch new.txt kept.txt")).toBe("");
    expect(drive.textOf("Documents/new.txt")).toBe("");
    expect(drive.textOf("Documents/kept.txt")).toBe("K");
    expect(drive.entries.get(id)?.modified_ms).toBeGreaterThan(2);
    expect(drive.idOf("Documents/kept.txt")).toBe(id);
    await run(session, "touch -c other.txt");
    expect(drive.idOf("Documents/other.txt")).toBeUndefined();
    const entry = drive.entries.get(id);
    if (entry) entry.modified_ms = 2;
    await run(session, "touch -c kept.txt");
    expect(drive.entries.get(id)?.modified_ms).toBeGreaterThan(2);
  });

  it("erases with rm for real, not into the Trash, and refuses a folder without -r", async () => {
    const session = await newSession();
    const id = drive.addFile("documents", "gone.txt", "x");
    drive.addFile("documents", "kept.txt", "y");
    drive.addFolder("documents", "tree");
    expect(await run(session, "rm Documents/tree")).toBe("rm: Documents/tree: is a directory");
    await run(session, "rm Documents/gone.txt");
    expect(drive.entries.has(id)).toBe(false);
    expect(drive.ops).toEqual(["delete"]);
    expect(drive.textOf("Documents/kept.txt")).toBe("y");
    expect(await run(session, "rm Documents/none.txt")).toBe(
      "rm: Documents/none.txt: No such file or directory",
    );
    expect(await run(session, "rm -f Documents/none.txt")).toBe("");
    expect(await run(session, "rm Documents/.")).toBe('rm: "." and ".." may not be removed');
    await run(session, "rm -r Documents/tree");
    expect(drive.idOf("Documents/tree")).toBeUndefined();
  });

  it("asks with -i, reading the answer: only yes goes on", async () => {
    drive.addFile("documents", "kept.txt", "y");
    drive.addFile("documents", "other.txt", "o");
    const session = await newSession();
    const answering = async (line: string, answer: string) => {
      session.input(`${line}\r`);
      await waitFor(() => expect(session.editor.reading).toBe(false));
      session.input(`${answer}\r`);
      await settled(session);
    };
    await answering("rm -i Documents/kept.txt", "n");
    expect(drive.textOf("Documents/kept.txt")).toBe("y");
    expect(session.emulator.allText()).toContain("remove Documents/kept.txt? n");

    await answering("cp -i Documents/kept.txt Documents/other.txt", "no");
    expect(drive.textOf("Documents/other.txt")).toBe("o");
    expect(session.emulator.allText()).toContain("not overwritten");
    await answering("mv -i Documents/kept.txt Documents/other.txt", "y");
    expect(drive.textOf("Documents/other.txt")).toBe("y");
    expect(drive.idOf("Documents/kept.txt")).toBeUndefined();

    await answering("rm -i Documents/other.txt", "yes");
    expect(drive.idOf("Documents/other.txt")).toBeUndefined();
  });

  it("lets the last of -f and -i decide, so -f after -i does not ask", async () => {
    drive.addFile("documents", "kept.txt", "y");
    const session = await newSession();
    await run(session, "rm -if Documents/kept.txt");
    expect(drive.idOf("Documents/kept.txt")).toBeUndefined();
  });

  it("cuts by bytes with -c, and writes where -o and a second operand say", async () => {
    drive.addFile("documents", "bytes.txt", "abcdef\n");
    drive.addFile("documents", "lines.txt", "b\na\na\n");
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "head -c 2 bytes.txt; echo")).toBe("ab");
    expect(await run(session, "tail -c 3 bytes.txt")).toBe("ef");
    expect(await run(session, "tail -c +5 bytes.txt")).toBe("ef");
    await run(session, "sort -o sorted.txt lines.txt");
    expect(drive.textOf("Documents/sorted.txt")).toBe("a\na\nb\n");
    await run(session, "uniq sorted.txt once.txt");
    expect(drive.textOf("Documents/once.txt")).toBe("a\nb\n");
  });

  it("numbers and squeezes with cat's options", async () => {
    drive.addFile("documents", "gaps.txt", "a\n\n\nb\n");
    const session = await newSession();
    await run(session, "cd Documents");
    expect(await run(session, "cat -n gaps.txt")).toBe("     1  a\n     2\n     3\n     4  b");
    expect(await run(session, "cat -b gaps.txt")).toBe("     1  a\n\n\n     2  b");
    expect(await run(session, "cat -s gaps.txt")).toBe("a\n\nb");
  });

  it("follows a file with tail -f until Control-C", async () => {
    drive.addFile("documents", "log.txt", "first\n");
    const session = await newSession();
    const other = await newSession();
    await run(session, "cd Documents");
    session.input("tail -f log.txt\r");
    await waitFor(() => expect(session.emulator.allText()).toContain("first"));
    expect(session.editor.reading).toBe(false);
    await run(other, "echo second >> Documents/log.txt");
    await waitFor(() => expect(session.emulator.allText()).toContain("second"));
    session.input("\x03");
    await settled(session);
    expect(session.scope.status).toBe(130);
  });

  it("lists the hidden with -A, without . and ..; marks folders with -p", async () => {
    drive.addFile("documents", ".hidden", "");
    const session = await newSession();
    const listed = await run(session, "ls -1A Documents");
    expect(listed).toContain(".hidden");
    expect(listed).not.toMatch(/^\.\.?$/m);
    expect(await run(session, "ls -dp Documents")).toBe("Documents/");
  });

  it("searches the manual with man -k and apropos", async () => {
    const session = await newSession();
    expect(await run(session, "man -k uniq")).toContain("uniq(1)");
    expect(await run(session, "apropos uniq")).toContain("uniq(1)");
    expect(await run(session, "man -k nosuchword")).toBe("nosuchword: nothing appropriate");
  });

  it("moves and renames with mv, over a file that exists", async () => {
    const session = await newSession();
    drive.addFile("documents", "a.txt", "A");
    drive.addFile("documents", "b.txt", "B");
    await run(session, "mv Documents/a.txt Documents/c.txt");
    expect(drive.textOf("Documents/c.txt")).toBe("A");
    await run(session, "mv Documents/c.txt Desktop");
    expect(drive.textOf("Desktop/c.txt")).toBe("A");
    await run(session, "mv -n Desktop/c.txt Documents/b.txt");
    expect(drive.textOf("Documents/b.txt")).toBe("B");
    await run(session, "mv Desktop/c.txt Documents/b.txt");
    expect(drive.textOf("Documents/b.txt")).toBe("A");
    expect(await run(session, "mv Documents Desktop")).toBe(
      "mv: Documents: “Documents” cannot be moved",
    );
  });

  it("refuses to move a folder into itself or over a file", async () => {
    const session = await newSession();
    drive.addFolder("documents", "tree");
    drive.addFile("desktop", "tree", "file");
    expect(await run(session, "mv Documents/tree Documents/tree/deep")).toBe(
      "mv: Documents/tree: cannot move a directory into itself",
    );
    expect(await run(session, "mv Documents/tree Desktop")).toBe(
      "mv: Documents/tree: cannot overwrite non-directory /Users/shackett/Desktop/tree with directory",
    );
    expect(drive.textOf("Desktop/tree")).toBe("file");
  });

  it("refuses an empty name, which is never the folder it is in", async () => {
    const session = await newSession();
    drive.addFile("documents", "kept.txt", "K");
    await run(session, "cd Documents");
    for (const line of [
      'rm -rf ""',
      'rmdir ""',
      'mkdir -p ""',
      'touch ""',
      'mv "" /Users/shackett/Desktop',
      'mv kept.txt ""',
      'cp -R "" /Users/shackett/Desktop',
      'cp kept.txt ""',
    ]) {
      expect(await run(session, line)).toContain(": : No such file or directory");
      expect(session.scope.status).toBe(1);
    }
    expect(drive.textOf("Documents/kept.txt")).toBe("K");
    expect(await run(session, "pwd")).toBe("/Users/shackett/Documents");
    expect(await run(session, "ls")).toBe("kept.txt");
  });

  it("takes a name ending in / as a folder, and changes nothing when it is not one", async () => {
    const session = await newSession();
    drive.addFile("documents", "a.txt", "A");
    expect(await run(session, "rm Documents/a.txt/")).toBe("rm: Documents/a.txt/: Not a directory");
    expect(await run(session, "mv Documents/a.txt/ Documents/b.txt")).toBe(
      "mv: Documents/a.txt/: Not a directory",
    );
    expect(await run(session, "cp Documents/a.txt/ Documents/b.txt")).toBe(
      "cp: Documents/a.txt/: Not a directory",
    );
    expect(await run(session, "mv Documents/a.txt Documents/none/")).toBe(
      "mv: Documents/none/: Not a directory",
    );
    expect(await run(session, "cp Documents/a.txt Documents/none/")).toBe(
      "cp: Documents/none/: Not a directory",
    );
    expect(drive.textOf("Documents/a.txt")).toBe("A");
    expect(drive.idOf("Documents/none")).toBeUndefined();
    expect(drive.idOf("Documents/b.txt")).toBeUndefined();
  });

  it("lets the last of -f and -n decide, for mv and cp", async () => {
    const session = await newSession();
    drive.addFile("documents", "from.txt", "new");
    drive.addFile("documents", "to.txt", "old");
    await run(session, "cd Documents");
    await run(session, "cp -f -n from.txt to.txt");
    expect(drive.textOf("Documents/to.txt")).toBe("old");
    await run(session, "mv -fn from.txt to.txt");
    expect(drive.textOf("Documents/to.txt")).toBe("old");
    expect(drive.textOf("Documents/from.txt")).toBe("new");
    await run(session, "cp -n -f from.txt to.txt");
    expect(drive.textOf("Documents/to.txt")).toBe("new");
    drive.addFile("documents", "other.txt", "other");
    await run(session, "mv -nf other.txt to.txt");
    expect(drive.textOf("Documents/to.txt")).toBe("other");
    expect(drive.idOf("Documents/other.txt")).toBeUndefined();
  });

  it("sends a file to the Trash when it is moved there", async () => {
    const session = await newSession();
    const id = drive.addFile("documents", "a.txt", "A");
    expect(await run(session, "mv -v Documents/a.txt ~/.Trash")).toBe(
      "Documents/a.txt -> /Users/shackett/.Trash",
    );
    expect(drive.entries.get(id)?.trashed_ms).toBeTypeOf("number");
    expect(await run(session, "ls ~/.Trash")).toBe("a.txt");
  });

  it("copies with cp, folders only with -r, and refuses a folder into itself", async () => {
    const session = await newSession();
    drive.addFile("documents", "a.txt", "A");
    const folder = drive.addFolder("documents", "tree");
    drive.addFile(folder, "inner.txt", "I");
    await run(session, "cp Documents/a.txt Desktop");
    expect(drive.textOf("Desktop/a.txt")).toBe("A");
    expect(drive.textOf("Documents/a.txt")).toBe("A");
    expect(await run(session, "cp Documents/tree Desktop")).toBe(
      "cp: Documents/tree is a directory (not copied).",
    );
    await run(session, "cp -r Documents/tree Desktop");
    expect(drive.textOf("Desktop/tree/inner.txt")).toBe("I");
    expect(await run(session, "cp -r Documents/tree Documents/tree/deep")).toBe(
      "cp: Documents/tree: cannot copy a directory into itself",
    );
  });

  it("merges a folder into one of its name, and refuses a file over a folder", async () => {
    const session = await newSession();
    const from = drive.addFolder("documents", "tree");
    drive.addFile(from, "both.txt", "new");
    const to = drive.addFolder("desktop", "tree");
    drive.addFile(to, "both.txt", "old");
    drive.addFile(to, "mine.txt", "M");
    expect(await run(session, "cp -r Documents/tree Desktop")).toBe("");
    expect(drive.textOf("Desktop/tree/both.txt")).toBe("new");
    expect(drive.textOf("Desktop/tree/mine.txt")).toBe("M");
    drive.addFile("documents", "a", "A");
    drive.addFolder("desktop", "a");
    expect(await run(session, "cp Documents/a Desktop")).toBe(
      "cp: Documents/a: cannot overwrite directory /Users/shackett/Desktop/a with non-directory",
    );
  });

  it.each(["pwd; his", "pwd;his", "pwd&&his", "pwd||his"])(
    "completes a command in %s",
    async (line) => {
      const session = await newSession();
      session.input(`${line}\t`);
      await waitFor(() => expect(session.editor.line).toBe(`${line.slice(0, -3)}history `));
    },
  );

  it("completes a command after a pipe", async () => {
    const session = await newSession();
    session.input("pwd | his\t");
    await waitFor(() => expect(session.editor.line).toBe("pwd | history "));
  });

  it("completes a file, not a command, after an escaped connector", async () => {
    drive.addFile("documents", "history.txt", "x");
    const session = await newSession();
    await run(session, "cd Documents");
    session.input("cat foo\\; his\t");
    await waitFor(() => expect(session.editor.line).toBe("cat foo\\; history.txt "));
  });

  it("completes a command and a file with Tab", async () => {
    drive.addFile("documents", "a file.txt", "x");
    const session = await newSession();
    session.input("his\t");
    await waitFor(() => expect(session.editor.line).toBe("history "));
    session.input("\x15cat Documents/a\t");
    await waitFor(() => expect(session.editor.line).toBe("cat Documents/a\\ file.txt "));
    session.input("\r");
    await settled(session);
    expect(session.scope.status).toBe(0);
  });
});
