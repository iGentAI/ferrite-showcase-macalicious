import { flatOffset, flatText, normalWord } from "../desktop/text-spelling";

/*
 * Edit > Spelling and Grammar > Correct Spelling Automatically: a word just finished becomes what a
 * known misspelling stands for. The list decides, not a guess from the word list, so a name or a word
 * nobody listed stays as it was typed.
 */

/** Common typing mistakes, none a word itself: `textedit-corrections.test.ts` holds them to that. */
export const KNOWN_MISSPELLINGS: Readonly<Record<string, string>> = {
  abscence: "absence",
  accomodate: "accommodate",
  acheive: "achieve",
  acknowlege: "acknowledge",
  acquaintence: "acquaintance",
  adress: "address",
  agressive: "aggressive",
  alot: "a lot",
  apparantly: "apparently",
  appearence: "appearance",
  arguement: "argument",
  assasination: "assassination",
  basicly: "basically",
  becuase: "because",
  beggining: "beginning",
  beleive: "believe",
  bizzare: "bizarre",
  buisness: "business",
  calender: "calendar",
  catagory: "category",
  cemetary: "cemetery",
  changable: "changeable",
  collegue: "colleague",
  comming: "coming",
  commitee: "committee",
  completly: "completely",
  concious: "conscious",
  definately: "definitely",
  dissapear: "disappear",
  dissapoint: "disappoint",
  embarass: "embarrass",
  enviroment: "environment",
  existance: "existence",
  familar: "familiar",
  finaly: "finally",
  foriegn: "foreign",
  fourty: "forty",
  foward: "forward",
  freind: "friend",
  goverment: "government",
  gaurd: "guard",
  happend: "happened",
  harrass: "harass",
  hieght: "height",
  humerous: "humorous",
  immediatly: "immediately",
  independant: "independent",
  interupt: "interrupt",
  knowlege: "knowledge",
  liason: "liaison",
  libary: "library",
  lisence: "license",
  maintainance: "maintenance",
  millenium: "millennium",
  mispell: "misspell",
  neccessary: "necessary",
  necessery: "necessary",
  noticable: "noticeable",
  occured: "occurred",
  occurence: "occurrence",
  ocurred: "occurred",
  peice: "piece",
  persistant: "persistent",
  posession: "possession",
  prefered: "preferred",
  preceeding: "preceding",
  publically: "publicly",
  realy: "really",
  recieve: "receive",
  recomend: "recommend",
  refered: "referred",
  religous: "religious",
  remeber: "remember",
  rythm: "rhythm",
  seperate: "separate",
  sieze: "seize",
  similiar: "similar",
  sucess: "success",
  supercede: "supersede",
  suprise: "surprise",
  teh: "the",
  tommorow: "tomorrow",
  tounge: "tongue",
  truely: "truly",
  untill: "until",
  usefull: "useful",
  wich: "which",
  wierd: "weird",
  writting: "writing",
  yeild: "yield",
};

/**
 * What `word` should read, keeping a leading capital, or `undefined` when it stays as typed: it is
 * not listed, the person taught it or passed over it (`known`, in lower case), or its capitals are
 * neither none nor a leading one, as in an acronym.
 */
export function correctionOf(word: string, known: ReadonlySet<string>): string | undefined {
  const plain = normalWord(word);
  if (known.has(plain) || !Object.hasOwn(KNOWN_MISSPELLINGS, plain)) return undefined;
  const fixed = KNOWN_MISSPELLINGS[plain] ?? "";
  if (word === plain) return fixed;
  const first = word.charAt(0);
  return word === first + word.slice(1).toLowerCase() && first !== first.toLowerCase()
    ? first + fixed.slice(1)
    : undefined;
}

/** A character that ends a word as it is typed. A quote is not: Smart Quotes may be turning it. */
const ENDS_WORD = /^[\s.,;:!?)\]}]$/;

/** The word at the end of `text`, unless it is part of an address, a path or a compound. */
const LAST_WORD = /(?<![\p{L}\p{M}\p{N}'’@._/:\\-])\p{L}+$/u;

/** The rich view's text node and caret offset, for a caret in text. */
function caretNode(element: HTMLElement): { node: Text; offset: number } | undefined {
  const selection = element.ownerDocument.getSelection();
  const node = selection?.focusNode;
  return selection?.isCollapsed && node instanceof Text && element.contains(node)
    ? { node, offset: selection.focusOffset }
    : undefined;
}

/** After an Undo of a correction the browser selects what it put back: typing goes on after it instead. */
export function caretAfterSelection(element: HTMLElement): void {
  if (element instanceof HTMLTextAreaElement) {
    element.setSelectionRange(element.selectionEnd, element.selectionEnd);
  } else {
    element.ownerDocument.getSelection()?.collapseToEnd();
  }
}

/**
 * Corrects the word that `typed` has just ended in `element`, an editable text view: `typed` is the
 * character the browser reported, or `""` for Return, which runs before its line break goes in. The
 * browser's text command replaces the word and that character together, so the caret stays after them
 * and one Undo gives back what was typed. Whether the text changed.
 */
export function correctTypedWord(
  element: HTMLElement,
  typed: string,
  known: ReadonlySet<string>,
  curly: boolean,
): boolean {
  if (typed !== "" && !ENDS_WORD.test(typed)) return false;
  const inField = element instanceof HTMLTextAreaElement;
  const caret = inField ? undefined : caretNode(element);
  if (!inField && !caret) return false;
  if (inField && element.selectionStart !== element.selectionEnd) return false;
  const upTo = inField
    ? element.value.slice(0, element.selectionStart)
    : (caret?.node.data.slice(0, caret.offset) ?? "");
  const before = upTo.slice(0, upTo.length - typed.length);
  const word = LAST_WORD.exec(before)?.[0];
  if (!word) return false;
  const fixed = correctionOf(word, known);
  if (fixed === undefined) return false;
  const length = word.length + typed.length;
  const start = upTo.length - length;
  if (caret && start === 0) {
    // The word may go on from a run in another style, which this text node does not show.
    const flat = flatText(element);
    if (/[\p{L}\p{M}\p{N}'’-]$/u.test(flat.text.slice(0, flatOffset(flat, caret.node, 0)))) {
      return false;
    }
  }
  const text = (curly ? fixed.replace(/'/g, "’") : fixed) + typed;
  const target = element.ownerDocument;
  if (inField) {
    const end = element.selectionStart;
    element.setSelectionRange(start, end);
    if (target.execCommand("insertText", false, text)) return true;
    element.setSelectionRange(end, end);
    return false;
  }
  if (!caret) return false;
  const selection = target.getSelection();
  selection?.setBaseAndExtent(caret.node, start, caret.node, caret.offset);
  if (target.execCommand("insertText", false, text)) return true;
  selection?.collapse(caret.node, caret.offset);
  return false;
}
