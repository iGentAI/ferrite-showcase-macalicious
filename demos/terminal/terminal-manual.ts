/**
 * The built-in manual: `man` shows these pages, which say what each command does in this simulated
 * shell, not what it does on a Mac.
 */

const PAGES: Readonly<Record<string, readonly [synopsis: string, description: string]>> = {
  ".": [". file [argument ...]", "As source."],
  ":": [":", "Does nothing, with a status of 0."],
  "[": ["[ expression ]", "As test."],
  "[[": ["[[ expression ]]", "As test, without zsh's patterns."],
  alias: [
    "alias [name[=value] ...]",
    "Gives a command a short name, or writes what the names stand for.",
  ],
  basename: ["basename string [suffix]", "Writes the last part of a path."],
  bash: ["bash [-c text | file] [argument ...]", "As sh: runs a script in this simulated shell."],
  bg: ["bg [%job]", "Says a job already runs behind the prompt: nothing here can be suspended."],
  cat: [
    "cat [-bnsu] [file ...]",
    "Writes files, what a pipe gives or what is typed, to standard output. -n numbers lines, -b those not blank, -s leaves one blank line of several.",
  ],
  chmod: [
    "chmod [-Rfv] mode file ...",
    "Keeps a file's mode with your desktop settings, as a number or as u+x. The execute bit lets ./file run, the write bit lets > write; the rest is shown by ls -l.",
  ],
  cd: [
    "cd [folder | -]",
    "Changes the working folder. With no folder, the home folder; - is the last one.",
  ],
  clear: ["clear", "Clears the window."],
  cp: [
    "cp [-Rafinprv] source ... target",
    "Copies on the drive, and merges into a folder of the same name. -p and -a keep the mode and the date.",
  ],
  cut: [
    "cut -f list [-d delim] | -c list [file ...]",
    "Writes the chosen fields or characters of each line.",
  ],
  date: ["date [+format]", "Writes the date and time, in this browser's time zone."],
  dirname: ["dirname path", "Writes a path without its last part."],
  defaults: [
    "defaults read | write | delete | domains [domain [key [value]]]",
    "Keeps values with your desktop settings, by domain and key. Other applications do not read them.",
  ],
  echo: ["echo [-n] [text ...]", "Writes its words. -n leaves out the line ending."],
  env: [
    "env [name=value ...] [command [argument ...]]",
    "Writes the exported variables, or runs a command with those added.",
  ],
  exit: ["exit [status]", "Ends this shell."],
  export: ["export [name[=value] ...]", "Marks variables to be listed by env."],
  false: ["false", "Ends with a status of 1."],
  fg: ["fg [%job]", "Waits for a job behind the prompt; Control-C stops it."],
  grep: [
    "grep [-EFHRchilnoqrvwx] [-e pattern] ... [pattern] [file ...]",
    "Writes the lines that match a regular expression, or any of several given with -e. -r also searches the files under a folder.",
  ],
  head: ["head [-c bytes | -n count] [file ...]", "Writes the first lines of each file."],
  help: ["help", "Lists what this version of the shell has."],
  history: ["history", "Writes the lines typed in this session."],
  hostname: ["hostname", "Writes this desktop's computer name."],
  id: ["id", "Writes the person's name and number. Every file belongs to you here."],
  jobs: ["jobs", "Lists what was started with &."],
  kill: [
    "kill [-signal] pid ...",
    "Quits the application whose window has that number in ps, as Force Quit does. -0 only checks for it, and -l lists the signals.",
  ],
  less: [
    "less [file ...]",
    "Shows text a page at a time. Space and b page, j and k move a line, g and G go to the ends, / searches, n and N search again, q quits.",
  ],
  ls: [
    "ls [-1ABCFGHLOPRSTWabdefghklmnopqrstvwx] [file ...]",
    "Lists a folder. -t by time, -S by size, -r the other way round, -f as the drive lists them, -R into folders, -d the folder itself, -F marks what each is, -h sizes for reading, -s blocks, -T the whole date, -n numbers for who, -O flags, -C and -x columns, -b and -q what cannot be printed. The drive keeps no inode, access, status or creation time, so -i -u -c -U are refused, and no extended attributes, so -@ is.",
  ],
  man: [
    "man name, man -k word",
    "Shows the page of a command, as less does, or lists the pages about a word.",
  ],
  apropos: ["apropos word ...", "Lists the manual pages about a word, as man -k does."],
  mdfind: ["mdfind query", "Searches your data through Spotlight's server route."],
  mkdir: ["mkdir [-p] folder ...", "Makes folders on the drive."],
  more: ["more [file ...]", "As less, and it returns at once when the text fits on the screen."],
  mv: [
    "mv [-finv] source ... target",
    "Moves or renames on the drive; to ~/.Trash puts it there. -i asks before replacing.",
  ],
  node: [
    "node [-e script | -p expression | file]",
    "Runs JavaScript on the Script Editor module's interpreter on the server. No process starts.",
  ],
  open: [
    "open [-a application] file ... | url",
    "Opens files in their applications, addresses in Safari, and an application by name.",
  ],
  osascript: [
    "osascript -l JavaScript [-e script | file]",
    "Runs JavaScript as node does and writes its result. AppleScript does not run here.",
  ],
  pbcopy: ["pbcopy", "Puts what a pipe gives on the clipboard."],
  pbpaste: ["pbpaste", "Writes the clipboard, when the browser lets the page read it."],
  printf: [
    "printf format [argument ...]",
    "Writes the format with %s, %d and %%, and \\n and \\t read.",
  ],
  ps: ["ps", "Lists the desktop's windows, which are all the processes there are."],
  pwd: ["pwd", "Writes the working folder."],
  read: [
    "read [-r] [name ...]",
    "Takes a line from a file, a pipe or the keyboard into variables.",
  ],
  reset: ["reset", "Puts the terminal back as it started."],
  rm: [
    "rm [-Rfrv] file ...",
    "Erases from the drive for real: nothing goes to the Trash. -R goes into folders, -f says nothing of what is not there.",
  ],
  rmdir: ["rmdir folder ...", "Puts folders that are empty in the Trash."],
  say: ["say [-v voice] [-r rate] [text ...]", "Speaks through the browser's speech."],
  sed: [
    "sed [-En] [-e script] script [file ...]",
    "Edits lines: s, y, d, p, q and =, with line and pattern addresses.",
  ],
  seq: ["seq [first [incr]] last", "Writes numbers, one to a line."],
  sh: [
    "sh [-c text | file] [argument ...]",
    "Runs a script in this simulated shell, in a shell of its own: what it sets ends with it. No process starts.",
  ],
  shift: ["shift [count]", "Moves a script's arguments along."],
  sleep: ["sleep seconds", "Waits."],
  source: ["source file [argument ...]", "Runs a script in this shell, so what it sets stays."],
  sort: ["sort [-fnru] [-k field] [-o file] [-t separator] [file ...]", "Sorts lines."],
  tail: [
    "tail [-f] [-c bytes | -n count] [file ...]",
    "Writes the last lines of each file; -f goes on with what is added, until Control-C.",
  ],
  test: [
    "test expression",
    "Ends with 0 when it holds: -d -e -f -r -s -w -x -n -z, = != and -eq -ne -lt -le -gt -ge, with ! -a -o. Also written [ expression ].",
  ],
  top: [
    "top",
    "Activity Monitor's figures for the desktop's modules, read again every 5 seconds. q quits.",
  ],
  touch: ["touch [-c] file ...", "Makes an empty file, or gives a file that is there a new time."],
  tr: ["tr [-Ccds] set1 [set2]", "Replaces or deletes characters of what a pipe gives."],
  true: ["true", "Ends with a status of 0."],
  type: ["type name ...", "Writes what a name stands for: an alias or a command."],
  unalias: ["unalias [-a] name ...", "Forgets aliases."],
  uname: ["uname [-amnrs]", "Writes what this system is called."],
  uniq: ["uniq [-cdiu] [input [output]]", "Leaves out lines that repeat the line before."],
  unset: ["unset name ...", "Forgets variables."],
  wait: ["wait [%job ...]", "Waits for jobs behind the prompt to end."],
  wc: ["wc [-clmw] [file ...]", "Counts lines, words and bytes."],
  which: [
    "which [-as] name ...",
    "Writes what a name runs: an alias, zsh's own command, or the program under /bin, which that path runs too. -a writes all of them.",
  ],
  whoami: ["whoami", "Writes the person's name."],
  zsh: ["zsh [-c text | file] [argument ...]", "As sh: runs a script in this simulated shell."],
};

