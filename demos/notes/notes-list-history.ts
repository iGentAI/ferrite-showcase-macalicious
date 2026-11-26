/*
 * Undo and Redo of a list's kind. A dashed list and a checklist differ from a bulleted one only by a
 * class, which the browser's history does not hold: Chromium's own Undo brings a list back without
 * it, and a change between two bulleted kinds is no step of its history at all. So the kinds are
 * kept here by the shape of the note's text, and those changes are steps of their own.
 */

type Kinds = readonly (string | null)[];

interface KindStep {
  shape: string;
  before: Kinds;
  after: Kinds;
}

export interface ListKindHistory {
  /** Remember the kinds as they stand now. */
  note: () => void;
  /** The lists' kinds as they stand now. */
  kinds: () => Kinds;
  /** A change of kind the browser's history does not hold, from `before` to what stands now. */
  changed: (before: Kinds) => void;
  /** Undo or Redo such a change, when it is the newest: whether there was one. */
  take: (way: "undo" | "redo") => boolean;
}

const lists = (root: ParentNode) => [...root.querySelectorAll("ul")];
const kindsOf = (editor: HTMLElement): Kinds =>
  lists(editor).map((list) => list.getAttribute("class"));
const setKinds = (editor: HTMLElement, kinds: Kinds) => {
  lists(editor).forEach((list, at) => {
    const kind = kinds[at];
    if (kind) list.setAttribute("class", kind);
    else list.removeAttribute("class");
  });
};
const shapeOf = (editor: HTMLElement) => {
  const copy = editor.cloneNode(true) as HTMLElement;
  for (const list of lists(copy)) list.removeAttribute("class");
  return copy.innerHTML;
};
const same = (a: Kinds, b: Kinds) => a.length === b.length && a.every((kind, at) => kind === b[at]);

const histories = new WeakMap<HTMLElement, ListKindHistory>();

/** The editor's history of list kinds, listening to the browser's Undo and Redo from now on. */
export function listKindHistory(editor: HTMLElement): ListKindHistory {
  const existing = histories.get(editor);
  if (existing) return existing;
  const known = new Map<string, Kinds>();
  const undone: KindStep[] = [];
  const redone: KindStep[] = [];
  const history: ListKindHistory = {
    note: () => {
      known.set(shapeOf(editor), kindsOf(editor));
    },
    kinds: () => kindsOf(editor),
    changed: (before) => {
      undone.push({ shape: shapeOf(editor), before, after: kindsOf(editor) });
      redone.length = 0;
      history.note();
    },
    take: (way) => {
      const [from, to] = way === "undo" ? [undone, redone] : [redone, undone];
      const step = from.at(-1);
      const [leaving, wanted] =
        way === "undo" ? [step?.after, step?.before] : [step?.before, step?.after];
      if (
        !step ||
        !leaving ||
        !wanted ||
        step.shape !== shapeOf(editor) ||
        !same(leaving, kindsOf(editor))
      ) {
        return false;
      }
      from.pop();
      to.push(step);
      setKinds(editor, wanted);
      history.note();
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "historyUndo" }));
      return true;
    },
  };
  const isHistory = (type: string) => type === "historyUndo" || type === "historyRedo";
  editor.addEventListener("beforeinput", (event) => {
    if (!isHistory(event.inputType)) return;
    if (history.take(event.inputType === "historyUndo" ? "undo" : "redo")) event.preventDefault();
  });
  editor.addEventListener("input", (event) => {
    if (!isHistory((event as InputEvent).inputType)) return;
    const kinds = known.get(shapeOf(editor));
    if (kinds) setKinds(editor, kinds);
  });
  histories.set(editor, history);
  return history;
}
