"use client";

import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";

/* The rows of Format and Edit that act on the characters of the selection beyond what the browser's own
 * commands set: kerning, ligatures, baseline, outline, the copied style, the breaks and links.
 */

export type TextEditExtraCommand =
  | "outline"
  | "kern-default"
  | "kern-none"
  | "kern-tighten"
  | "kern-loosen"
  | "ligatures-default"
  | "ligatures-none"
  | "ligatures-all"
  | "baseline-default"
  | "baseline-super"
  | "baseline-sub"
  | "baseline-raise"
  | "baseline-lower"
  | "copy-style"
  | "paste-style"
  | "direction-natural"
  | "direction-ltr"
  | "direction-rtl"
  | "copy-ruler"
  | "paste-ruler"
  | "show-styles"
  | "show-spacing";

/** The style properties of a selection's characters that Copy Style carries. */
export const STYLE_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration-line",
  "color",
  "letter-spacing",
  "font-kerning",
  "font-variant-ligatures",
  "vertical-align",
  "-webkit-text-stroke-width",
  "-webkit-text-stroke-color",
  "-webkit-text-fill-color",
] as const;

export type CopiedStyle = Readonly<Record<string, string>>;

const selectionIn = (editor: HTMLElement): Range | null => {
  const selection = editor.ownerDocument.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  return range && editor.contains(range.commonAncestorContainer) ? range : null;
};

/** The element of the selection's first character. */
function firstElementOf(range: Range, editor: HTMLElement): HTMLElement {
  if (!range.collapsed) {
    const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    for (let at = walker.nextNode(); at; at = walker.nextNode()) {
      if (!range.intersectsNode(at)) continue;
      const from = at === range.startContainer ? range.startOffset : 0;
      const to = at === range.endContainer ? range.endOffset : (at.nodeValue?.length ?? 0);
      if (to > from && at.parentElement) return at.parentElement;
    }
  }
  let node: Node = range.startContainer;
  if (node.nodeType !== 3 && node.childNodes[range.startOffset]) {
    node = node.childNodes[range.startOffset] as Node;
    const walker = editor.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    node = walker.nextNode() ?? node;
  }
  const element = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
  return element ?? editor;
}

/** Elements of a paragraph's text that show a property the wrapper itself, not only its style. */
const TAGS_OF: Readonly<Record<string, readonly string[]>> = {
  "text-decoration-line": ["U", "S", "STRIKE", "DEL"],
  "vertical-align": ["SUP", "SUB"],
  "font-weight": ["B", "STRONG"],
  "font-style": ["I", "EM"],
};
const FONT_ATTRIBUTES: Readonly<Record<string, string>> = {
  "font-family": "face",
  "font-size": "size",
  color: "color",
};
const BLOCKS = /^(DIV|P|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE)$/;

/** The outermost node holding `node` that is still inside its paragraph. */
function outermostInline(node: Node, editor: HTMLElement): Node {
  let at = node;
  while (at.parentNode && at.parentNode !== editor) {
    if (at.parentNode instanceof HTMLElement && BLOCKS.test(at.parentNode.tagName)) break;
    at = at.parentNode;
  }
  return at;
}

/** A copy of `wrapper` that no longer sets `names`, or `null` when nothing is left of it. */
function without(wrapper: HTMLElement, names: readonly string[]): HTMLElement | null {
  let copy = wrapper.cloneNode(false) as HTMLElement;
  if (names.some((name) => TAGS_OF[name]?.includes(copy.tagName))) {
    // The tag itself shows the property: a plain element keeps what else it carries.
    const plain = wrapper.ownerDocument.createElement("span");
    for (const attribute of copy.attributes) plain.setAttribute(attribute.name, attribute.value);
    // SUP and SUB draw smaller as well: a change of baseline keeps that size.
    if ((copy.tagName === "SUP" || copy.tagName === "SUB") && !plain.style.fontSize) {
      plain.style.fontSize = "smaller";
    }
    copy = plain;
  }
  for (const name of names) {
    copy.style.removeProperty(name);
    if (name === "text-decoration-line") copy.style.removeProperty("text-decoration");
    const attribute = FONT_ATTRIBUTES[name];
    if (attribute) copy.removeAttribute(attribute);
  }
  if (copy.getAttribute("style") === "") copy.removeAttribute("style");
  // The stylesheet underlines a link: only its own style can take that off the selected part.
  if (copy.tagName === "A" && names.includes("text-decoration-line")) {
    copy.style.textDecorationLine = "none";
  }
  const bare = copy.tagName === "SPAN" || copy.tagName === "FONT";
  return bare && copy.attributes.length === 0 ? null : copy;
}

