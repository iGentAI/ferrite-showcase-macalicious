import type { Ref } from "react";

/**
 * Hands an element to a caller's ref from inside a component's own callback ref, and returns
 * the function that takes it back.
 *
 *   const setRoot = useCallback((element: HTMLDivElement) => {
 *     const release = attachRef(ref, element);
 *     return () => release();
 *   }, [ref]);
 *
 * A callback ref may return a cleanup (React 19). That cleanup is what releases it; only a
 * callback that returned none is called with `null`, and an object ref has `current` cleared.
 */
export function attachRef<T>(ref: Ref<T> | undefined, element: T): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(element);
    return typeof cleanup === "function" ? cleanup : () => void ref(null);
  }
  if (ref) {
    ref.current = element;
    return () => {
      ref.current = null;
    };
  }
  return () => {};
}
