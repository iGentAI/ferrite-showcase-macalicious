/**
 * Format's commands on the lines of a New Message that the rich-text module leaves to the mail: lists,
 * indentation and quote levels, and what Make Plain Text does. A quote level is a `blockquote` around a
 * line, which survives being sent (`richTextFromHtml` keeps it) and which the reader's window draws with its
 * rule.
 *
 * A line is a leaf block: the deepest block with no block inside it, or bare text up to a `<br>`. A list item
 * is always a leaf, and a table cell or definition is one when it holds no block; those keep their quote
 * inside them, the one place HTML lets it be. Increase wraps each leaf selected. Decrease takes each out of
 * its nearest quote, splitting whatever lies between it and the quote.
 */

export type MailTextCommand =
  | "bulleted-list"
  | "numbered-list"
  | "indent"
  | "outdent"
  | "quote-more"
  | "quote-less";

const BROWSER: Partial<Record<MailTextCommand, string>> = {
  "bulleted-list": "insertUnorderedList",
  "numbered-list": "insertOrderedList",
  indent: "indent",
  outdent: "outdent",
};

/** The elements that are lines by themselves; anything else lies on a line with its neighbours. */
const BLOCK =
  /^(DIV|P|H[1-6]|UL|OL|LI|BLOCKQUOTE|PRE|TABLE|CAPTION|THEAD|TBODY|TFOOT|TR|TD|TH|DL|DT|DD|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|NAV|MAIN|FIGURE|FIGCAPTION|ADDRESS|CENTER|HR)$/;
const CELL = /^(TD|TH|DT|DD|CAPTION)$/;

const holdsBlock = (node: Node) => [...node.childNodes].some((child) => BLOCK.test(child.nodeName));
const isBlank = (node: Node | null | undefined) =>
  node?.nodeType === 3 && node.textContent?.trim() === "";

const isQuote = (node: Node | null | undefined): node is HTMLElement =>
  node?.nodeName === "BLOCKQUOTE";
const isList = (node: Node | null | undefined): node is HTMLElement =>
  node?.nodeName === "UL" || node?.nodeName === "OL";
/** A leaf whose quote goes inside it. */
const isItem = (node: Node | null | undefined): node is HTMLElement =>
  node?.nodeName === "LI" || (CELL.test(node?.nodeName ?? "") && !holdsBlock(node as Node));
/** A block that only groups other blocks: its lines are what it holds. */
const isGroup = (node: Node | null | undefined): node is HTMLElement =>
  !!node && node.nodeName !== "LI" && BLOCK.test(node.nodeName) && holdsBlock(node);

/** What an item holds that is lines of their own: any block with a list in it, or the list itself. */
const isNested = (node: Node): boolean =>
  isList(node) || (BLOCK.test(node.nodeName) && (node as Element).querySelector("ul,ol") !== null);

/** Puts each run of neighbouring children that belong into a quote of its own, where the run is. */
function quoteRuns(
  item: HTMLElement,
  belongs: (child: ChildNode) => boolean,
  quote: () => HTMLElement,
) {
  let run: ChildNode[] = [];
  const close = () => {
    while (isBlank(run.at(-1))) run.pop();
    const [first] = run;
    if (first) {
      const around = quote();
      first.before(around);
      around.append(...run);
    }
    run = [];
  };
  for (const child of [...item.childNodes]) {
    if (!belongs(child)) close();
    else if (run.length > 0 || !isBlank(child)) run.push(child);
  }
  close();
}

/** What is an item's own line: all it holds but its nested lists. */
const ownOf = (item: HTMLElement) => [...item.childNodes].filter((child) => !isNested(child));

/** What Make Plain Text would take away: anything but lines of unstyled text. */
const STYLED = ":not(div,p,br,span),[style],[align]";

/** Whether the message holds a style, list or quote that being made plain would remove. */
export const holdsStyles = (root: HTMLElement) => root.querySelector(STYLED) !== null;