/**
 * A decoration a paragraph carries reaches every character in it, and inserting text keeps the
 * paragraph: it moves onto the paragraph's text, drawn the same, where the selection can split it.
 * Returns the same selection afterwards.
 */
function decorationOnText(editor: HTMLElement, range: Range): Range {
  const document = editor.ownerDocument;
  const { startContainer, startOffset, endContainer, endOffset } = range;
  const startNode = startContainer.nodeType === 3 ? null : startContainer.childNodes[startOffset];
  const endNode = endContainer.nodeType === 3 ? null : endContainer.childNodes[endOffset - 1];
  const decorated = (each: Element) =>
    each instanceof HTMLElement &&
    BLOCKS.test(each.tagName) &&
    each.style.textDecorationLine !== "";
  const blocks = [...editor.querySelectorAll<HTMLElement>("*")].filter(
    (each) =>
      decorated(each) &&
      range.intersectsNode(each) &&
      ![...editor.querySelectorAll("*")].some(
        (other) => other !== each && other.contains(each) && decorated(other),
      ),
  );
  if (blocks.length === 0) return range;
  const carry = (block: HTMLElement, around: ReadonlySet<string>) => {
    const lines = new Set([
      ...around,
      ...block.style.textDecorationLine.split(" ").filter((line) => line && line !== "none"),
    ]);
    block.style.removeProperty("text-decoration");
    block.style.removeProperty("text-decoration-line");
    if (block.getAttribute("style") === "") block.removeAttribute("style");
    for (const child of [...block.childNodes]) {
      if (child instanceof HTMLElement && BLOCKS.test(child.tagName)) carry(child, lines);
      else if (lines.size > 0 && !(child instanceof HTMLElement && child.tagName === "BR")) {
        const carrier = document.createElement("span");
        carrier.style.textDecorationLine = [...lines].join(" ");
        child.replaceWith(carrier);
        carrier.append(child);
      }
    }
  };
  for (const block of blocks) carry(block, new Set());
  const moved = document.createRange();
  if (startNode) moved.setStartBefore(startNode);
  else moved.setStart(startContainer, startOffset);
  if (endNode) moved.setEndAfter(endNode);
  else moved.setEnd(endContainer, endOffset);
  return moved;
}

/**
 * Give the selected characters CSS properties, one step of the browser's undo history. The paragraph
 * text around the selection is inserted again so that the elements holding it are split at the
 * selection's edges: a property an outer element sets (an underline, a raised baseline) cannot be
 * undone from inside it. The text stays selected. The browsers have no command for these, and no way
 * to keep them for what is typed next, so at an insertion point nothing is changed and false is
 * returned, as for `setRichTextSize`.
 */
