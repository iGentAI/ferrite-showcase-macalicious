/** One message of an mbox file, as File > Import Mailboxes hands it to the server. */
export interface ImportedMessage {
  /** The same for the same message of the same file, so an import done twice makes nothing twice. */
  key: string;
  from: string;
  to: readonly string[];
  cc: readonly string[];
  subject: string;
  time: number;
  text: string;
}

/** A file's name without its `.mbox`, or "Import" when nothing is left. */
export const importedBoxName = (file: string) => {
  const name = file.replace(/\.(mbox|mbx)$/i, "").trim();
  return /^(inbox|drafts|sent|junk|trash|archive)?$/i.test(name) ? `Import ${name}`.trim() : name;
};

/** FNV-1a, twice over from two starts: a key for what a page sends again, not a secret. */
function digest(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x811c9dc5);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

/** The addresses of a header line, split at the commas outside quotes and angle brackets. */
function addresses(line: string | undefined): string[] {
  if (!line) return [];
  const out: string[] = [];
  let now = "";
  let quoted = false;
  let angled = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    else if (character === "<") angled = true;
    else if (character === ">") angled = false;
    if (character === "," && !quoted && !angled) {
      out.push(now);
      now = "";
    } else {
      now += character;
    }
  }
  out.push(now);
  return out.map((each) => each.trim()).filter(Boolean);
}

/**
 * The messages of an mbox file, in order. A line of the text that was quoted as `>From ` loses one
 * `>` (the mboxrd form `mboxOf` writes), and a folded header line is joined. A date that cannot be
 * read counts as the file's own `From ` line's, else `fallbackTime`. Only plain text is read: a
 * multi-part message keeps its source as text, and no file comes out of it.
 */
export function parseMbox(file: string, fallbackTime: number): ImportedMessage[] {
  const lines = file.split(/\r?\n/);
  const starts = lines.flatMap((line, at) =>
    /^From \S+ .*\d{4}\s*$/.test(line) && (at === 0 || lines[at - 1] === "") ? [at] : [],
  );
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? lines.length;
    const separator = lines[start] ?? "";
    const headers = new Map<string, string>();
    let at = start + 1;
    let last = "";
    for (; at < end && lines[at] !== ""; at += 1) {
      const line = lines[at] ?? "";
      const named = /^([!-9;-~]+):\s*(.*)$/.exec(line);
      if (named?.[1]) {
        last = named[1].toLowerCase();
        if (!headers.has(last)) headers.set(last, named[2] ?? "");
      } else if (/^\s/.test(line) && last) {
        headers.set(last, `${headers.get(last) ?? ""} ${line.trim()}`);
      }
    }
    const text = lines
      .slice(at + 1, end)
      .map((line) => (/^>+From /.test(line) ? line.slice(1) : line))
      .join("\n")
      .replace(/\n+$/, "");
    const dated = Date.parse(headers.get("date") ?? "");
    const stamped = Date.parse(`${separator.split(/\s+/).slice(2).join(" ")} UTC`);
    const time = Number.isNaN(dated) ? (Number.isNaN(stamped) ? fallbackTime : stamped) : dated;
    const from = headers.get("from") ?? separator.split(/\s+/)[1] ?? "";
    const subject = headers.get("subject") ?? "";
    return {
      key: `${digest(lines.slice(start, end).join("\n"))}-${index}`,
      from,
      to: addresses(headers.get("to")),
      cc: addresses(headers.get("cc")),
      subject,
      time,
      text,
    };
  });
}