/** The lines of `parent`, each the nodes that make it, at whatever depth. Blank text is no line. */
function leavesOf(parent: Node): ChildNode[][] {
  const leaves: ChildNode[][] = [];
  let run: ChildNode[] | null = null;
  for (const child of parent.childNodes) {
    if (!BLOCK.test(child.nodeName)) {
      if ((child.nodeType !== 1 && child.nodeType !== 3) || /^COL/.test(child.nodeName)) continue;
      if (!run && isBlank(child)) continue;
      if (run) run.push(child);
      else {
        run = [child];
        leaves.push(run);
      }
      if (child.nodeName === "BR") run = null;
      continue;
    }
    run = null;
    if (isItem(child)) {
      leaves.push([child]);
      for (const nested of [...child.childNodes].filter(isNested)) {
        leaves.push(...leavesOf(nested));
      }
    } else if (isQuote(child) || isList(child) || isGroup(child)) {
      leaves.push(...leavesOf(child));
    } else {
      leaves.push([child]);
    }
  }
  return leaves;
}

const partsOf = (leaf: readonly ChildNode[]) =>
  leaf.flatMap((part) => (isItem(part) ? ownOf(part) : [part]));

/** The nearest sibling of `node` on one side that is not blank text. */
function beside(node: Node, back: boolean): Node | null {
  let at = back ? node.previousSibling : node.nextSibling;
  while (isBlank(at)) at = back ? (at as Node).previousSibling : (at as Node).nextSibling;
  return at;
}

/** The node of the line before a place that touches no line, or else of the line after it. */
function nodeNear(range: Range): Node | null {
  const { startContainer: container, startOffset: offset } = range;
  const inText = container.nodeType === 3;
  let near: Node | null = inText
    ? container
    : (container.childNodes[offset - 1] ?? container.childNodes[offset] ?? null);
  let back = inText || container.childNodes[offset - 1] !== undefined;
  if (near && isBlank(near)) {
    const before = beside(near, true);
    back = before !== null;
    near = before ?? beside(near, false);
  }
  while (near && !isItem(near) && (isQuote(near) || isList(near) || isGroup(near))) {
    const end: Node | null = back ? near.lastChild : near.firstChild;
    near = end && isBlank(end) ? beside(end, back) : end;
  }
  return near;
}

/** The lines the selection touches, in order; every line when it is not in the message. */
function leavesSelected(root: HTMLElement, range: Range | null): ChildNode[][] {
  const all = leavesOf(root);
  if (!range) return all;
  // A selection ending at the very start of a line, or starting at its very end, selects nothing of it.
  const reached = (node: Node) => {
    if (!range.intersectsNode(node)) return false;
    if (range.collapsed) return true;
    const part = root.ownerDocument.createRange();
    part.selectNodeContents(node);
    if (node.contains(range.startContainer)) part.setStart(range.startContainer, range.startOffset);
    if (node.contains(range.endContainer)) part.setEnd(range.endContainer, range.endOffset);
    if (node.nodeType === 1 && node.childNodes.length === 0) return true;
    const held = part.cloneContents();
    return held.textContent !== "" || held.querySelector("br, img") !== null;
  };
  const touched = all.filter((leaf) => partsOf(leaf).some(reached));
  if (touched.length > 0) return touched;
  const found = nodeNear(range);
  if (!found) return [];
  const leaf = all.find(
    (each) => each.includes(found as ChildNode) || partsOf(each).some((p) => p.contains(found)),
  );
  return leaf ? [leaf] : [];
}

/** One end of a selection, by a node that stays in the message while lines move around it. */
interface SelectionEnd {
  node: Node;
  /** The offset in a text node, or `"before"` or `"after"` that node. */
  at: number | "before" | "after";
}

function endOf(container: Node, offset: number, side: "start" | "end"): SelectionEnd {
  if (container.nodeType === 3) return { node: container, at: offset };
  const next = container.childNodes[offset];
  const previous = container.childNodes[offset - 1];
  const at = side === "start" ? (next ? "before" : "after") : previous ? "after" : "before";
  let node: Node | undefined = at === "before" ? next : previous;
  while ((isQuote(node) || isGroup(node)) && node.firstChild) {
    node = (at === "before" ? node.firstChild : node.lastChild) ?? undefined;
  }
  return node ? { node, at } : { node: container, at: 0 };
}

