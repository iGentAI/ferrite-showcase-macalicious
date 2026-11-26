/** A signature of Preferences > Signatures: plain text, set in the message's own font. */
export interface MailSignature {
  id: string;
  name: string;
  text: string;
}

/** What is kept of the signatures: `chosen` is a signature's id, or one of the words below. */
export interface MailSignatures {
  list: readonly MailSignature[];
  chosen: string;
  /** How many messages have taken a signature, for In Sequential Order. */
  turn: number;
}

export const NO_SIGNATURE = "none";
export const RANDOM_SIGNATURE = "random";
export const SEQUENTIAL_SIGNATURE = "sequential";
/** The id of what a draft's marked lines hold when no signature in Preferences has those words. */
export const KEPT_SIGNATURE = "kept";

export const NO_SIGNATURES: MailSignatures = { list: [], chosen: NO_SIGNATURE, turn: 0 };

/** What is kept, leaving out whatever Mail did not write. */
export function readMailSignatures(stored: unknown): MailSignatures | undefined {
  const { list, chosen, turn } = (stored ?? {}) as Partial<Record<keyof MailSignatures, unknown>>;
  if (!Array.isArray(list)) return undefined;
  const signatures = list.filter(
    (each): each is MailSignature =>
      typeof each?.id === "string" &&
      typeof each.name === "string" &&
      typeof each.text === "string",
  );
  return {
    list: signatures,
    chosen: typeof chosen === "string" ? chosen : NO_SIGNATURE,
    turn: typeof turn === "number" && Number.isFinite(turn) ? turn : 0,
  };
}

/** The signature a new message starts with. `random` is a number from 0 up to 1. */
export function signatureFor(kept: MailSignatures, random: number): MailSignature | null {
  const { list, chosen, turn } = kept;
  if (list.length === 0) return null;
  if (chosen === RANDOM_SIGNATURE) return list[Math.floor(random * list.length)] ?? null;
  if (chosen === SEQUENTIAL_SIGNATURE) return list[turn % list.length] ?? null;
  return list.find((signature) => signature.id === chosen) ?? null;
}

/** The line a reply or a forward quotes the original under. */
const QUOTE_START = /^On .* wrote:$/;

/** A new message's text with `signature`: under the text, or above the quote when `above` asks. */
export function withSignature(body: string, signature: MailSignature | null, above: boolean) {
  if (!signature || signature.text.trim() === "") return body;
  const lines = body.split("\n");
  const quote = lines.findIndex((line) => QUOTE_START.test(line));
  if (above && quote >= 0) {
    const before = lines
      .slice(0, quote)
      .map((line) => `${line}\n`)
      .join("");
    const after = lines.slice(quote).join("\n");
    return `${before}${signature.text}\n\n${after}`;
  }
  return body === "" ? `\n\n${signature.text}` : `${body}\n\n${signature.text}`;
}

/** One line of an editor's text and the nodes that make it. */
interface EditorLine {
  text: string;
  nodes: Node[];
}

const BLOCK = "div,p,blockquote,pre,h1,h2,h3,h4,h5,h6";

/** Whether an element is one line: no block in it, and no line break but a last one. */
const isOneLine = (element: Element) => {
  const breaks = element.querySelectorAll("br");
  return (
    element.querySelector(BLOCK) === null &&
    (breaks.length === 0 || (breaks.length === 1 && element.lastChild === breaks[0]))
  );
};

/** The lines of a rich text view, however deep: each block, and the runs between line breaks. */
function editorLines(root: Element): EditorLine[] {
  const lines: EditorLine[] = [];
  let open: EditorLine | null = null;
  const read = (parent: Element) => {
    for (const child of parent.childNodes) {
      const element = child.nodeType === 1 ? (child as Element) : null;
      const block = element?.matches(BLOCK) === true;
      if (element && !isOneLine(element)) {
        if (block) open = null;
        read(element);
        if (block) open = null;
        continue;
      }
      if (block) {
        open = null;
        lines.push({ text: child.textContent ?? "", nodes: [child] });
        continue;
      }
      if (!open) {
        open = { text: "", nodes: [] };
        lines.push(open);
      }
      open.nodes.push(child);
      if (child.nodeName.toUpperCase() === "BR") open = null;
      else open.text += child.textContent ?? "";
    }
  };
  read(root);
  return lines;
}

