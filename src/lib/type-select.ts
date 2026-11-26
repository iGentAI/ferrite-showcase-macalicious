// The text typed so far and when its last character arrived. Keep one per view, in a ref.
export interface TypeSelectState {
  text: string;
  time: number;
}

// A pause this long (ms) starts a new search.
const PAUSE = 1000;

// Type-select, as in AppKit's lists: typing a few characters moves to the first item whose
// label starts with them.
//
//   const typed = useRef<TypeSelectState>({ text: "", time: 0 });
//   const index = typeSelect(typed.current, event, count, (i) => labels[i], current);
//   if (index >= 0) moveTo(index);
//
// Returns the index of the match, or -1 when the key is not a character (or is typed with
// Command, Control or Option) or nothing matches. The search starts at `from` and wraps;
// repeating one letter steps through the items that start with it.
export function typeSelect(
  state: TypeSelectState,
  event: { key: string; timeStamp: number; metaKey: boolean; ctrlKey: boolean; altKey: boolean },
  count: number,
  labelAt: (index: number) => string,
  from: number,
): number {
  if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return -1;
  const key = event.key.toLowerCase();
  const fresh = event.timeStamp - state.time > PAUSE || (key === " " && !state.text);
  if (fresh && key === " ") return -1;
  const stepping = !fresh && state.text === key;
  state.text = fresh || stepping ? key : state.text + key;
  state.time = event.timeStamp;
  // A fresh search may stay on the current item; stepping moves on from it.
  const first = Math.max(0, from) + (stepping ? 1 : 0);
  for (let step = 0; step < count; step++) {
    const index = (first + step) % count;
    if (labelAt(index).toLowerCase().startsWith(state.text)) return index;
  }
  return -1;
}