/** Runs `change`, which moves lines, and puts `held` back on the same text. */
function keepingSelection(held: Range | null, lines: readonly ChildNode[], change: () => void) {
  const collapsed = held?.collapsed === true;
  // An insertion point between two lines belongs to the one before it, and stays with it.
  const withLine =
    collapsed && held && held.startContainer.childNodes[held.startOffset - 1] === lines.at(-1)
      ? lines.at(-1)
      : undefined;
  const start = held && endOf(held.startContainer, held.startOffset, "start");
  const end = held && endOf(held.endContainer, held.endOffset, "end");
  change();
  if (!held || !start || !end) return;
  const place = ({ node, at }: SelectionEnd, setter: "setStart" | "setEnd") => {
    if (typeof at === "number") held[setter](node, at);
    else if (at === "before") held[`${setter}Before`](node);
    else held[`${setter}After`](node);
  };
  if (withLine) {
    // Into a list item's own quote, where what is typed next belongs.
    const own = isItem(withLine) ? ownOf(withLine).at(-1) : undefined;
    const target: Node = isQuote(own) ? own : withLine;
    if (target.nodeName === "BR") {
      held.setStartBefore(target);
      held.collapse(true);
    } else {
      held.selectNodeContents(target);
      held.collapse(false);
    }
  } else {
    place(start, "setStart");
    if (collapsed) held.collapse(true);
    else place(end, "setEnd");
  }
}

/** One level more around each line selected, lines next to each other in one quote. */
function quoteMore(root: HTMLElement, range: Range | null) {
  const leaves = leavesSelected(root, range);
  const document = root.ownerDocument;
  if (leaves.length === 0) {
    // Nothing to keep the selection on: the insertion point goes into the new quote, for what is typed next.
    const empty = document.createElement("blockquote");
    empty.append(document.createElement("br"));
    root.append(empty);
    range?.setStart(empty, 0);
    range?.collapse(true);
    return;
  }
  keepingSelection(range, leaves.flat(), () => {
    let quote: HTMLElement | null = null;
    for (const leaf of leaves) {
      const first = leaf[0] as ChildNode;
      if (isItem(first)) {
        quote = null;
        quoteRuns(
          first,
          (child) => !isNested(child),
          () => document.createElement("blockquote"),
        );
        continue;
      }
      const between: ChildNode[] = [];
      let next = quote?.nextSibling ?? null;
      while (next && next !== first && isBlank(next)) {
        between.push(next);
        next = next.nextSibling;
      }
      if (quote && next === first) quote.append(...between, ...leaf);
      else {
        quote = document.createElement("blockquote");
        first.replaceWith(quote);
        quote.append(...leaf);
      }
    }
  });
}

/** The quote nearest around `node` in the message, if any. */
function quoteAround(node: Node, root: HTMLElement): HTMLElement | null {
  for (let at = node.parentNode; at && at !== root; at = at.parentNode) {
    if (isQuote(at)) return at;
  }
  return null;
}

/**
 * Takes `first` through `last`, siblings or not, out of `quote`: every block between them and the quote is
 * split, a copy of it keeping what lies before and another what lies after, and the quote then comes away.
 * A list item a split leaves with nothing but a list in it goes, its list staying where it is, so the list
 * keeps its indent and no bullet stands above it with no text of its own.
 */
function liftOut(first: ChildNode, last: ChildNode, quote: HTMLElement) {
  const split: HTMLElement[] = [];
  for (let node: Node = first; node !== quote; node = node.parentNode as Node) {
    const parent = node.parentNode as HTMLElement;
    if (!node.previousSibling) continue;
    const earlier = parent.cloneNode(false) as HTMLElement;
    while (parent.firstChild !== node) earlier.append(parent.firstChild as ChildNode);
    parent.before(earlier);
    split.push(parent);
  }
  for (let node: Node = last; node !== quote; node = node.parentNode as Node) {
    const parent = node.parentNode as HTMLElement;
    if (!node.nextSibling) continue;
    const later = parent.cloneNode(false) as HTMLElement;
    while (node.nextSibling) later.append(node.nextSibling);
    parent.after(later);
    split.push(parent, later);
  }
  quote.replaceWith(...quote.childNodes);
  for (const block of split) {
    if (!isItem(block) || !block.parentNode) continue;
    const held = [...block.childNodes].filter((child) => !isBlank(child));
    if (held.length > 0 && held.every(isList)) block.replaceWith(...block.childNodes);
  }
}