export function styleSelection(editor: HTMLElement, styles: CopiedStyle): boolean {
  const document = editor.ownerDocument;
  const selected = selectionIn(editor);
  if (!selected || selected.collapsed || typeof document.execCommand !== "function") return false;
  const names = Object.keys(styles);
  const range = names.includes("text-decoration-line")
    ? decorationOnText(editor, selected)
    : selected;
  const whole = document.createRange();
  const atBlock = (node: Node) =>
    node === editor || (node instanceof HTMLElement && BLOCKS.test(node.tagName));
  if (atBlock(range.startContainer)) whole.setStart(range.startContainer, range.startOffset);
  else whole.setStartBefore(outermostInline(range.startContainer, editor));
  if (atBlock(range.endContainer)) whole.setEnd(range.endContainer, range.endOffset);
  else whole.setEndAfter(outermostInline(range.endContainer, editor));

  // Each text of the whole, and which of its characters the selection holds.
  const parts: [number, number][] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (let at = walker.nextNode(); at; at = walker.nextNode()) {
    if (!whole.intersectsNode(at)) continue;
    const length = at.nodeValue?.length ?? 0;
    if (!range.intersectsNode(at)) {
      parts.push([0, 0]);
      continue;
    }
    const from = at === range.startContainer ? range.startOffset : 0;
    const to = at === range.endContainer ? range.endOffset : length;
    parts.push([from, to]);
  }

  const holder = document.createElement("div");
  let next = 0;
  const wrap = (chain: readonly HTMLElement[], leaf: Node): Node => {
    let made = leaf;
    for (const wrapper of [...chain].reverse()) {
      const copy = wrapper.cloneNode(false);
      copy.appendChild(made);
      made = copy;
    }
    return made;
  };
  const render = (from: Node, into: Node, chain: readonly HTMLElement[]) => {
    for (const child of from.childNodes) {
      if (child.nodeType === 3) {
        const value = child.nodeValue ?? "";
        const [start, end] = parts[next] ?? [0, 0];
        next += 1;
        if (start > 0) {
          into.appendChild(wrap(chain, document.createTextNode(value.slice(0, start))));
        }
        if (end > start) {
          const span = document.createElement("span");
          span.dataset.styled = "";
          for (const name of names) span.style.setProperty(name, styles[name] ?? "");
          span.append(value.slice(start, end));
          const kept = chain.flatMap((each) => without(each, names) ?? []);
          into.appendChild(wrap(kept, span));
        }
        if (end < value.length) {
          into.appendChild(wrap(chain, document.createTextNode(value.slice(Math.max(end, start)))));
        }
      } else if (child instanceof HTMLElement) {
        if (BLOCKS.test(child.tagName)) {
          const block = child.cloneNode(false);
          render(child, block, []);
          into.appendChild(block);
        } else if (child.tagName === "BR") into.appendChild(child.cloneNode(false));
        else render(child, into, [...chain, child]);
      }
    }
  };
  render(whole.cloneContents(), holder, []);

  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(whole);
  document.execCommand("styleWithCSS", false, "true");
  if (!document.execCommand("insertHTML", false, holder.innerHTML)) return false;
  const made = editor.querySelectorAll<HTMLElement>("[data-styled]");
  const first = made[0];
  const last = made[made.length - 1];
  if (first && last) {
    const selectedAgain = document.createRange();
    selectedAgain.setStartBefore(first);
    selectedAgain.setEndAfter(last);
    selection?.removeAllRanges();
    selection?.addRange(selectedAgain);
  }
  for (const each of made) delete each.dataset.styled;
  return true;
}

/**
 * The style of the selection's first character, for Paste Style. A decoration is drawn from an outer
 * element and is not inherited, so it is gathered from all of them; a fill that follows the colour
 * stays following it, so that the pasted text takes a later colour.
 */
export function copyStyle(editor: HTMLElement): CopiedStyle | null {
  const range = selectionIn(editor);
  return range ? styleOfElement(firstElementOf(range, editor), editor) : null;
}

function styleOfElement(element: HTMLElement, editor: HTMLElement): CopiedStyle | null {
  const view = editor.ownerDocument.defaultView;
  if (!view) return null;
  const computed = view.getComputedStyle(element);
  const decorations = new Set<string>();
  for (let at: HTMLElement | null = element; at && at !== editor; at = at.parentElement) {
    for (const line of view.getComputedStyle(at).textDecorationLine.split(" ")) {
      if (line !== "none") decorations.add(line);
    }
  }
  const copied: Record<string, string> = {};
  for (const name of STYLE_PROPERTIES) {
    const value = computed.getPropertyValue(name);
    if (value) copied[name] = value;
  }
  copied["text-decoration-line"] = [...decorations].join(" ") || "none";
  // Not inherited either: the shift of the elements holding the character, as it stands.
  const shifts: string[] = [];
  for (let at: HTMLElement | null = element; at && at !== editor; at = at.parentElement) {
    const shift = view.getComputedStyle(at).verticalAlign;
    if (shift !== "baseline") shifts.push(shift);
  }
  copied["vertical-align"] =
    shifts.length === 0
      ? "baseline"
      : shifts.length === 1
        ? (shifts[0] as string)
        : `${baselineOf(element, editor)}px`;
  for (const name of ["-webkit-text-fill-color", "-webkit-text-stroke-color"]) {
    if (copied[name] === computed.color) copied[name] = "currentcolor";
  }
  return copied;
}

