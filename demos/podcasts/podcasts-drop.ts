import { feedAddress } from "./podcasts-add-show";

/**
 * The queue with `item` before the entry `before`, or at the end when `before` is null. An entry
 * already queued moves; a new one that does not fit answers the queue unchanged.
 */
export function movedInQueue<T extends { id: string }>(
  queue: readonly T[],
  item: T,
  before: string | null,
  limit: number,
): readonly T[] {
  if (item.id === before) return queue;
  const others = queue.filter((each) => each.id !== item.id);
  if (others.length >= limit) return queue;
  const at = before === null ? -1 : others.findIndex((each) => each.id === before);
  return at < 0 ? [...others, item] : [...others.slice(0, at), item, ...others.slice(at)];
}

/** The feed a drag's data names: the first address of its link list or of its text, if any. */
export function droppedFeed(uriList: string, plain: string): string | undefined {
  for (const text of [uriList, plain]) {
    const line = text
      .split(/\r?\n/)
      .map((each) => each.trim())
      .find((each) => each !== "" && !each.startsWith("#"));
    if (line && /^https?:\/\/\S+$/i.test(line)) return feedAddress(line);
  }
  return undefined;
}
