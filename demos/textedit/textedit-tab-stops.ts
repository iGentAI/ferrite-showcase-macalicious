/**
 * A paragraph's tab stops, and laying out the tab characters of editable text at them. CSS has one
 * `tab-size` for an element, but Chromium's tab advance is taken from the inline box that holds the
 * tab character, up to the next multiple of its `tab-size` counted from the start of the line. So a
 * tab alone in its own element, with `tab-size` set to where it must end, ends there. Typing a tab
 * already gets such an element (`<span style="white-space: pre">`), and setting a style on it leaves
 * the browser's undo history as it was.
 */

export type TabKind = "left" | "center" | "right" | "decimal";

export interface TabStop {
  /** Distance from the ruler's origin, in points. */
  at: number;
  kind: TabKind;
}

/** Where a tab goes past a paragraph's last stop: the next multiple of this from the origin. */
const DEFAULT_INTERVAL = 72;

const LETTERS: Record<TabKind, string> = { left: "l", center: "c", right: "r", decimal: "d" };
const KINDS: Record<string, TabKind> = { l: "left", c: "center", r: "right", d: "decimal" };

/** Stops as a paragraph's `data-tabs` holds them: `72l 144c`. */
export const tabStopsText = (stops: readonly TabStop[]) =>
  stops.map(({ at, kind }) => `${Math.round(at * 1000) / 1000}${LETTERS[kind]}`).join(" ");

/** What `data-tabs` holds; `undefined` when it has no such attribute. */
export function parseTabStops(text: string | undefined): TabStop[] | undefined {
  if (text === undefined) return undefined;
  return text.split(" ").flatMap((part) => {
    const kind = KINDS[part.slice(-1)];
    const at = Number.parseFloat(part);
    return kind && Number.isFinite(at) ? [{ at, kind }] : [];
  });
}

export const leftStops = (stops: readonly number[]): TabStop[] =>
  stops.map((at) => ({ at, kind: "left" as const }));

/** The text after a tab, up to the next tab or the line's end. */
export interface FollowingText {
  width: number;
  /** The width up to its first decimal point; all of it when it has none. */
  beforeDecimal: number;
}

/**
 * Where a tab that starts at `x` must end, in the paragraph's coordinates: the first stop past `x`,
 * with the following text placed as the stop's kind says. Text too wide for its stop follows the
 * tab directly, as an NSTextView sets it. `margin` is where the paragraph starts on the ruler.
 */
export function tabEnd(
  x: number,
  stops: readonly TabStop[],
  following: FollowingText,
  margin = 0,
): number {
  const sorted = [...stops].sort((one, two) => one.at - two.at);
  const stop = sorted.find(({ at }) => at - margin > x + 0.01);
  if (!stop) {
    return (Math.floor((x + margin) / DEFAULT_INTERVAL) + 1) * DEFAULT_INTERVAL - margin;
  }
  const at = stop.at - margin;
  const end =
    stop.kind === "right"
      ? at - following.width
      : stop.kind === "center"
        ? at - following.width / 2
        : stop.kind === "decimal"
          ? at - following.beforeDecimal
          : at;
  return Math.max(end, x + 0.01);
}

interface TabPlace {
  node: Text;
  offset: number;
}

function tabsIn(root: Element): TabPlace[] {
  const tabs: TabPlace[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    for (let at = node.data.indexOf("\t"); at >= 0; at = node.data.indexOf("\t", at + 1)) {
      tabs.push({ node, offset: at });
    }
  }
  return tabs;
}

const tabsDirectlyIn = (element: Element) => {
  let count = 0;
  for (const child of element.childNodes) {
    if (child.nodeType === 3) count += (child as Text).data.split("\t").length - 1;
  }
  return count;
};

/** Gives a tab an inline element of its own, keeping an insertion point in that text where it was. */
function wrapTab({ node, offset }: TabPlace): HTMLElement {
  const document = node.ownerDocument;
  const selection = document.getSelection();
  const caret =
    selection?.isCollapsed && selection.anchorNode === node ? selection.anchorOffset : null;
  const tab = offset > 0 ? node.splitText(offset) : node;
  const rest = tab.splitText(1);
  const holder = document.createElement("span");
  tab.before(holder);
  holder.append(tab);
  if (caret !== null) {
    if (caret <= offset) selection?.collapse(node, caret);
    else selection?.collapse(rest, caret - offset - 1);
  }
  return holder;
}