/**
 * One level less on each line selected, whatever the lines around it keep: an item's own quote comes off
 * first, and any other line leaves its nearest quote. Lines leaving one quote together stay together, so a
 * whole list selected stays one list. The last of them keeps the lists nested in it where they are, a copy
 * of the quote around them inside the item, since they are not selected. A line in no quote stays as it is.
 */
function quoteLess(root: HTMLElement, range: Range | null) {
  const leaves = leavesSelected(root, range);
  const ownQuotes = (leaf: readonly ChildNode[] | undefined) => {
    const first = leaf?.[0];
    return isItem(first) ? ownOf(first).filter(isQuote) : [];
  };
  keepingSelection(range, leaves.flat(), () => {
    let at = 0;
    while (at < leaves.length) {
      const own = ownQuotes(leaves[at]);
      if (own.length > 0) {
        for (const quote of own) quote.replaceWith(...quote.childNodes);
        at += 1;
        continue;
      }
      const leaf = leaves[at] as ChildNode[];
      const quote = quoteAround(leaf[0] as ChildNode, root);
      let end = at + 1;
      while (
        quote &&
        end < leaves.length &&
        ownQuotes(leaves[end]).length === 0 &&
        quoteAround(leaves[end]?.[0] as ChildNode, root) === quote
      ) {
        end += 1;
      }
      if (quote) {
        const last = leaves[end - 1]?.at(-1) as ChildNode;
        if (isItem(last)) {
          quoteRuns(last, isNested, () => quote.cloneNode(false) as HTMLElement);
        }
        liftOut(leaf[0] as ChildNode, last, quote);
      }
      at = end;
    }
  });
}

/** Where `node` lies under `root`, as child indexes. */
function pathOf(node: Node, root: Node): number[] {
  const path: number[] = [];
  for (let at = node; at !== root; at = at.parentNode as Node) {
    path.unshift([...(at.parentNode as Node).childNodes].indexOf(at as ChildNode));
  }
  return path;
}

/** The node at `path` under `root`, as deep as the tree goes. */
function nodeAt(root: Node, path: readonly number[]): Node {
  let at = root;
  for (const index of path) at = at.childNodes[index] ?? at;
  return at;
}

const sizeOf = (node: Node) =>
  node.nodeType === 3 ? (node.textContent?.length ?? 0) : node.childNodes.length;

/** A selection that outlives the nodes it was made on. */
interface HeldSelection {
  start: readonly number[];
  startOffset: number;
  end: readonly number[];
  endOffset: number;
}

const holdSelection = (range: Range | null, root: Node): HeldSelection | null =>
  range && {
    start: pathOf(range.startContainer, root),
    startOffset: range.startOffset,
    end: pathOf(range.endContainer, root),
    endOffset: range.endOffset,
  };

function selectHeld(root: HTMLElement, held: HeldSelection | null) {
  const selection = root.ownerDocument.getSelection();
  if (!selection || !held) return;
  const range = root.ownerDocument.createRange();
  const start = nodeAt(root, held.start);
  const end = nodeAt(root, held.end);
  range.setStart(start, Math.min(held.startOffset, sizeOf(start)));
  range.setEnd(end, Math.min(held.endOffset, sizeOf(end)));
  selection.removeAllRanges();
  selection.addRange(range);
}

/** The message's nodes as they stand, themselves and not a copy. */
interface HeldNode {
  node: ChildNode;
  children: readonly HeldNode[];
}

const holdNodes = (parent: Node): readonly HeldNode[] =>
  [...parent.childNodes].map((node) => ({ node, children: holdNodes(node) }));

function putNodesBack(parent: Node, held: readonly HeldNode[]) {
  (parent as ParentNode).replaceChildren(...held.map(({ node }) => node));
  for (const { node, children } of held) {
    if (node.nodeType === 1) putNodesBack(node, children);
  }
}

