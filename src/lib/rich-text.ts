/**
 * Formatting the text of a `RichTextView` (or any element the browser edits in place) as
 * AppKit's Format menu, Fonts panel and Colors panel do: the character styles of the selection,
 * the alignment of its paragraphs, what the format is where the insertion point is, the key
 * equivalents of those commands, and stored styled text read back without anything that runs.
 *
 * Character formats are the browser's own editing commands (`document.execCommand`), which keep
 * every change in the browser's undo history; they are written as CSS (`styleWithCSS`). The
 * commands act on the document's selection, so it must be inside the editor when they run: a
 * menu, a panel or a toolbar control takes the focus first, and `keepRichTextSelection` gives the
 * editor its selection back.
 */

import { findFontFamily } from "./font-families";

/** How a paragraph is aligned. */
export type RichTextAlignment = "left" | "center" | "right" | "justify";

/** The format of the text at the insertion point, or what a command sets. */
export interface RichTextFormat {
  /** Bold (Command-B). */
  bold: boolean;
  /** Italic or oblique (Command-I). */
  italic: boolean;
  /** Underlined (Command-U). */
  underline: boolean;
  /** Struck through (the Fonts panel's strikethrough). */
  strikethrough: boolean;
  /** The font family by name: one of `FONT_FAMILIES`, or the first family of the CSS. */
  family: string;
  /** The font size in points (CSS pixels). */
  size: number;
  /** The text colour as `#rrggbb`. */
  color: string;
  /** The colour behind the text as `#rrggbb`, or `"none"`. */
  highlight: string;
  /** The alignment of the paragraph. */
  align: RichTextAlignment;
}

/** The commands of the Format menu that act on rich text, and the two panels it opens. */
export type RichTextCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "bigger"
  | "smaller"
  | "align-left"
  | "align-center"
  | "align-justify"
  | "align-right"
  | "show-fonts"
  | "show-colors";

/**
 * The key equivalents of AppKit's Format menu (Font and Text submenus), for `MenuItem`'s
 * `keyEquivalent`. Strikethrough and Justify have none. `richTextKeyCommand` matches them.
 */
export const RICH_TEXT_KEY_EQUIVALENTS: Readonly<Partial<Record<RichTextCommand, string>>> = {
  "show-fonts": "command+t",
  bold: "command+b",
  italic: "command+i",
  underline: "command+u",
  bigger: "command++",
  smaller: "command+-",
  "show-colors": "shift+command+c",
  "align-left": "command+{",
  "align-center": "command+|",
  "align-right": "command+}",
};

export {
  FONT_COLLECTIONS,
  FONT_FAMILIES,
  FONT_SIZES,
  type FontFamily,
  type FontTypeface,
  findFontFamily,
} from "./font-families";

const isApple = () =>
  typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);

/**
 * The rich-text command whose key equivalent a `keydown` is, or `undefined`. Command is the Meta
 * key on Apple platforms and Control elsewhere, as for every menu of the library. The keys of
 * Bigger and the alignments are typed with Shift on most layouts (`+`, `{`, `|`, `}`), so Shift
 * is not asked of them, and Command-= is Bigger as in AppKit.
 */
export function richTextKeyCommand(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
): RichTextCommand | undefined {
  const apple = isApple();
  const command = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!command || event.altKey) return undefined;
  const key = event.key.toLowerCase();
  if (event.shiftKey) {
    if (key === "c") return "show-colors";
  } else {
    const plain: Record<string, RichTextCommand> = {
      b: "bold",
      i: "italic",
      u: "underline",
      t: "show-fonts",
      "-": "smaller",
    };
    if (plain[key]) return plain[key];
  }
  const either: Record<string, RichTextCommand> = {
    "+": "bigger",
    "=": "bigger",
    "{": "align-left",
    "|": "align-center",
    "}": "align-right",
  };
  return either[key];
}