/** The most styles Format > Font > Styles… lists of a document. */
const MOST_DOCUMENT_STYLES = 50;

/** The styles of a document's text, each once, in the order they first appear. */
export function documentStyles(editor: HTMLElement): CopiedStyle[] {
  const found = new Map<string, CopiedStyle>();
  const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (
    let at = walker.nextNode();
    at && found.size < MOST_DOCUMENT_STYLES;
    at = walker.nextNode()
  ) {
    if (!at.nodeValue?.trim() || !at.parentElement) continue;
    const style = styleOfElement(at.parentElement, editor);
    if (style) found.set(JSON.stringify(style), style);
  }
  return [...found.values()];
}

/** What Format > Font > Styles… calls a style: its font, size and typeface. */
export function styleName(style: CopiedStyle): string {
  const family = (style["font-family"] ?? "").split(",")[0]?.replace(/["']/g, "").trim();
  const size = Math.round(Number.parseFloat(style["font-size"] ?? "") || 12);
  const weight = style["font-weight"] ?? "";
  const bold = weight === "bold" || Number(weight) >= 600;
  return [
    family || "Helvetica",
    size,
    bold ? "Bold" : "",
    style["font-style"] === "italic" ? "Italic" : "",
    (style["text-decoration-line"] ?? "").includes("underline") ? "Underlined" : "",
  ]
    .filter((part) => part !== "")
    .join(" ");
}

/**
 * How far from the line the elements at `element` carry it, in pixels. `super` and `sub` are in the
 * terms Blink and WebKit draw them: a third of the font size and a fifth, plus a pixel.
 */
function baselineOf(element: HTMLElement | null, editor: HTMLElement): number {
  const view = editor.ownerDocument.defaultView;
  let shift = 0;
  for (let at = element; at && at !== editor && view; at = at.parentElement) {
    const style = view.getComputedStyle(at);
    const size = Number.parseFloat(style.fontSize) || 12;
    if (style.verticalAlign === "super") shift += size / 3 + 1;
    else if (style.verticalAlign === "sub") shift -= size / 5 + 1;
    else shift += Number.parseFloat(style.verticalAlign) || 0;
  }
  return shift;
}

/** The CSS `command` gives the selected characters, read from the first of them where it moves. */
export function stylesOf(
  command: TextEditExtraCommand,
  editor: HTMLElement,
): CopiedStyle | undefined {
  const range = selectionIn(editor);
  const view = editor.ownerDocument.defaultView;
  const current = range && view ? view.getComputedStyle(firstElementOf(range, editor)) : undefined;
  const pixels = (value: string | undefined) => Number.parseFloat(value ?? "") || 0;
  const spacing = pixels(current?.letterSpacing);
  switch (command) {
    case "outline": {
      const on = pixels(current?.getPropertyValue("-webkit-text-stroke-width")) > 0;
      return {
        "-webkit-text-stroke-width": on ? "0px" : "0.5px",
        "-webkit-text-stroke-color": "currentcolor",
        "-webkit-text-fill-color": on ? "currentcolor" : "transparent",
      };
    }
    case "kern-default":
      return { "letter-spacing": "normal", "font-kerning": "auto" };
    case "kern-none":
      return { "letter-spacing": "0px", "font-kerning": "none" };
    case "kern-tighten":
      return { "letter-spacing": `${spacing - 0.5}px` };
    case "kern-loosen":
      return { "letter-spacing": `${spacing + 0.5}px` };
    case "ligatures-default":
      return { "font-variant-ligatures": "normal" };
    case "ligatures-none":
      return { "font-variant-ligatures": "none" };
    case "ligatures-all":
      return { "font-variant-ligatures": "common-ligatures discretionary-ligatures" };
    case "baseline-default":
      return { "vertical-align": "baseline" };
    case "baseline-super":
      return { "vertical-align": "super" };
    case "baseline-sub":
      return { "vertical-align": "sub" };
    case "baseline-raise":
      return {
        "vertical-align": `${baselineOf(range ? firstElementOf(range, editor) : null, editor) + 1}px`,
      };
    case "baseline-lower":
      return {
        "vertical-align": `${baselineOf(range ? firstElementOf(range, editor) : null, editor) - 1}px`,
      };
    default:
      return undefined;
  }
}

/** The break Edit > Insert puts at the selection. */
export type TextEditBreak = "line" | "paragraph" | "page";

/** Insert a break where the selection is, one step of the browser's undo history. */
export function insertBreak(element: HTMLElement, kind: TextEditBreak): void {
  const document = element.ownerDocument;
  if (element instanceof HTMLTextAreaElement) {
    document.execCommand("insertText", false, kind === "page" ? "\f" : "\n");
    return;
  }
  if (kind === "line") document.execCommand("insertLineBreak");
  else if (kind === "paragraph") document.execCommand("insertParagraph");
  // The paragraph after it takes the caret: what is typed next prints on the next page.
  else
    document.execCommand("insertHTML", false, '<div data-page-break=""><br></div><div><br></div>');
}

/** The window's rows of Edit that insert: the breaks, Add Link and Attach Files. */
export function TextEditInsertItems({
  editable,
  rich,
  onInsert,
  onAddLink,
  onAttach,
  onComplete,
}: {
  editable: () => boolean;
  rich: () => boolean;
  onInsert: (kind: TextEditBreak) => void;
  onAddLink: () => void;
  onAttach: () => void;
  onComplete: () => void;
}) {
  return (
    <>
      <MenuItem disabled={!editable()} keyEquivalent="option+escape" onClick={onComplete}>
        Complete
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Insert</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem disabled={!editable()} onClick={() => onInsert("line")}>
            Line Break
          </MenuItem>
          <MenuItem disabled={!editable()} onClick={() => onInsert("paragraph")}>
            Paragraph Break
          </MenuItem>
          <MenuItem disabled={!editable()} onClick={() => onInsert("page")}>
            Page Break
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuItem disabled={!editable() || !rich()} keyEquivalent="command+k" onClick={onAddLink}>
        Add Link…
      </MenuItem>
      <MenuItem
        disabled={!editable() || !rich()}
        keyEquivalent="shift+command+a"
        onClick={onAttach}
      >
        Attach Files…
      </MenuItem>
      <MenuSeparator />
    </>
  );
}

const SUBMENU_ROWS = {
  Kern: [
    ["kern-default", "Use Default"],
    ["kern-none", "Use None"],
    ["kern-tighten", "Tighten"],
    ["kern-loosen", "Loosen"],
  ],
  Ligatures: [
    ["ligatures-default", "Use Default"],
    ["ligatures-none", "Use None"],
    ["ligatures-all", "Use All"],
  ],
  Baseline: [
    ["baseline-default", "Use Default"],
    ["baseline-super", "Superscript"],
    ["baseline-raise", "Raise"],
    ["baseline-lower", "Lower"],
    ["baseline-sub", "Subscript"],
  ],
} as const satisfies Record<string, readonly (readonly [TextEditExtraCommand, string])[]>;

/** Format > Font's rows past the styles and sizes: Outline, Kern, Ligatures, Baseline, the copied style. */
export function TextEditFontExtraItems({
  canPasteStyle,
  onExtra,
}: {
  canPasteStyle: boolean;
  onExtra: (command: TextEditExtraCommand) => void;
}) {
  return (
    <>
      <MenuItem onClick={() => onExtra("outline")}>Outline</MenuItem>
      <MenuItem onClick={() => onExtra("show-styles")}>Styles…</MenuItem>
      <MenuSeparator />
      {Object.entries(SUBMENU_ROWS).map(([title, rows]) => (
        <Submenu key={title}>
          <SubmenuTrigger>{title}</SubmenuTrigger>
          <SubmenuPopup>
            {rows.map(([command, label]) => (
              <MenuItem key={command} onClick={() => onExtra(command)}>
                {label}
              </MenuItem>
            ))}
          </SubmenuPopup>
        </Submenu>
      ))}
      <MenuSeparator />
      <MenuItem keyEquivalent="option+command+c" onClick={() => onExtra("copy-style")}>
        Copy Style
      </MenuItem>
      <MenuItem
        disabled={!canPasteStyle}
        keyEquivalent="option+command+v"
        onClick={() => onExtra("paste-style")}
      >
        Paste Style
      </MenuItem>
    </>
  );
}
