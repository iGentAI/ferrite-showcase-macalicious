import { useEffect, useReducer, useRef } from "react";
import type { VoiceMemoFile, VoiceMemosDeleted } from "./voice-memos-drive";
import { type ClearDeleted, clearedAt } from "./voice-memos-preferences";

/** The longest delay a browser's timer takes, in milliseconds: it then looks again. */
const LONGEST_TIMER = 0x7fffffff;

/**
 * Clear Deleted: what has been in Recently Deleted as long as it is kept leaves the store, at its
 * time, for as long as the window is open and `enabled`. One that fails is tried again the next time
 * the list or the time comes round.
 */
export function useClearDeleted(
  store: VoiceMemosDeleted | undefined,
  deleted: readonly VoiceMemoFile[],
  clearDeleted: ClearDeleted,
  enabled: boolean,
) {
  const [tick, wake] = useReducer((count: number) => count + 1, 0);
  const clearing = useRef(new Set<string>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` is the time coming round, which reads the clock again.
  useEffect(() => {
    if (!store || !enabled) return;
    const now = Date.now();
    let next = Number.POSITIVE_INFINITY;
    for (const memo of deleted) {
      if (clearing.current.has(memo.id) || memo.deleted === undefined) continue;
      const at = clearedAt(clearDeleted, memo.deleted);
      if (at === null) continue;
      if (at > now) {
        next = Math.min(next, at);
        continue;
      }
      clearing.current.add(memo.id);
      store.erase(memo.id).catch(() => clearing.current.delete(memo.id));
    }
    if (next === Number.POSITIVE_INFINITY) return;
    const timer = setTimeout(wake, Math.min(next - now, LONGEST_TIMER));
    return () => clearTimeout(timer);
  }, [store, deleted, clearDeleted, enabled, tick]);
}
