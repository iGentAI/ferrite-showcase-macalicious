import type { CommandContext, CommandRun } from "./terminal-context";
import { Interrupted } from "./terminal-io";
import { manualPage, manualSearch } from "./terminal-manual";
import { refusedOption } from "./terminal-options";
import { inputs, writeInPieces } from "./terminal-text-commands";

/**
 * `less`, `more` and `man`: text a page at a time on the alternate screen, when what they write goes
 * to the screen. Into a pipe or a file they write it whole, as they do on a Mac.
 */

const TAB_WIDTH = 8;

/** A line as the screen shows it: tabs to their stops, nothing that would move the cursor. */
function shownLine(line: string): string {
  let out = "";
  for (const ch of line) {
    if (ch === "\t") out += " ".repeat(TAB_WIDTH - (out.length % TAB_WIDTH));
    else out += ch < " " || ch === "\x7f" ? "?" : ch;
  }
  return out;
}

/** The rows `text` takes on a screen `cols` wide, a long line over several. */
function displayRows(text: string, cols: number): string[] {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.flatMap((line) => {
    const shown = shownLine(line);
    if (shown.length <= cols) return [shown];
    const pieces: string[] = [];
    for (let at = 0; at < shown.length; at += cols) pieces.push(shown.slice(at, at + cols));
    return pieces;
  });
}

/** Shows `text` until the person quits or the command is stopped. */
async function page(context: CommandContext, text: string, title: string): Promise<void> {
  if (context.signal.aborted) throw new Interrupted();
  const { session } = context;
  const { emulator } = session;
  let rows = displayRows(text, emulator.cols);
  let top = 0;
  let typing: string | null = null;
  let query = "";
  /** The row of the last match, from which n and N go on: drawing can show it lower than the top. */
  let match: number | null = null;
  let note = "";
  const height = () => emulator.rows - 1;
  const draw = () => {
    top = Math.max(0, Math.min(top, rows.length - height()));
    let out = "\x1b[H\x1b[2J";
    for (let row = 0; row < height(); row += 1) out += `${rows[top + row] ?? "~"}\r\n`;
    const atEnd = top + height() >= rows.length;
    // One row less a column, so that the bottom row can never wrap and scroll the page away.
    const room = emulator.cols - 1;
    if (typing !== null) out += shownLine(`/${typing}`).slice(-room);
    else {
      const status = note || (atEnd ? "(END)" : top === 0 && title ? title : ":");
      out += `\x1b[7m${shownLine(status).slice(0, room)}\x1b[27m`;
    }
    emulator.write(out);
  };
  const find = (from: number, step: 1 | -1): boolean => {
    if (query === "") return false;
    for (let at = from; at >= 0 && at < rows.length; at += step) {
      if (rows[at]?.includes(query)) {
        top = at;
        match = at;
        return true;
      }
    }
    return false;
  };
  emulator.write("\x1b[?1049h");
  try {
    await new Promise<void>((resolve) => {
      const reader = (key: string) => {
        note = "";
        if (typing !== null) {
          if (key === "\r" || key === "\n") {
            query = typing;
            typing = null;
            if (!find(top, 1)) note = "Pattern not found";
          } else if (key === "\x7f" || key === "\b") typing = typing.slice(0, -1);
          else if (key === "\x1b" || key === "\x03") typing = null;
          else if (key >= " ") typing += key;
          draw();
          return;
        }
        switch (key) {
          case "q":
          case "Q":
          case "\x03":
            session.takeKeyboard(null);
            resolve();
            return;
          case " ":
          case "f":
          case "\x06":
          case "\x1b[6~":
            top += height();
            break;
          case "b":
          case "\x02":
          case "\x1b[5~":
            top -= height();
            break;
          case "j":
          case "\r":
          case "\n":
          case "\x1b[B":
          case "\x1bOB":
            top += 1;
            break;
          case "k":
          case "\x1b[A":
          case "\x1bOA":
            top -= 1;
            break;
          case "g":
          case "<":
            top = 0;
            break;
          case "G":
          case ">":
            top = rows.length;
            break;
          case "/":
            typing = "";
            break;
          case "n":
            if (!find((match ?? top) + 1, 1)) note = "Pattern not found";
            draw();
            return;
          case "N":
            if (!find((match ?? top) - 1, -1)) note = "Pattern not found";
            draw();
            return;
          default:
            return;
        }
        match = null;
        draw();
      };
      session.onResize = () => {
        rows = displayRows(text, emulator.cols);
        match = null;
        draw();
      };
      context.signal.addEventListener("abort", () => resolve(), { once: true });
      draw();
      session.takeKeyboard(reader);
    });
  } finally {
    session.takeKeyboard(null);
    session.onResize = null;
    emulator.write("\x1b[?1049l");
  }
}

const pager: CommandRun = async (context) => {
  if (refusedOption(context, "")) return 1;
  if (context.stdin === null && context.args.length === 0) {
    context.err(`${context.name}: Missing filename\n`);
    return 1;
  }
  const problems = { failed: false };
  const parts: string[] = [];
  for await (const file of inputs(context, context.args, problems)) parts.push(file.text);
  const text = parts.join("");
  const status = problems.failed ? 1 : 0;
  // Nothing read, nothing to page: what was said about it stays on the screen.
  if (problems.failed && text === "") return status;
  const { emulator } = context.session;
  const fits = displayRows(text, emulator.cols).length < emulator.rows;
  if (context.outIsPipe || (context.name === "more" && fits)) {
    await writeInPieces(context, text);
    return status;
  }
  await page(context, text, context.args[0] ?? "");
  return status;
};

const man: CommandRun = async (context) => {
  const searching = context.args[0] === "-k";
  if (searching || context.name === "apropos") {
    const words = searching ? context.args.slice(1) : context.args;
    if (words.length === 0) {
      context.err(`usage: ${context.name}${searching ? " -k" : ""} word ...\n`);
      return 1;
    }
    const found = [...new Set(words.flatMap(manualSearch))];
    if (found.length === 0) {
      context.err(`${words.join(" ")}: nothing appropriate\n`);
      return 1;
    }
    context.out(`${found.join("\n")}\n`);
    return 0;
  }
  const name = context.args.find((arg) => !arg.startsWith("-") && !/^\d$/.test(arg));
  if (!name) {
    context.err("What manual page do you want?\n");
    return 1;
  }
  const text = manualPage(name);
  if (!text) {
    context.err(`No manual entry for ${name}\n`);
    return 1;
  }
  if (context.outIsPipe) await writeInPieces(context, text);
  else await page(context, text, `Manual page ${name}(1)`);
  return 0;
};

export const PAGER_COMMANDS: Readonly<Record<string, CommandRun>> = {
  apropos: man,
  less: pager,
  man,
  more: pager,
};