function holderOf(place: TabPlace, container: Element): HTMLElement {
  const parent = place.node.parentElement;
  return parent && parent !== container && tabsDirectlyIn(parent) === 1 && parent.tagName === "SPAN"
    ? parent
    : wrapTab(place);
}

/** The rectangles of a range on the line it starts on: its width there. */
function widthOnFirstLine(range: Range, zoom: number): number {
  const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
  const first = rects[0];
  if (!first) return 0;
  const onLine = rects.filter((rect) => Math.abs(rect.top - first.top) < first.height);
  const left = Math.min(...onLine.map((rect) => rect.left));
  const right = Math.max(...onLine.map((rect) => rect.right));
  return (right - left) / zoom;
}

function measureFollowing(
  tab: TabPlace,
  next: TabPlace | undefined,
  container: Element,
  zoom: number,
): FollowingText {
  const range = tab.node.ownerDocument.createRange();
  range.setStart(tab.node, tab.offset + 1);
  if (next) range.setEnd(next.node, next.offset);
  else range.setEnd(container, container.childNodes.length);
  const width = widthOnFirstLine(range, zoom);
  const walker = tab.node.ownerDocument.createTreeWalker(range.commonAncestorContainer, 4);
  walker.currentNode = tab.node;
  let node: Text | null = tab.node;
  let from = tab.offset + 1;
  while (node) {
    const inRange = range.intersectsNode(node);
    if (!inRange) break;
    const end = node === range.endContainer ? range.endOffset : node.data.length;
    const dot = node.data.slice(from, end).indexOf(".");
    if (dot >= 0) {
      const before = range.cloneRange();
      before.setEnd(node, from + dot);
      return { width, beforeDecimal: widthOnFirstLine(before, zoom) };
    }
    node = walker.nextNode() as Text | null;
    from = 0;
  }
  return { width, beforeDecimal: width };
}

const setTabSize = (holder: HTMLElement, end: number) => {
  const value = `${Math.round(end * 100) / 100}px`;
  if (holder.style.getPropertyValue("tab-size") !== value) {
    holder.style.setProperty("tab-size", value);
  }
};

function layoutParagraph(
  paragraph: Element,
  stops: readonly TabStop[],
  margin: number,
  zoom: number,
) {
  let at = 0;
  for (;;) {
    // Wrapping a tab splits its text, so the places are read again each time.
    const tab = tabsIn(paragraph)[at];
    if (!tab) return;
    const holder = holderOf(tab, paragraph);
    const places = tabsIn(paragraph);
    const place = places[at] as TabPlace;
    const measure = place.node.ownerDocument.createRange();
    measure.setStart(place.node, place.offset);
    measure.setEnd(place.node, place.offset + 1);
    // Set small first: a wide tab could send the text after it to the next line, out of its measure.
    setTabSize(holder, 1);
    const x =
      (measure.getBoundingClientRect().left - paragraph.getBoundingClientRect().left) / zoom;
    const following = measureFollowing(place, places[at + 1], paragraph, zoom);
    setTabSize(holder, tabEnd(x, stops, following, margin));
    at += 1;
  }
}

const isBlock = (element: Element) =>
  /^(DIV|P|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE)$/.test(element.tagName);

/**
 * Sets every tab of the view's paragraphs to end at its stop: a paragraph's own, or `documentStops`.
 * Tables keep the view's one width. A paragraph that is not set from the left has its line's start
 * moved after this is measured, so its tabs stay at that width too.
 */
export function layoutTabs(
  editor: HTMLElement,
  documentStops: readonly TabStop[],
  zoom = 1,
  only?: Node | null,
): void {
  for (const child of editor.children) {
    if (only && !child.contains(only)) continue;
    if (!isBlock(child) || !child.textContent?.includes("\t")) continue;
    const style = getComputedStyle(child);
    if (style.direction === "rtl" || style.textAlign === "center" || style.textAlign === "right") {
      for (const { node } of tabsIn(child)) node.parentElement?.style.removeProperty("tab-size");
      continue;
    }
    const stops = parseTabStops((child as HTMLElement).dataset.tabs) ?? documentStops;
    layoutParagraph(child, stops, Number.parseFloat(style.marginLeft) || 0, zoom);
  }
}

/** A view's HTML without what the layout writes: two views of one text differ only in that. */
export const withoutTabLayout = (html: string) =>
  html.replace(/ ?tab-size: ?[\d.]+px;?/g, "").replace(/ style=""/g, "");
