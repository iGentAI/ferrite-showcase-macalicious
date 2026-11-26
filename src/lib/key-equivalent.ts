import { type Ref, type RefCallback, useCallback, useRef } from "react";

/**
 * AppKit key equivalents of a button: the key that activates it from anywhere in its window.
 *
 *   const ref = useKeyEquivalent("return", props.ref);   // then <button ref={ref}>
 *
 * `return` is the default button's key (Return). `escape` is the Cancel button's (Escape, and
 * Command-Period on Apple platforms, the only ones with that key). `none` answers no key.
 *
 * The "window" of a button is its nearest ancestor that is a `<form>`, a `<dialog>`, an element
 * with `role="dialog"` or `role="alertdialog"`, or an element that carries `data-window-state`.
 * A button outside all of those answers no key, and a key pressed in one window never reaches
 * a button of another, enclosing or not. A button that cannot be used answers no key either:
 * disabled, hidden, inert, or in a window that is not key.
 *
 * One `keydown` listener per document serves every button, is added with the first and removed
 * with the last. It sits on the document's window so that it runs last: the focused control
 * and every handler up to and on the document (where popups listen for Escape) see the key
 * first and keep it by preventing the default or stopping propagation.
 *
 * `useKeyEquivalent(key, ref)` returns the ref to give the element and forwards the element
 * to `ref`. The element registers with its own document when it is attached, so a replaced
 * element is followed, into another document too (a portal into a frame), and its window is
 * looked up when the key is pressed.
 */
export type KeyEquivalent = "none" | "return" | "escape";

type Key = Exclude<KeyEquivalent, "none">;

const SCOPE = 'form, dialog, [role="dialog"], [role="alertdialog"], [data-window-state]';

// A button under any of these cannot be used; keys belong to the key window only.
const UNUSABLE = '[inert], [hidden], [data-window-state="main"], [data-window-state="inactive"]';

// Focused elements that use the key themselves; the button stays out of their way.
const USES: Record<Key, string> = {
  return:
    'button, a[href], textarea, select, summary, input:is([type="button"], [type="submit"], [type="reset"], [type="image"], [type="file"], [type="color"]), [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="combobox"][aria-expanded="true"], [role="textbox"][aria-multiline="true"]',
  // Escape first closes whatever the focused control has open: a select's list, the popup of
  // a control that owns one, a menu, a popover. `aria-expanded` alone is not enough: an
  // expanded disclosure does nothing with Escape.
  escape:
    'select, [aria-haspopup]:not([aria-haspopup="false"])[aria-expanded="true"], [role="combobox"][aria-expanded="true"], [role="menu"], [role="listbox"], [popover]',
};

const registry = new Map<Document, Map<HTMLElement, Key>>();

function keyOf(event: KeyboardEvent): Key | null {
  const { key } = event;
  if (event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.shiftKey) {
    return null;
  }
  if (!event.metaKey) return key === "Escape" ? "escape" : key === "Enter" ? "return" : null;
  // Command-Period. Elsewhere the same keys are the operating system's (the emoji panel).
  return key === "." && /Mac|iP(hone|ad|od)/.test(navigator.platform) ? "escape" : null;
}

function keepsKey(origin: Element, key: Key, pressed: string) {
  if (origin.closest(USES[key])) return true;
  // A search field that holds text uses the Escape key, not Command-Period, to clear itself;
  // an empty one does not.
  return (
    pressed === "Escape" &&
    origin.matches('input[type="search"]') &&
    (origin as HTMLInputElement).value !== ""
  );
}

function canAnswer(button: HTMLElement) {
  // The last test is for a button that is not rendered (display: none on it or an ancestor)
  // or has visibility: hidden: a step of a wizard that stays mounted while another is shown.
  // Where the method is missing, only the attributes are known.
  return (
    button.isConnected &&
    !button.closest(UNUSABLE) &&
    !button.matches(':disabled, [aria-disabled="true"]') &&
    (!button.checkVisibility || button.checkVisibility({ visibilityProperty: true }))
  );
}

function onKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const key = keyOf(event);
  if (!key) return;
  const origin = event.target as Element | null;
  if (origin?.nodeType !== 1 || keepsKey(origin, key, event.key)) return;
  const scope = origin.closest(SCOPE);
  const doc = origin.ownerDocument;
  if (!scope || scope === doc.documentElement) return;
  for (const [button, equivalent] of registry.get(doc) ?? []) {
    // Only a usable button of the window the key was pressed in may answer it.
    if (equivalent !== key || button.closest(SCOPE) !== scope || !canAnswer(button)) continue;
    // Preventing the default also cancels the browser's implicit form submission, which would
    // activate the form's first submit button, not necessarily this one. The click submits the
    // form itself when the button is a submit button.
    event.preventDefault();
    button.click();
    return;
  }
}

function register(button: HTMLElement, key: Key) {
  const doc = button.ownerDocument;
  // A document without a window (a detached one) listens on itself.
  const target: EventTarget = doc.defaultView ?? doc;
  let buttons = registry.get(doc);
  if (!buttons) {
    buttons = new Map();
    registry.set(doc, buttons);
    target.addEventListener("keydown", onKeyDown as EventListener);
  }
  const map = buttons;
  map.set(button, key);
  return () => {
    map.delete(button);
    if (map.size === 0) {
      registry.delete(doc);
      target.removeEventListener("keydown", onKeyDown as EventListener);
    }
  };
}

export function useKeyEquivalent(
  key: KeyEquivalent,
  ref?: Ref<HTMLElement>,
): RefCallback<HTMLElement> {
  const stop = useRef<(() => void) | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      // Ends the previous registration first: a caller may detach by calling with null instead
      // of running the returned cleanup.
      stop.current?.();
      stop.current = node && key !== "none" ? register(node, key) : null;
      const cleanup = typeof ref === "function" ? ref(node) : undefined;
      if (ref && typeof ref !== "function") ref.current = node;
      return () => {
        stop.current?.();
        stop.current = null;
        if (typeof cleanup === "function") cleanup();
        else if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      };
    },
    [key, ref],
  );
}
