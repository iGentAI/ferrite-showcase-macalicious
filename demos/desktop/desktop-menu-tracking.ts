/**
 * Whether a modal menu has the page: a pop-up button's list, a contextual menu or a menu of a button, each with Base
 * UI's full-page backdrop before it. The menu bar's and the Dock's menus are not modal and have none.
 */
export function modalMenuOpen(page: Document = document): boolean {
  return (
    page.querySelector(
      '[role="presentation"][data-base-ui-inert]:not([inert]) + .mac-menu-positioner',
    ) !== null
  );
}

/**
 * Whether a key is a command of the desktop or of an application: with Command, Control or Option, or a function key.
 * Typing in the menu, its arrows, Return and Escape are the menu's.
 */
function isCommandKey(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">,
): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || /^F\d+$/.test(event.key);
}

/**
 * While a modal menu is open it has the keyboard, as a Mac's menu does while it tracks. Without this Command-H or
 * Command-M hid the window of an open pop-up button and left its list and its backdrop over the desktop, with no
 * window of theirs to return to. Answers whether the key was taken.
 */
export function takeKeyForModalMenu(event: KeyboardEvent): boolean {
  if (!isCommandKey(event) || !modalMenuOpen()) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}