const INTRO = `INTRO(1)                     Simulated Shell                     INTRO(1)

NAME
     intro -- what this shell is

DESCRIPTION
     This is a simulated shell that runs in the page. No process starts and
     there is no computer underneath it. Its commands act on the files of
     your desktop, the ones Finder shows.

     rm erases for real. There is no undo.

     Commands that need a real computer, such as ssh, git, sudo and brew,
     say so. node and osascript -l JavaScript run on the desktop's server.
`;

function wrapped(text: string): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line.length + word.length + 1 > 67) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  lines.push(line);
  return lines.join("\n     ");
}

/** The page of `name`, or undefined. */
export function manualPage(name: string): string | undefined {
  if (name === "intro") return INTRO;
  const page = Object.hasOwn(PAGES, name) ? PAGES[name] : undefined;
  if (!page) return undefined;
  const head = `${name.toUpperCase()}(1)`;
  const gap = Math.max(2, 72 - head.length * 2 - "Simulated Shell".length);
  const left = " ".repeat(Math.floor(gap / 2));
  const right = " ".repeat(Math.ceil(gap / 2));
  return `${head}${left}Simulated Shell${right}${head}\n\nNAME\n     ${name}\n\nSYNOPSIS\n     ${page[0]}\n\nDESCRIPTION\n     ${wrapped(page[1])}\n`;
}

/** The commands with a page. */
export const manualNames = (): string[] => ["intro", ...Object.keys(PAGES)];

/** The lines of `man -k` for a word: each page whose name or description holds it, as `apropos` lists them. */
export function manualSearch(word: string): string[] {
  const wanted = word.toLowerCase();
  return Object.entries(PAGES)
    .filter(
      ([name, [, description]]) =>
        name.toLowerCase().includes(wanted) || description.toLowerCase().includes(wanted),
    )
    .map(([name, [, description]]) => `${`${name}(1)`.padEnd(16)}- ${description}`);
}
