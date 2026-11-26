import type { PropsDoc } from "../plugins.ts";

/**
 * The props documentation a page means by `name`. The tables are keyed by component folder
 * and interface name (`push-button/PushButtonProps`), because two components may export the
 * same interface name. A component page gets its own; any other page (a guide) may name
 * `<component>/<Name>` outright, or a bare name as long as only one component has it.
 */
export function findProps(
  all: Record<string, PropsDoc>,
  pageDir: string | undefined,
  name: string,
): { doc?: PropsDoc; ambiguous?: string[] } {
  if (name.includes("/")) return { doc: all[name] };
  const folder = /(?:^|\/)src\/components\/([^/]+)\/?$/.exec(pageDir ?? "")?.[1];
  const own = folder ? all[`${folder}/${name}`] : undefined;
  if (own) return { doc: own };
  const matches = Object.keys(all).filter((key) => key.endsWith(`/${name}`));
  if (matches.length === 1) return { doc: all[matches[0] as string] };
  return matches.length > 1 ? { ambiguous: matches } : {};
}

/** A piece of a description: plain text, or the content of a code span. */
export interface DescriptionSpan {
  text: string;
  code: boolean;
}

/**
 * Splits a JSDoc description at its Markdown code spans, so the site can draw them as inline
 * code as the Markdown export does. A span is opened by a run of backticks and closed by the
 * next run of the same length; one space of padding on both sides is dropped, which is how a
 * span holds a backtick of its own. A run that is never closed stays literal text.
 *
 * Outside a span a backslash escapes a backtick or another backslash: the escaped character is
 * text and the backslash is not shown. Inside a span a backslash is an ordinary character.
 * No other Markdown is read: emphasis, links and other escapes stay as they are written.
 */
export function codeSpans(description: string): DescriptionSpan[] {
  const spans: DescriptionSpan[] = [];
  const add = (text: string, code: boolean) => {
    if (text !== "") spans.push({ text, code });
  };
  /** Where the run of exactly `length` backticks that closes a span starts, or -1. */
  const closing = (from: number, length: number) => {
    const runs = /`+/g;
    runs.lastIndex = from;
    for (let run = runs.exec(description); run; run = runs.exec(description)) {
      if (run[0].length === length) return run.index;
    }
    return -1;
  };

  let plain = "";
  let at = 0;
  while (at < description.length) {
    const char = description[at] as string;
    const next = description[at + 1];
    if (char === "\\" && (next === "`" || next === "\\")) {
      plain += next;
      at += 2;
      continue;
    }
    if (char !== "`") {
      plain += char;
      at += 1;
      continue;
    }

    let end = at;
    while (description[end] === "`") end += 1;
    const close = closing(end, end - at);
    if (close < 0) {
      plain += description.slice(at, end);
      at = end;
      continue;
    }
    add(plain, false);
    plain = "";
    const code = description.slice(end, close);
    const padded = code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "";
    add(padded ? code.slice(1, -1) : code, true);
    at = close + (end - at);
  }
  add(plain, false);
  return spans;
}
