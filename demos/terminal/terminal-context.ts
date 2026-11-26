import type { TerminalEmulator } from "./terminal-emulator";
import type { TerminalFiles } from "./terminal-files";
import type { LineEditor } from "./terminal-line-editor";

/** A shell variable. Exported ones are what `env` lists. */
export interface ShellVariable {
  value: string;
  exported: boolean;
}

/** The folder a session is in, the status of its last command, and its variables. */
export interface ShellScope {
  cwd: string;
  oldCwd: string;
  status: number;
  variables: Map<string, ShellVariable>;
  aliases: Map<string, string>;
  /** `$1` and on: a script's arguments. */
  positional: string[];
  /** `$0`. */
  scriptName: string;
}

/** A scope a subshell or a command before a pipe can change without touching this one. */
export const copiedScope = (scope: ShellScope): ShellScope => ({
  ...scope,
  variables: new Map(scope.variables),
  aliases: new Map(scope.aliases),
  positional: [...scope.positional],
});

/** Sets a variable, which stays exported if it was. */
export function setVariable(scope: ShellScope, name: string, value: string): void {
  const exported = scope.variables.get(name)?.exported ?? false;
  scope.variables.set(name, { value, exported });
}

/** The session as a command sees it. */
export interface ShellSession {
  readonly emulator: TerminalEmulator;
  readonly editor: LineEditor;
  readonly files: TerminalFiles;
  readonly userName: string;
  readonly hostName: string;
  /** The full-screen program in front, if any. */
  rawReader: ((data: string) => void) | null;
  /** Gives a full-screen program the keyboard, one key at a time and what was typed ahead first. */
  takeKeyboard: (reader: ((key: string) => void) | null) => void;
  /** Heard when the terminal changes size, for a full-screen program. */
  onResize: (() => void) | null;
  /** Runs a script's text on behalf of `context`. A subshell's changes end with it. */
  runScript: (
    text: string,
    context: CommandContext,
    options: { name: string; args?: readonly string[]; subshell: boolean },
  ) => Promise<number>;
  /** What runs behind the prompt, the oldest first. */
  readonly jobs: ShellJob[];
}

/** A pipeline started with `&`. */
export interface ShellJob {
  number: number;
  pid: number;
  text: string;
  running: boolean;
  status: number;
  /** Stops it, as `kill %1` and Control-C under `fg` do. */
  stop: () => void;
  ended: Promise<void>;
}

/** What a command runs with. */
export interface CommandContext {
  name: string;
  args: readonly string[];
  session: ShellSession;
  scope: ShellScope;
  signal: AbortSignal;
  /** What the pipe gives this command, or `null` when it reads the keyboard. */
  stdin: string | null;
  /** Whether what it writes goes into a pipe rather than on the screen. */
  outIsPipe: boolean;
  out: (text: string) => void;
  err: (text: string) => void;
  /** The next line of what this command reads, from a file, a pipe or the keyboard; null at the end. */
  readLine: () => Promise<string | null>;
  /** Whether this runs behind the prompt, started with `&`. */
  background: boolean;
}

export type CommandRun = (context: CommandContext) => Promise<number>;