const plainLine = (text: string) => text.replace(/\u00A0/g, " ").trimEnd();
const isBlank = (line: EditorLine | undefined) => plainLine(line?.text ?? "") === "";

/** Whether the lines `wanted` stand together at `at`. */
const standsAt = (lines: readonly EditorLine[], wanted: readonly string[], at: number) =>
  at >= 0 && wanted.every((line, index) => plainLine(lines[at + index]?.text ?? "\u0000") === line);

/** Where `wanted`, nearest the end, stands among `lines` with every line passing `accepts`. */
function lastRun(
  lines: readonly EditorLine[],
  wanted: readonly string[],
  accepts: (line: EditorLine) => boolean = () => true,
): number {
  for (let at = lines.length - wanted.length; at >= 0; at -= 1) {
    if (standsAt(lines, wanted, at) && lines.slice(at, at + wanted.length).every(accepts)) {
      return at;
    }
  }
  return -1;
}

/** Whether the lines of `text` stand together in a rich text view. */
export const holdsLines = (root: Element, text: string) =>
  text.trim() !== "" && lastRun(editorLines(root), text.split("\n").map(plainLine)) >= 0;

/** The attribute on the lines of the signature a compose window has placed. */
const SIGNATURE_MARK = "data-mail-signature";

/**
 * For reading a draft's saved HTML back with the mark. What was sent carries the attribute too, and it
 * means nothing there: the viewer rebuilds HTML without this option, so the attribute is dropped.
 */
export const SIGNATURE_HTML = { attributes: { [SIGNATURE_MARK]: /^$/ } };

const signatureWords = (text: string) =>
  text
    .replace(/^\n+|\n+$/g, "")
    .split("\n")
    .map(plainLine);

const isMarked = ({ nodes: [node, more] }: EditorLine) =>
  node?.nodeType === 1 && !more && (node as Element).hasAttribute(SIGNATURE_MARK);

/** The words of the last unbroken run of marked lines, or `null` when none holds any. */
function markedWords(lines: readonly EditorLine[]): string | null {
  const flags = lines.map(isMarked);
  const end = flags.lastIndexOf(true);
  if (end < 0) return null;
  const start = flags.lastIndexOf(false, end) + 1;
  const text = lines
    .slice(start, end + 1)
    .map((line) => plainLine(line.text))
    .join("\n");
  return text.trim() === "" ? null : signatureWords(text).join("\n");
}

/**
 * Where a signature with no mark stands: directly before the quote, or else last in the text. A
 * quote's end is known only from `original`, so below a quote of unknown end nothing is accepted,
 * since the last lines may be the quote's own.
 */
function placedRun(
  lines: readonly EditorLine[],
  wanted: readonly string[],
  above: boolean,
  original: string | null | undefined,
): number {
  const quote = lines.findIndex((line) => QUOTE_START.test(plainLine(line.text)));
  let end = above && quote >= 0 ? quote : lines.length;
  while (end > 0 && isBlank(lines[end - 1])) end -= 1;
  const at = end - wanted.length;
  if (!standsAt(lines, wanted, at)) return -1;
  if (above || quote < 0) return at;
  if (typeof original !== "string") return -1;
  const quoted = original.split("\n").map(plainLine);
  const held = lastRun(lines, quoted);
  return held >= 0 && at >= held + quoted.length ? at : -1;
}

/**
 * The signature a saved rich text view holds, by its marked lines and all their words: one of `list`
 * with just those, or else those words as they were written, since Preferences may have changed it.
 * Lines with no mark are the person's, whatever they say.
 */
export function signatureIn(root: Element, list: readonly MailSignature[]): MailSignature | null {
  const marked = markedWords(editorLines(root));
  if (marked === null) return null;
  return (
    list.find((signature) => signatureWords(signature.text).join("\n") === marked) ?? {
      id: KEPT_SIGNATURE,
      name: "",
      text: marked,
    }
  );
}

/** Marks the lines of the signature a message was just made with, where `withSignature` put it. */
export function markSignature(
  root: Element,
  signature: MailSignature,
  above: boolean,
  original?: string | null,
): void {
  const lines = editorLines(root);
  const wanted = signatureWords(signature.text);
  const at = placedRun(lines, wanted, above, original);
  if (at < 0) return;
  for (const { nodes } of lines.slice(at, at + wanted.length)) {
    const [node, more] = nodes;
    if (node?.nodeType === 1 && !more) (node as Element).setAttribute(SIGNATURE_MARK, "");
  }
}

