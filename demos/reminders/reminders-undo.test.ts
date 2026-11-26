import { describe, expect, it } from "vitest";
import type { Reminder, ReminderList } from "./reminders-data";
import { NO_HISTORY, type RemindersState, recordChange, travelTo } from "./reminders-undo";

const list: ReminderList = { id: "l", name: "L", color: "blue" };
const note = (id: string, title = id): Reminder => ({ id, listId: "l", title });
const state = (...reminders: Reminder[]): RemindersState => ({
  lists: [list],
  groups: [],
  reminders,
});

describe("Undo of a window's reminders", () => {
  it("goes back to the very order when nothing else happened", () => {
    const [a, b] = [note("a"), note("b")];
    const before = state(a, b);
    const after = state(b, a);
    expect(travelTo(after, before, state(b, a))).toBe(before);
  });

  it("after a document from elsewhere changes back only what the step changed", () => {
    const [a, b] = [note("a"), note("b")];
    const elsewhere = note("new");
    const before = state(a);
    const after = state(a, b);
    const back = travelTo(after, before, state(a, b, elsewhere));
    expect(back.reminders.map((each) => each.id)).toEqual(["a", "new"]);
  });

  it("brings back what the step removed, after what came in since", () => {
    const [a, b] = [note("a"), note("b")];
    const back = travelTo(state(a), state(a, b), state(a, note("new")));
    expect(back.reminders.map((each) => each.id)).toEqual(["a", "new", "b"]);
  });

  it("after a document from elsewhere leaves no sub-reminder under a sub-reminder", () => {
    const a = note("a");
    const b = note("b");
    const child = { ...note("child"), parentId: "b" };
    const movedB = { ...b, parentId: "a" };
    // The step took `child` away, and elsewhere `b` went under `a` meanwhile.
    const back = travelTo(state(a, b), state(a, b, child), state(a, movedB));
    expect(back.reminders.find((each) => each.id === "child")?.parentId).toBeUndefined();
    expect(back.reminders.find((each) => each.id === "b")?.parentId).toBe("a");
  });

  it("counts a run of changes with one key as one step, and a change clears what could be redone", () => {
    const one = state(note("a", "one"));
    const two = state(note("a", "two"));
    const three = state(note("a", "three"));
    const first = recordChange(NO_HISTORY, one, two, "a");
    const second = recordChange(first, two, three, "a");
    expect(second.past).toHaveLength(1);
    expect(second.past[0]?.before).toBe(one);
    expect(second.past[0]?.after).toBe(three);
    const plain = recordChange({ past: second.past, future: second.past }, three, one);
    expect(plain.past).toHaveLength(2);
    expect(plain.future).toHaveLength(0);
  });

  it("starts a new step when something came in from elsewhere between two changes of one key", () => {
    const one = state(note("a", "one"));
    const two = state(note("a", "two"));
    const adopted = state(note("a", "two"), note("b", "from elsewhere"));
    const three = state(note("a", "three"), note("b", "from elsewhere"));
    const steps = recordChange(recordChange(NO_HISTORY, one, two, "a"), adopted, three, "a");
    expect(steps.past).toHaveLength(2);
    expect(steps.past[1]?.before).toBe(adopted);
  });
});