/** `rgb()` or `rgba()` as `#rrggbb`; `#rrggbb` as it is; `undefined` for anything transparent. */
export function cssColorToHex(color: string): string | undefined {
  const parts =
    /^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+%?))?/.exec(
      color.trim(),
    );
  if (!parts) return /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim().toLowerCase() : undefined;
  const alpha = parts[4];
  if (alpha !== undefined && Number.parseFloat(alpha) === 0) return undefined;
  return `#${parts
    .slice(1, 4)
    .map((part) => Math.round(Number(part)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * The node that holds the first character of `range` in `root`, or for an insertion point the
 * character before it (whose style typing continues): the node whose format a format bar shows.
 * A range that starts at the end of a text node (WebKit leaves a selection so after a command)
 * starts with the next text in it. `null` when the range is not in `root`.
 */
export function richTextStartNode(root: HTMLElement, range: Range): Node | null {
  let node: Node = range.startContainer;
  let offset = range.startOffset;
  // An insertion point between two children of an element: the last text of the child before
  // it, as typing there continues that text; at the element's start, the first text after it.
  // A selection that starts there: the first text of the child after it.
  let last = false;
  if (node.nodeType === 1 && node.childNodes.length > 0) {
    last = range.collapsed && offset > 0;
    const at = last ? offset - 1 : offset;
    node = node.childNodes[Math.min(at, node.childNodes.length - 1)] ?? node;
    offset = 0;
  }
  // An element: its first text in the range, however deep (Select All starts before the first
  // paragraph, whose first word may be in a <b>), or its last text for an insertion point after
  // it.
  if (node.nodeType === 1) {
    const walker = root.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let found: Node | null = null;
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.nodeValue || !(range.collapsed || range.intersectsNode(text))) continue;
      found = text;
      if (!last) break;
    }
    node = found ?? node;
  }
  if (!range.collapsed && node.nodeType === 3 && offset >= (node.nodeValue?.length ?? 0)) {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    walker.currentNode = node;
    for (let next = walker.nextNode(); next; next = walker.nextNode()) {
      if (next.nodeValue && range.intersectsNode(next)) {
        node = next;
        break;
      }
    }
  }
  return root.contains(node) ? node : null;
}

/** Whether the browser reports a toggling command as on at the selection. */
function commandState(document: Document, command: string): boolean | undefined {
  if (typeof document.queryCommandState !== "function") return undefined;
  try {
    return document.queryCommandState(command);
  } catch {
    return undefined;
  }
}

const ALIGNMENTS: Record<string, RichTextAlignment> = {
  left: "left",
  start: "left",
  "-webkit-left": "left",
  "-moz-left": "left",
  center: "center",
  "-webkit-center": "center",
  "-moz-center": "center",
  right: "right",
  "-webkit-right": "right",
  "-moz-right": "right",
  end: "right",
  justify: "justify",
};

/** Bold, italic, underline and strikethrough of the text in `element`, read from its styles. */
function togglesOf(
  root: HTMLElement,
  element: Element,
): Pick<RichTextFormat, "bold" | "italic" | "underline" | "strikethrough"> {
  const view = root.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  const weightOf = (of: CSSStyleDeclaration | undefined) =>
    WEIGHTS[of?.fontWeight ?? ""] ?? Number.parseInt(of?.fontWeight ?? "", 10);
  const slanted = (of: CSSStyleDeclaration | undefined) =>
    /italic|oblique/.test(of?.fontStyle ?? "");
  let underline = false;
  let strikethrough = false;
  // The computed weight and slant tell, also where a descendant of <b> or <i> sets them back.
  // Only where there is no computed value at all (a test's DOM computes none for an element
  // nothing styles) does the name of a <b> or <i> around the text say it.
  const computedWeight = Boolean(style?.fontWeight);
  const computedSlant = Boolean(style?.fontStyle);
  let bold = weightOf(style) >= 600;
  let italic = slanted(style);
  for (let at: Element | null = element; at && at !== root && root.contains(at); ) {
    const own = view?.getComputedStyle(at);
    // Decorations belong to the element that sets them; they are not inherited.
    const line = `${own?.textDecorationLine ?? ""} ${own?.textDecoration ?? ""} ${at.tagName}`;
    if (/underline|\bU$/i.test(line)) underline = true;
    if (/line-through|\b(S|STRIKE|DEL)$/i.test(line)) strikethrough = true;
    if (!computedWeight && /^(B|STRONG)$/.test(at.tagName)) bold = true;
    if (!computedSlant && /^(I|EM)$/.test(at.tagName)) italic = true;
    at = at.parentElement;
  }
  return { bold, italic, underline, strikethrough };
}

/**
 * Whether every character of `range`, and whether any, has a style: what decides how a style is
 * set on a selection. White space between words is not counted where the selection holds
 * words, as its style cannot be seen; a selection of white space alone is judged by it. `null`
 * for a range that holds no character.
 */
function coverage(
  root: HTMLElement,
  range: Range,
  style: keyof ReturnType<typeof togglesOf>,
): { all: boolean; some: boolean } | null {
  let all = true;
  let some = false;
  let any = false;
  // The characters that show; a selection of white space alone is judged by that.
  const visible = /\S/.test(range.toString());
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if ((visible && !/\S/.test(text.data)) || !text.length || !range.intersectsNode(text)) {
      continue;
    }
    // A range that only touches a node at its edge holds none of its characters.
    if (text === range.startContainer && range.startOffset >= text.length) continue;
    if (text === range.endContainer && range.endOffset === 0) continue;
    const on = togglesOf(root, text.parentElement ?? root)[style];
    any = true;
    all &&= on;
    some ||= on;
  }
  return any ? { all, some } : null;
}

/**
 * Set or clear a style on the whole selection in `root`, as AppKit's Bold, Italic and Underline
 * do: a selection of characters that has the style only in part gets it everywhere, or loses it
 * everywhere. The browsers' commands toggle, from on everywhere to off and otherwise to on, so a
 * selection that has the style in part and must lose it is toggled twice. At an insertion point
 * the style is for what is typed next. Returns whether the browser took the commands it was
 * given; an environment without editing commands (a test's DOM) takes none.
 */
export function setRichTextStyle(
  root: HTMLElement,
  style: "bold" | "italic" | "underline" | "strikethrough",
  on: boolean,
): boolean {
  const document = root.ownerDocument;
  const selection = document.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (!range || !root.contains(range.commonAncestorContainer)) return false;
  const command = COMMANDS[style];
  if (range.collapsed) {
    return readRichTextFormat(root)[style] === on || run(document, command);
  }
  const has = coverage(root, range, style) ?? { all: false, some: false };
  if (on) return has.all || run(document, command);
  if (has.all) return run(document, command);
  return !has.some || (run(document, command) && run(document, command));
}

const COMMANDS = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikethrough: "strikeThrough",
} as const;

/**
 * The format of the text where the insertion point is in `root`, or of the first character of
 * the selection, as a format bar and the Fonts panel show it; with `range`, of the first
 * character of that range (a selection kept while a control has the focus). Without a selection
 * in `root` it is the format of `root` itself. At an insertion point the browser can tell a style
 * the next typed character takes (Command-B with nothing selected), and that is reported; a
 * selection of characters is read from the styles of its first character alone, as AppKit
 * does, whatever the rest of it holds.
 */
export function readRichTextFormat(root: HTMLElement, range?: Range | null): RichTextFormat {
  const document = root.ownerDocument;
  const view = document.defaultView;
  const selection = document.getSelection();
  const current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const read = range ?? current;
  const node = read ? richTextStartNode(root, read) : null;
  const element = node ? (node instanceof Element ? node : (node.parentElement ?? root)) : root;
  const style = view?.getComputedStyle(element);
  const toggles = togglesOf(root, element);
  // The highlight belongs to the element that sets it; it is not inherited.
  let highlight = "none";
  // The alignment is inherited, so the element's own computed value tells it; an environment
  // that does not inherit it (a test's DOM) is read from the paragraph that sets it.
  let align = ALIGNMENTS[style?.textAlign ?? ""];
  for (let at: Element | null = element; at && at !== root && root.contains(at); ) {
    const own = view?.getComputedStyle(at);
    if (highlight === "none") highlight = cssColorToHex(own?.backgroundColor ?? "") ?? "none";
    align ??= ALIGNMENTS[(at as HTMLElement).style?.textAlign || (at.getAttribute("align") ?? "")];
    at = at.parentElement;
  }
  const first = (style?.fontFamily ?? "").split(",")[0]?.replace(/["']/g, "").trim() ?? "";
  const size = Number.parseFloat(style?.fontSize ?? "");
  // The browser's answer covers a style set for the next character typed, at the document's own
  // insertion point only: it answers for wherever the selection is, and for a selection of
  // characters it answers for all of them, not the first.
  const caret = node !== null && read === current && read?.collapsed === true;
  const asked = (command: string) => (caret ? commandState(document, command) : undefined);
  return {
    bold: asked("bold") ?? toggles.bold,
    italic: asked("italic") ?? toggles.italic,
    underline: asked("underline") ?? toggles.underline,
    strikethrough: asked("strikeThrough") ?? toggles.strikethrough,
    family: findFontFamily(first)?.name ?? first,
    size: size > 0 ? Math.round(size * 10) / 10 : 12,
    color: cssColorToHex(style?.color ?? "") ?? "#000000",
    highlight,
    align: align ?? "left",
  };
}

/** The weights CSS names, as numbers. */
const WEIGHTS: Record<string, number> = { normal: 400, bold: 700, bolder: 700, lighter: 300 };

/** Run one of the browser's editing commands, writing CSS. False where there are none. */
function run(document: Document, command: string, value?: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  document.execCommand("styleWithCSS", false, "true");
  return document.execCommand(command, false, value);
}

/**
 * Give the selected text in `root` a font size in points, any size: the browsers' own command
 * knows seven. The selection is given the largest of those by that command, a step of the
 * browser's undo history, and the elements it made for it are given the real size; the text
 * stays selected. Undo takes those elements away again whatever size they were given, and redo
 * puts back the same elements, with the size.
 *
 * At an insertion point nothing is changed and false is returned: the browsers cannot keep a
 * size of any number of points for what is typed next (AppKit's typing attributes), so a size
 * is given to text that is selected. Returns false too in an environment without editing
 * commands (a test's DOM).
 */
export function setRichTextSize(root: HTMLElement, size: number): boolean {
  const document = root.ownerDocument;
  if (typeof document.execCommand !== "function") return false;
  const selection = document.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (!selection || !range || range.collapsed) return false;
  if (!root.contains(range.commonAncestorContainer)) return false;
  // An element of that largest size the text held before is first given the size it is drawn
  // at as CSS, so it looks as it did: what the command marks is then only what it made now,
  // also for selected text that was inside such an element.
  const view = document.defaultView;
  for (const element of root.querySelectorAll<HTMLElement>('font[size="7"]')) {
    const drawn = view?.getComputedStyle(element).fontSize;
    element.removeAttribute("size");
    if (drawn) element.style.fontSize = drawn;
  }
  document.execCommand("styleWithCSS", false, "false");
  const done = document.execCommand("fontSize", false, "7");
  const after = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  for (const marked of root.querySelectorAll<HTMLElement>('font[size="7"]')) {
    if (after && !after.intersectsNode(marked)) continue;
    marked.removeAttribute("size");
    marked.style.fontSize = `${size}px`;
  }
  return done;
}

const TOGGLES = [
  ["bold", "bold"],
  ["italic", "italic"],
  ["underline", "underline"],
  ["strikethrough", "strikeThrough"],
] as const;
const JUSTIFY: Record<RichTextAlignment, string> = {
  left: "justifyLeft",
  center: "justifyCenter",
  right: "justifyRight",
  justify: "justifyFull",
};

/**
 * Apply a change of format to the selection in `root`: the styles that differ from the format
 * at the selection are toggled, a family, size or colour is set, and an alignment is given to
 * the paragraphs the selection touches. The selection must be wholly in `root` (see
 * `keepRichTextSelection`); when it is not, nothing is done and false is returned, so that no
 * other editor's text is changed. Otherwise returns whether the browser took every command; an
 * environment without editing commands (a test's DOM) takes none. Dispatch `input` afterwards,
 * or read the editor, to save the change.
 */
export function applyRichTextFormat(root: HTMLElement, change: Partial<RichTextFormat>): boolean {
  const document = root.ownerDocument;
  const selection = document.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (!range || !root.contains(range.commonAncestorContainer)) return false;
  let done = true;
  for (const [key] of TOGGLES) {
    const wanted = change[key];
    if (wanted !== undefined) done = setRichTextStyle(root, key, wanted) && done;
  }
  if (change.family !== undefined) {
    done = run(document, "fontName", findFontFamily(change.family)?.css ?? change.family) && done;
  }
  if (change.size !== undefined && change.size > 0)
    done = setRichTextSize(root, change.size) && done;
  if (change.color !== undefined) done = run(document, "foreColor", change.color) && done;
  if (change.highlight !== undefined) {
    const color = change.highlight === "none" ? "transparent" : change.highlight;
    // Firefox knows the command as hiliteColor only; the others take it too.
    done = run(document, "hiliteColor", color) && done;
  }
  if (change.align !== undefined) done = run(document, JUSTIFY[change.align]) && done;
  return done;
}

/**
 * Run a command of the Format menu on the selection in `root`. Bigger and Smaller change the
 * size at the selection by one point, as AppKit's do. `show-fonts` and `show-colors` open
 * panels, which is the application's business: they do nothing here and return false.
 */
export function runRichTextCommand(root: HTMLElement, command: RichTextCommand): boolean {
  const format = readRichTextFormat(root);
  switch (command) {
    case "bold":
    case "italic":
    case "underline":
    case "strikethrough":
      return applyRichTextFormat(root, { [command]: !format[command] } as Partial<RichTextFormat>);
    case "bigger":
      return applyRichTextFormat(root, { size: Math.min(format.size + 1, 999) });
    case "smaller":
      return applyRichTextFormat(root, { size: Math.max(format.size - 1, 1) });
    case "align-left":
    case "align-center":
    case "align-right":
    case "align-justify":
      return applyRichTextFormat(root, {
        align: command.slice("align-".length) as RichTextAlignment,
      });
    default:
      return false;
  }
}

/** What `keepRichTextSelection` returns. */
export interface RichTextSelectionKeeper {
  /**
   * Give `root` the keyboard and the selection it last had: the caret at the end of its text
   * when it never had one, or when what it held was removed. Returns the range now selected.
   */
  restore(): Range;
  /** Stop following the selection. */
  dispose(): void;
}

/**
 * Follow the selection while it is in `root`, so that a command chosen from a menu, a toolbar
 * or a panel (which take the focus, and may take the selection) acts where the person was
 * typing. Call `restore()` before running a command, and `dispose()` when `root` goes.
 */
export function keepRichTextSelection(root: HTMLElement): RichTextSelectionKeeper {
  const document = root.ownerDocument;
  let kept: Range | null = null;
  const follow = () => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (root.contains(range.commonAncestorContainer)) kept = range.cloneRange();
  };
  follow();
  document.addEventListener("selectionchange", follow);
  return {
    restore() {
      // The selection as it is now, when it is still in the editor. "selectionchange" is
      // dispatched later, as a task of its own: right after a command has changed the text,
      // the range kept before it may have collapsed with the nodes the command moved, while the
      // browser already selects what the command made. A command that runs before that event
      // (a second click in the Fonts panel straight after the first) acts on that selection.
      follow();
      if (document.activeElement !== root) root.focus({ preventScroll: true });
      let range = kept;
      if (!range || !root.contains(range.commonAncestorContainer)) {
        range = document.createRange();
        range.selectNodeContents(root);
        range.collapse(false);
      }
      const selection = document.getSelection();
      if (selection) {
        const current = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        const same =
          current &&
          current.startContainer === range.startContainer &&
          current.startOffset === range.startOffset &&
          current.endContainer === range.endContainer &&
          current.endOffset === range.endOffset;
        if (!same) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      kept = range.cloneRange();
      return range;
    },
    dispose() {
      document.removeEventListener("selectionchange", follow);
    },
  };
}

/** The elements kept from stored rich text: those the editing commands and line breaks make. */
const KEPT = new Set(
  "DIV P BR SPAN FONT B I U S STRIKE STRONG EM SUB SUP UL OL LI BLOCKQUOTE PRE H1 H2 H3 H4 H5 H6".split(
    " ",
  ),
);
/** Elements dropped with everything in them; any other element is replaced by its content. */
const DROPPED = new Set(
  "SCRIPT STYLE TEMPLATE NOSCRIPT IFRAME OBJECT EMBED SVG MATH TITLE HEAD LINK META IMG PICTURE VIDEO AUDIO CANVAS FORM INPUT TEXTAREA SELECT BUTTON".split(
    " ",
  ),
);
/** The style properties kept: those the commands of this module write. */
const STYLES = [
  "text-align",
  "line-height",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "color",
  "background-color",
] as const;
/** The attributes kept, each with the values it may have. */
const ATTRIBUTES: Record<string, RegExp> = {
  color: /^#?[0-9a-z]{1,20}$/i,
  face: /^[\w ,'"-]{1,200}$/,
  size: /^[1-7]$/,
  align: /^(left|right|center|justify)$/i,
};

/** What else `richTextFromHtml` may keep. */
export interface RichTextHtmlOptions {
  /** More elements to keep, by tag name (`"TABLE"`). */
  elements?: Iterable<string>;
  /** More attributes to keep, each with the values it may have (`{ "data-list": /^\w+$/ }`). */
  attributes?: Record<string, RegExp>;
  /** More style properties to keep, with values as plain as the rest (`"letter-spacing"`). */
  styles?: Iterable<string>;
}

/**
 * Whether a style value is one that saved rich text can keep: plain ASCII, and no function but
 * `rgb()` and `rgba()`, so a colour a browser wrote as `color(srgb ...)` or `oklch(...)` from pasted
 * text goes, and with it any address or expression.
 */
function plainStyleValue(value: string): boolean {
  if (/[<>\\]|javascript:|[^\p{ASCII}]/iu.test(value)) return false;
  return [...value.matchAll(/([a-z-]*)\s*\(/gi)].every(([, name]) => /^rgba?$/i.test(name ?? ""));
}

/**
 * Stored rich text (`root.innerHTML` as it was saved) as nodes of `target`, rebuilt from the
 * elements, styles and attributes that formatting writes and nothing else: no script, handler,
 * link, picture or other address survives, whatever the stored text holds. It is parsed into
 * a `template`, whose content belongs to an inert document: nothing in it runs or loads.
 */
export function richTextFromHtml(
  html: string,
  target: Document,
  options: RichTextHtmlOptions = {},
): DocumentFragment {
  const kept = new Set([...KEPT, ...[...(options.elements ?? [])].map((tag) => tag.toUpperCase())]);
  const attributes = { ...ATTRIBUTES, ...options.attributes };
  const styles = [...STYLES, ...(options.styles ?? [])];
  const template = target.createElement("template");
  template.innerHTML = html;
  const out = target.createDocumentFragment();
  const copy = (from: Node, into: Node) => {
    for (const child of from.childNodes) {
      if (child.nodeType === 3) {
        into.appendChild(target.createTextNode(child.nodeValue ?? ""));
        continue;
      }
      if (child.nodeType !== 1) continue;
      const element = child as HTMLElement;
      const tag = element.tagName.toUpperCase();
      if (DROPPED.has(tag)) continue;
      if (!kept.has(tag)) {
        copy(element, into);
        continue;
      }
      const made = target.createElement(tag.toLowerCase());
      for (const property of styles) {
        const value = element.style?.getPropertyValue(property) ?? "";
        if (value && plainStyleValue(value)) {
          made.style.setProperty(property, value);
        }
      }
      for (const [name, allowed] of Object.entries(attributes)) {
        const value = element.getAttribute(name);
        if (value !== null && allowed.test(value)) made.setAttribute(name, value);
      }
      copy(element, made);
      into.appendChild(made);
    }
  };
  copy(template.content, out);
  return out;
}

/** How many views keep typing runs: the shared listeners are installed for the first and removed after the last. */
let typingRunViews = 0;

/** Whether a press of the pointer in an editable view has ended the typing run, to be marked at the next typing key. */
let typingRunEnded = false;

const EDITABLE = '[contenteditable]:not([contenteditable="false"])';

/** A press of the pointer inside an editable view ends the run; a press elsewhere (a menu, a toolbar) does not. */
function onTypingRunPress(event: Event) {
  const target = event.target;
  if (target instanceof Element && target.closest(EDITABLE)) typingRunEnded = true;
}

/**
 * At the first typing key after the run ended: when the insertion point is collapsed at the end of a text node in an
 * editable view (and not in a table), it moves into a new empty text node just after that node, so the text typed
 * now is a new Undo step.
 */
function onTypingRunKey(event: KeyboardEvent) {
  if (!typingRunEnded || event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
    return;
  if (event.key.length !== 1 && event.key !== "Enter") return;
  typingRunEnded = false;
  const selection = document.getSelection();
  const node = selection?.anchorNode;
  if (!selection?.isCollapsed || !(node instanceof Text) || selection.anchorOffset !== node.length)
    return;
  if (!node.parentElement?.closest(EDITABLE) || node.parentElement.closest("table")) return;
  const fresh = node.ownerDocument.createTextNode("");
  node.after(fresh);
  selection.collapse(fresh, 0);
}

/**
 * Typing runs as Undo steps, in every engine, as in macOS: a press of the pointer in an editable view ends the run of
 * typing, so one Undo takes only the text typed since. Firefox otherwise joins every run that starts where the last one
 * ended into one Undo step (a click there, a click elsewhere and back, or focus leaving and returning do not end it),
 * and one Undo can take a whole note, its title included. At the next typing key the insertion point, wherever the
 * keyboard has taken it, is moved into a new empty text node after the run's text node: only at the end of a text
 * node, since a split inside one would move text that earlier Undo steps refer to, and never in a table, whose Undo
 * the editors handle themselves. The views' history stays the browser's own, so Undo and Redo keep every route they
 * have. Returns the cleanup.
 */
export function keepTypingRuns(): () => void {
  if (typingRunViews++ === 0) {
    document.addEventListener("pointerup", onTypingRunPress, true);
    document.addEventListener("keydown", onTypingRunKey, true);
  }
  return () => {
    if (--typingRunViews === 0) {
      document.removeEventListener("pointerup", onTypingRunPress, true);
      document.removeEventListener("keydown", onTypingRunKey, true);
      typingRunEnded = false;
    }
  };
}