/**
 * After the person has typed: only the lines of `signature` stay marked, so that a line a browser
 * made by copying a marked one is not taken for it. Says whether the signature still stands, word for
 * word. Once it does not it is the person's own text, and no mark is left on it.
 */
export function settleMarks(root: Element, signature: MailSignature | null): boolean {
  const lines = editorLines(root);
  const wanted = signature ? signatureWords(signature.text) : null;
  const at = wanted ? lastRun(lines, wanted, isMarked) : -1;
  const kept = new Set(
    at >= 0 && wanted ? lines.slice(at, at + wanted.length).flatMap((line) => line.nodes) : [],
  );
  for (const node of root.querySelectorAll(`[${SIGNATURE_MARK}]`)) {
    if (!kept.has(node)) node.removeAttribute(SIGNATURE_MARK);
  }
  return at >= 0;
}

function lineNodes(document: Document, text: string): HTMLDivElement[] {
  return text.split("\n").map((line) => {
    const node = document.createElement("div");
    if (line === "") node.append(document.createElement("br"));
    else node.textContent = line;
    return node;
  });
}

/** Takes `count` lines from `at` out of a rich text view, and says what followed them. */
function removeRun(root: Element, lines: readonly EditorLine[], at: number, count: number) {
  const next = lines[at + count]?.nodes[0] ?? null;
  for (const line of lines.slice(at, at + count)) {
    for (const node of line.nodes) {
      let parent = node.parentNode;
      parent?.removeChild(node);
      while (parent && parent !== root && parent.childNodes.length === 0) {
        const empty: ParentNode = parent;
        parent = empty.parentNode;
        parent?.removeChild(empty);
      }
    }
  }
  return next;
}

/** Puts `nodes` in front of `before`, in whichever block that stands; last in `root` without one. */
const insertAt = (root: Element, nodes: readonly Node[], before: Node | null) => {
  const parent = before?.parentNode ?? root;
  for (const node of nodes) parent.insertBefore(node, before);
};

/**
 * Puts `to` in a rich text view in the place of `from`: where it stood, or else under the text, or
 * above the quote when `above` asks. `from` is taken out only by its mark, so the same words typed
 * elsewhere or standing in a quote stay, and so does a signature the person has edited.
 */
export function swapSignature(
  root: Element,
  from: MailSignature | null,
  to: MailSignature | null,
  above: boolean,
): void {
  const document = root.ownerDocument;
  let stood: Node | null | undefined;
  if (from && from.text.trim() !== "") {
    const held = editorLines(root);
    const wanted = signatureWords(from.text);
    const at = lastRun(held, wanted, isMarked);
    if (at >= 0) stood = removeRun(root, held, at, wanted.length);
  }
  if (!to || to.text.trim() === "") return;
  const nodes = lineNodes(document, signatureWords(to.text).join("\n"));
  for (const node of nodes) node.setAttribute(SIGNATURE_MARK, "");
  if (stood !== undefined) {
    insertAt(root, nodes, stood);
    return;
  }
  const lines = editorLines(root);
  const quote = lines.find((line) => QUOTE_START.test(plainLine(line.text)));
  if (above && quote) {
    insertAt(root, [...nodes, ...lineNodes(document, "")], quote.nodes[0] as Node);
    return;
  }
  const blank = lines.length === 0 ? 2 : plainLine(lines.at(-1)?.text ?? "") === "" ? 0 : 1;
  for (let each = 0; each < blank; each += 1) root.append(...lineNodes(document, ""));
  root.append(...nodes);
}

/**
 * Takes a quoted original out of a rich text view, or puts it back: above a signature that goes
 * below the quote, and otherwise under the text.
 */
export function toggleOriginal(root: Element, original: string, above: boolean): void {
  const lines = editorLines(root);
  const wanted = original.split("\n").map(plainLine);
  const at = lastRun(lines, wanted);
  if (at >= 0) {
    removeRun(root, lines, at, wanted.length);
    return;
  }
  const document = root.ownerDocument;
  const signature = above ? null : root.querySelector(`[${SIGNATURE_MARK}]`);
  if (signature) {
    insertAt(root, [...lineNodes(document, original), ...lineNodes(document, "")], signature);
    return;
  }
  if (lines.length === 0) root.append(...lineNodes(document, ""));
  if (plainLine(lines.at(-1)?.text ?? "") !== "") root.append(...lineNodes(document, ""));
  root.append(...lineNodes(document, original));
}
