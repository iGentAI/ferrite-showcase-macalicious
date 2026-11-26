/**
 * Keyboard's text replacements, as they work on the served desktop: a word followed by a space or
 * punctuation becomes its replacement in any text field or editable text, and one undo takes it back.
 * A password field and text that turns spelling off, such as Terminal's, are left alone. An app with
 * its own Text Replacement setting says on `data-text-replacement`, which decides whatever its spelling
 * setting is.
 */
const OWN_SETTING = "[data-text-replacement]";
const leftAlone = (element: Element | null | undefined) => {
  const own = element?.closest<HTMLElement>(OWN_SETTING);
  if (own) return own.dataset.textReplacement === "off";
  return element?.closest('[spellcheck="false"]') != null;
};
export const REPLACEMENTS_KEY = "keyboard.replacements";

export interface TextReplacement {
  replace: string;
  with: string;
}

export const DEFAULT_REPLACEMENTS: readonly TextReplacement[] = [
  { replace: "omw", with: "On my way!" },
];

export function readReplacements(value: unknown): readonly TextReplacement[] {
  if (!Array.isArray(value)) return DEFAULT_REPLACEMENTS;
  return value.filter(
    (each): each is TextReplacement =>
      typeof each?.replace === "string" && each.replace !== "" && typeof each.with === "string",
  );
}

/** The rule whose word ends `text`, standing on its own. */
export function replacementAt(
  text: string,
  rules: readonly TextReplacement[],
): TextReplacement | undefined {
  return rules.find(({ replace }) => {
    if (!text.endsWith(replace)) return false;
    const before = Array.from(text.slice(0, text.length - replace.length)).at(-1);
    return before === undefined || !/[\p{L}\p{M}\p{N}_]/u.test(before);
  });
}

const ENDS_A_WORD = /^[\s\p{P}]$/u;
/** Addresses are not words to correct, and an email field has no selection to replace. */
const TEXT_INPUTS = new Set(["", "text", "search"]);

let rules: readonly TextReplacement[] = [];

function replaceIn(target: HTMLInputElement | HTMLTextAreaElement, typed: string) {
  const end = target.selectionStart;
  if (end === null || end !== target.selectionEnd) return;
  const rule = replacementAt(target.value.slice(0, end - typed.length), rules);
  if (!rule) return;
  target.setSelectionRange(end - typed.length - rule.replace.length, end);
  document.execCommand("insertText", false, rule.with + typed);
}

/** The elements that only style the text inside them. A word can run across these and nothing else. */
const STYLES_TEXT =
  "a, abbr, b, bdi, bdo, big, cite, code, del, dfn, em, font, i, ins, kbd, mark, q, s, samp, small, span, strike, strong, sub, sup, tt, u, var";

/** Whether an element ends the line of text around it: anything but styled text that is editable and inline. */
function endsLine(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return node instanceof Element;
  if (!node.matches(STYLES_TEXT) || !node.isContentEditable) return true;
  const { display } = getComputedStyle(node);
  return !display.startsWith("inline") && display !== "contents";
}

/** The text nodes of the line before `node`, whatever styles divide them, nearest first. */
function textBefore(host: HTMLElement, node: Text): Text[] {
  const found: Text[] = [];
  /** Takes in `each` and returns whether the line goes on before it. */
  const take = (each: Node): boolean => {
    if (each instanceof Text) found.push(each);
    else if (endsLine(each)) return false;
    else {
      for (let child = each.lastChild; child; child = child.previousSibling) {
        if (!take(child)) return false;
      }
    }
    return true;
  };
  let here: Node = node;
  while (true) {
    for (let before = here.previousSibling; before; before = before.previousSibling) {
      if (!take(before)) return found;
    }
    const parent: Node | null = here.parentNode;
    if (!parent || parent === host || endsLine(parent)) return found;
    here = parent;
  }
}

/**
 * In rich text the word is read from the line the caret is on, so styles dividing it or the line
 * before it make no difference. The replacement takes the style at the word's first letter.
 */
function replaceInEditable(host: HTMLElement, typed: string) {
  const selection = document.getSelection();
  const node = selection?.focusNode;
  if (!selection?.isCollapsed || !(node instanceof Text)) return;
  if (leftAlone(node.parentElement)) return;
  const end = selection.focusOffset;
  const before = textBefore(host, node);
  const line = before.reduceRight((text, each) => text + each.data, "");
  const rule = replacementAt(line + node.data.slice(0, end - typed.length), rules);
  if (!rule) return;
  const range = document.createRange();
  range.setEnd(node, end);
  let start = end - typed.length - rule.replace.length;
  let first: Text = node;
  for (const each of before) {
    if (start >= 0) break;
    first = each;
    start += each.data.length;
  }
  range.setStart(first, start);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("insertText", false, rule.with + typed);
}

function onInput(event: Event) {
  if (!(event instanceof InputEvent) || event.inputType !== "insertText" || event.isComposing)
    return;
  const typed = event.data;
  const { target } = event;
  if (!typed || !ENDS_A_WORD.test(typed) || !(target instanceof HTMLElement)) return;
  if (leftAlone(target)) return;
  if (target instanceof HTMLTextAreaElement) replaceIn(target, typed);
  else if (target instanceof HTMLInputElement) {
    if (TEXT_INPUTS.has(target.getAttribute("type") ?? "")) replaceIn(target, typed);
  } else if (target.isContentEditable) replaceInEditable(target, typed);
}

let listening = false;

/** Follow what the settings say. */
export function followReplacements(values: Readonly<Record<string, unknown>>): void {
  rules = readReplacements(values[REPLACEMENTS_KEY]);
  if (listening) return;
  listening = true;
  document.addEventListener("input", onInput, true);
}

/** Stop, when the person's session ends. */
export function clearReplacements(): void {
  rules = [];
  listening = false;
  document.removeEventListener("input", onInput, true);
}