/** A quote level changed, as Undo and Redo give it back. */
interface QuoteStep {
  before: string;
  beforeNodes: readonly HeldNode[];
  beforeSelection: HeldSelection | null;
  after: string;
  afterNodes: readonly HeldNode[];
  afterSelection: HeldSelection | null;
}

const MAX_QUOTE_STEPS = 50;

/**
 * Each message's quote level changes. The browser's own history cannot hold them: its one command that
 * writes a tree, `insertHTML`, merges what it writes into the block it replaces, so a quote gains levels and
 * a list swallows the line after it (Chromium 156). What it holds of the typing names nodes, so a step puts
 * the very nodes back and what was typed before the level can still be undone.
 */
const quoteSteps = new WeakMap<HTMLElement, { undo: QuoteStep[]; redo: QuoteStep[] }>();

function changeQuotes(root: HTMLElement, change: typeof quoteMore) {
  const document = root.ownerDocument;
  const selection = document.getSelection();
  const live = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const range = live?.intersectsNode(root) ? live.cloneRange() : null;
  // A selection reaching beyond the message counts only for what lies in it.
  if (range && !root.contains(range.startContainer)) range.setStart(root, 0);
  if (range && !root.contains(range.endContainer)) range.setEnd(root, root.childNodes.length);
  const before = root.innerHTML;
  const beforeNodes = holdNodes(root);
  const beforeSelection = holdSelection(range, root);
  change(root, range);
  const after = root.innerHTML;
  if (range) {
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  if (after !== before) {
    const steps = quoteSteps.get(root) ?? { undo: [], redo: [] };
    quoteSteps.set(root, steps);
    steps.undo = [
      ...steps.undo.slice(1 - MAX_QUOTE_STEPS),
      {
        before,
        beforeNodes,
        beforeSelection,
        after,
        afterNodes: holdNodes(root),
        afterSelection: holdSelection(range, root),
      },
    ];
    steps.redo = [];
  }
  root.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Undo or Redo of a quote level, when that is the last thing done to the message as it stands: anything
 * typed since is the browser's to take back first. Whether it did.
 */
export function stepQuoteLevel(root: HTMLElement, way: "undo" | "redo"): boolean {
  const steps = quoteSteps.get(root);
  const step = steps?.[way].at(-1);
  if (!steps || !step || root.innerHTML !== (way === "undo" ? step.after : step.before)) {
    return false;
  }
  steps[way].pop();
  steps[way === "undo" ? "redo" : "undo"].push(step);
  const html = way === "undo" ? step.before : step.after;
  putNodesBack(root, way === "undo" ? step.beforeNodes : step.afterNodes);
  // The browser may have replaced a node since, leaving the one held behind what it now shows.
  if (root.innerHTML !== html) root.innerHTML = html;
  selectHeld(root, way === "undo" ? step.beforeSelection : step.afterSelection);
  root.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/** Runs `command` on the message's lines. Whether it could: a browser may refuse its own commands. */
export function runMailText(root: HTMLElement, command: MailTextCommand): boolean {
  const browser = BROWSER[command];
  if (browser) {
    return root.ownerDocument.execCommand?.(browser, false) ?? false;
  }
  changeQuotes(root, command === "quote-more" ? quoteMore : quoteLess);
  return true;
}

/** Puts the insertion point where a drop landed, as the browser that has either way can say. */
export function placeCaretAt(document: Document, x: number, y: number) {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position) {
    document.getSelection()?.collapse(position.offsetNode, position.offset);
    return;
  }
  const range = document.caretRangeFromPoint?.(x, y);
  if (range) document.getSelection()?.collapse(range.startContainer, range.startOffset);
}

/** The message's text as lines of unstyled text: what Make Plain Text leaves of it. */
export function makePlain(root: HTMLElement, text: string) {
  const document = root.ownerDocument;
  root.replaceChildren(
    ...text.split("\n").map((line) => {
      const div = document.createElement("div");
      if (line) div.textContent = line;
      else div.append(document.createElement("br"));
      return div;
    }),
  );
  root.dispatchEvent(new Event("input", { bubbles: true }));
}
