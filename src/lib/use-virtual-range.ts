import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { observeResize } from "./observe-resize";

// Items rendered before a scrolling element has been measured (and on the server).
const UNMEASURED = 40;

/**
 * The size of the items: one size for all of them, or the offsets of items of different
 * sizes, `count + 1` of them, from the start of the first item (0) to the end of the last.
 */
export type ItemSizes = number | ArrayLike<number>;

/** The offsets of `count` items whose sizes `sizeOf` gives, for `useVirtualRange`. */
export function itemOffsets(count: number, sizeOf: (index: number) => number): Float64Array {
  const offsets = new Float64Array(count + 1);
  let end = 0;
  for (let index = 0; index < count; index++) {
    end += sizeOf(index);
    offsets[index + 1] = end;
  }
  return offsets;
}

/** Where the item at `index` starts. */
export function itemStart(sizes: ItemSizes, index: number): number {
  if (typeof sizes === "number") return index * sizes;
  return sizes[Math.max(0, Math.min(index, sizes.length - 1))] ?? 0;
}

/** The index of the item at `position`: the last one that starts there or before it. */
export function itemAt(sizes: ItemSizes, position: number): number {
  if (typeof sizes === "number") return Math.floor(position / sizes);
  let low = 0;
  let high = Math.max(0, sizes.length - 2);
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    // No `else` here: the bundler's source map gives that keyword no source, and the size
    // report charges code without a source to every component that uses this helper.
    if ((sizes[middle] ?? 0) <= position) {
      low = middle;
      continue;
    }
    high = middle - 1;
  }
  return low;
}

// Which of `count` items a scrolling element shows, for rendering only those.
//
//   const [start, end, viewport, onScroll] = useVirtualRange(rowCount, rowHeight);
//   <div ref={viewport} onScroll={onScroll} style={{ overflow: "auto" }}>
//     <div style={{ height: rowCount * rowHeight }}>   // keeps the scroll bar honest
//       rows start..end-1, each placed at index * rowHeight
//
// Items of different sizes are given as their offsets (`itemOffsets`), and placed at
// `itemStart(offsets, index)`. Keep the offsets' identity while the sizes do not change.
//
// `start` is inclusive and `end` exclusive; `overscan` items are added on each side so that
// a scroll shows rows before the next render. The component re-renders only when the range
// changes, not on every scroll event. `offset` is the distance from the top of the scrolling
// content to the first item (a sticky header's height). With `horizontal` the items run
// along the inline axis. Until the element is measured the first 40 items are rendered.
//
// `reveal(index)`, the fifth value, scrolls the item at `index` into view (below a sticky
// header) and renders it at once, for a view that must name an item that was out of view.
// It does nothing for a negative index, and nothing along the inline axis.
export function useVirtualRange(
  count: number,
  itemSize: ItemSizes,
  { overscan = 8, offset = 0, horizontal = false } = {},
): [
  number,
  number,
  (element: HTMLElement | null) => undefined | (() => void),
  () => void,
  (index: number) => void,
] {
  const [range, setRange] = useState<[number, number]>([0, UNMEASURED]);
  const element = useRef<HTMLElement | null>(null);
  const input = useRef({ itemSize, overscan, offset, horizontal });
  input.current = { itemSize, overscan, offset, horizontal };

  const measure = useCallback(() => {
    const target = element.current;
    const now = input.current;
    const sizes = now.itemSize;
    const length = target ? (now.horizontal ? target.clientWidth : target.clientHeight) : 0;
    if (!target || !length || (typeof sizes === "number" && !(sizes > 0))) return;
    const scrolled = Math.abs(now.horizontal ? target.scrollLeft : target.scrollTop) - now.offset;
    const start = Math.max(0, itemAt(sizes, scrolled) - now.overscan);
    const end =
      (typeof sizes === "number"
        ? Math.ceil((scrolled + length) / sizes)
        : itemAt(sizes, scrolled + length) + 1) + now.overscan;
    setRange((old) => (old[0] === start && old[1] === end ? old : [start, end]));
  }, []);

  // A new item size, offset, axis or count changes the range without a scroll or a resize:
  // measure again before the browser paints.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the inputs are read through a ref; they are listed to run the effect when one changes
  useLayoutEffect(measure, [measure, count, itemSize, overscan, offset, horizontal]);

  const ref = useCallback(
    (target: HTMLElement | null) => {
      element.current = target;
      if (!target) return undefined;
      measure();
      const stop = observeResize(target, measure);
      return () => {
        stop();
        element.current = null;
      };
    },
    [measure],
  );

  const reveal = useCallback(
    (index: number) => {
      const target = element.current;
      const now = input.current;
      if (!target || index < 0 || now.horizontal) return;
      const top = itemStart(now.itemSize, index);
      const bottom = itemStart(now.itemSize, index + 1);
      target.scrollTop = Math.min(
        top,
        Math.max(target.scrollTop, bottom + now.offset - target.clientHeight),
      );
      measure();
    },
    [measure],
  );

  return [
    Math.min(range[0], Math.max(0, count - 1)),
    Math.min(range[1], count),
    ref,
    measure,
    reveal,
  ];
}
