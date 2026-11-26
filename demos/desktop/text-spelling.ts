/**
 * The editors' Edit > Spelling: a word list read when it is first needed, words a person taught it,
 * the next word it does not know from a place in a view's text, and what that word could be. The
 * browser's own checker underlines as a person types (Check Spelling While Typing) and tells a page
 * nothing, so these commands have their own list.
 */

const CHECKED_WORD = /[\p{L}][\p{L}\p{M}’']*/gu;

let words: Promise<ReadonlySet<string>> | undefined;

/** The word list, front-coded in its module: each entry says how much of the one before it stays. */
export function loadWords(): Promise<ReadonlySet<string>> {
  words ??= import("./text-spelling-words").then(({ WORD_LIST }) => decodeWords(WORD_LIST));
  return words;
}

/** The set a front-coded list holds: `3ple` after `apple` is `app` + `le`. */
export function decodeWords(list: string): ReadonlySet<string> {
  const out = new Set<string>();
  let word = "";
  for (const entry of list.split(" ")) {
    const kept = entry.charCodeAt(0) - 48;
    word = word.slice(0, kept) + entry.slice(1);
    out.add(word);
  }
  return out;
}

/** A word as the list and the learned words hold it: lower case, with a straight apostrophe. */
export const normalWord = (word: string) => word.replace(/’/g, "'").toLowerCase();

/** Whether a word is one the list or the person knows: in any case, and without an ending of `'s`. */
export function knowsWord(
  word: string,
  list: ReadonlySet<string>,
  also: ReadonlySet<string> = new Set(),
): boolean {
  const plain = normalWord(word);
  const stem = plain.replace(/'s$/, "");
  return (
    word.length < 2 ||
    /^\p{Lu}+$/u.test(word) ||
    also.has(plain) ||
    list.has(plain) ||
    list.has(stem)
  );
}

/**
 * The first word in `text` that ends after `from` and is not known, with where it is: a place inside
 * a word stands for the whole word, never for the letters after it.
 */
export function nextUnknownWord(
  text: string,
  from: number,
  list: ReadonlySet<string>,
  also?: ReadonlySet<string>,
): { word: string; start: number; end: number } | undefined {
  CHECKED_WORD.lastIndex = 0;
  for (let match = CHECKED_WORD.exec(text); match; match = CHECKED_WORD.exec(text)) {
    const word = match[0].replace(/['’]+$/, "");
    if (match.index + word.length > from && !knowsWord(word, list, also)) {
      return { word, start: match.index, end: match.index + word.length };
    }
  }
  return undefined;
}

/** How many single edits, a swap of two neighbours among them, make `a` into `b`; past `most`, more. */
export function editDistance(a: string, b: string, most: number): number {
  if (Math.abs(a.length - b.length) > most) return most + 1;
  let older: number[] = [];
  let last = Array.from({ length: b.length + 1 }, (_, at) => at);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const same = a[i - 1] === b[j - 1] ? 0 : 1;
      let cost = Math.min((last[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (last[j - 1] ?? 0) + same);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cost = Math.min(cost, (older[j - 2] ?? 0) + 1);
      }
      row.push(cost);
      best = Math.min(best, cost);
    }
    if (best > most) return most + 1;
    older = last;
    last = row;
  }
  return last[b.length] ?? most + 1;
}

/** What a word could be: the nearest in the list, nearest first, in the case it was written in. */
export function spellingGuesses(word: string, list: ReadonlySet<string>, count = 6): string[] {
  const plain = word.toLowerCase();
  const found: { word: string; distance: number }[] = [];
  for (const each of list) {
    const distance = editDistance(plain, each, 2);
    if (distance <= 2) found.push({ word: each, distance });
  }
  found.sort(
    (a, b) =>
      a.distance - b.distance ||
      Number(b.word[0] === plain[0]) - Number(a.word[0] === plain[0]) ||
      a.word.localeCompare(b.word),
  );
  const capital = /^\p{Lu}/u.test(word);
  return found
    .slice(0, count)
    .map((each) => (capital ? each.word.charAt(0).toUpperCase() + each.word.slice(1) : each.word));
}

const BLOCKS = /^(DIV|P|LI|TD|TR|TABLE|TBODY|H[1-6]|BLOCKQUOTE|PRE|UL|OL)$/;

/** A view's text, and which text node each part of it came from: blocks and `<br>` are line ends. */
export interface FlatText {
  text: string;
  parts: { node: Text; start: number }[];
}

function walkFlat(element: HTMLElement, stop?: { node: Node; offset: number }): FlatText {
  let text = "";
  const parts: FlatText["parts"] = [];
  const walk = (node: Node): boolean => {
    let index = 0;
    for (const child of node.childNodes) {
      if (node === stop?.node && index === stop.offset) return true;
      index += 1;
      if (child instanceof Text) {
        parts.push({ node: child, start: text.length });
        if (child === stop?.node) {
          text += child.data.slice(0, stop.offset);
          return true;
        }
        text += child.data;
      } else if (child instanceof HTMLElement) {
        if (child.tagName === "BR") {
          if (child === stop?.node) return true;
          text += "\n";
        } else {
          const block = BLOCKS.test(child.tagName);
          if (block && text !== "" && !text.endsWith("\n")) text += "\n";
          if (walk(child)) return true;
          if (block && !text.endsWith("\n")) text += "\n";
        }
      }
    }
    return node === stop?.node;
  };
  walk(element);
  return { text, parts };
}

export function flatText(element: HTMLElement): FlatText {
  return walkFlat(element);
}

/** The range of a stretch of a view's flat text. */
export function rangeOfFlat(flat: FlatText, start: number, end: number): Range | undefined {
  const place = (at: number) => {
    for (let index = flat.parts.length - 1; index >= 0; index -= 1) {
      const part = flat.parts[index];
      if (part && part.start <= at && at <= part.start + part.node.length) {
        return { node: part.node, offset: at - part.start };
      }
    }
    return undefined;
  };
  const from = place(start);
  const to = place(end);
  if (!from || !to) return undefined;
  const range = from.node.ownerDocument.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
}

/**
 * How much of a view's flat text comes before a place: the line ends written before it count, and the
 * end of the block holding it does not.
 */
export function flatOffsetBefore(element: HTMLElement, node: Node, offset: number): number {
  return walkFlat(element, { node, offset }).text.length;
}

/** Where a place in a view's text is in its flat text: between elements, where the next text starts. */
export function flatOffset(flat: FlatText, node: Node | null, offset: number): number {
  if (!node) return 0;
  const part = flat.parts.find((each) => each.node === node);
  if (part) return part.start + offset;
  const point = (node.ownerDocument ?? (node as Document)).createRange();
  point.setStart(node, offset);
  point.collapse(true);
  return (
    flat.parts.find((each) => point.comparePoint(each.node, 0) >= 0)?.start ?? flat.text.length
  );
}
