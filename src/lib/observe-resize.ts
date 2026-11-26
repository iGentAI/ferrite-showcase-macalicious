// Calls back when an element's size changes, and once soon after it is first observed.
//
//   const stop = observeResize(element, () => measure(element));
//   stop();                                   // on unmount
//
// One ResizeObserver is shared by every observed element, created on first use and
// disconnected when the last element is released. An element can be observed any number of
// times: each call has its own callback and its own `stop`. Where ResizeObserver does not
// exist (server, jsdom) the callback is never called.
const callbacks = new Map<Element, Set<() => void>>();
let observer: ResizeObserver | undefined;

export function observeResize(element: Element, callback: () => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};

  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) for (const call of callbacks.get(entry.target) ?? []) call();
  });
  // A function of its own, so that one callback given twice is two subscriptions.
  const own = () => callback();
  const set = callbacks.get(element) ?? new Set();
  // The observer reports an element once when it is first observed; a callback that joins
  // later gets its first call from here.
  if (set.size) queueMicrotask(() => set.has(own) && own());
  callbacks.set(element, set.add(own));
  observer.observe(element);

  return () => {
    if (!set.delete(own) || set.size) return;
    callbacks.delete(element);
    observer?.unobserve(element);
    if (!callbacks.size) {
      observer?.disconnect();
      observer = undefined;
    }
  };
}
