"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
  use,
  useCallback,
} from "react";
import { attachRef } from "../../lib/attach-ref";
import { withClassName } from "../../lib/cn";
import { ToolbarContext } from "../../lib/toolbar-context";
import "./safari-tab-bar.tokens.css";
import "./safari-tab-bar.css";

export interface SafariTabBarProps extends Omit<BaseTabs.Root.Props, "ref" | "orientation"> {
  /**
   * Called when the new-tab button is clicked. The button, a 24 pt cell with a + at the
   * trailing end of the bar, is only rendered when this is set. It is a `<button>` of its own,
   * outside the tab list.
   */
  onNewTab?: (event: MouseEvent<HTMLButtonElement>) => void;
  /**
   * Accessible name of the new-tab button.
   * @default "New Tab"
   */
  newTabLabel?: string;
  /**
   * Whether moving focus to a tab with the arrow keys also selects it. By default the arrow
   * keys only move focus and Space or Return selects, so that passing over a tab does not
   * load its page.
   * @default false
   */
  activateOnFocus?: boolean;
  /** Ref to the rendered element, the bar. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Safari's tab bar: one tab per open page under the toolbar, one of them selected, and
 * optionally a new-tab button.
 *
 * Built on Base UI's Tabs: it is the Tabs root with its tab list inside, so it accepts
 * `value`, `defaultValue` and `onValueChange` and supplies the tab semantics and the arrow
 * keys. Its children are `SafariTab`s. `aria-label` and `aria-labelledby` name the tab list.
 */
export function SafariTabBar({
  onNewTab,
  newTabLabel = "New Tab",
  activateOnFocus = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  children,
  ...props
}: SafariTabBarProps) {
  return (
    <BaseTabs.Root className={withClassName("mac-safari-tab-bar", className)} {...props}>
      <BaseTabs.List
        activateOnFocus={activateOnFocus}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className="mac-safari-tab-bar-list"
      >
        {children}
      </BaseTabs.List>
      {onNewTab ? (
        <button
          type="button"
          className="mac-safari-tab-bar-new"
          aria-label={newTabLabel}
          onClick={onNewTab}
        />
      ) : null}
    </BaseTabs.Root>
  );
}

export interface SafariTabProps extends Omit<BaseTabs.Tab.Props, "ref"> {
  /**
   * The page's icon, shown before the title: a 16 pt image or glyph. Safari 13 shows icons in
   * tabs only when the user turns them on, so there is none by default.
   */
  icon?: ReactNode;
  /**
   * Called when the tab is closed: by a click on the close button that appears at the tab's
   * leading edge under the pointer, or by Delete or Backspace while the tab has keyboard
   * focus. Remove the tab in response; if it had the keyboard focus, the focus moves to the
   * next tab that is not disabled, or else to the nearest one before it. Without it the tab
   * cannot be closed; a disabled tab cannot be closed either.
   */
  onClose?: (event: SyntheticEvent<HTMLElement>) => void;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/** The nearest tab that can take the focus: the next enabled one, or else the one before. */
function tabBeside(tab: Element): HTMLElement | undefined {
  for (const step of ["nextElementSibling", "previousElementSibling"] as const) {
    for (let other = tab[step]; other; other = other[step]) {
      const able = "[role='tab']:not(:disabled, [aria-disabled='true'], [data-disabled])";
      if (other instanceof HTMLElement && other.matches(able)) return other;
    }
  }
}

/**
 * One tab of a `SafariTabBar`: the page's title, centred and cut at the end when it does not
 * fit, with an optional icon before it. Renders Base UI's Tabs.Tab, a `<button role="tab">`,
 * and takes its `value` and `disabled`.
 */
export function SafariTab({
  icon,
  onClose,
  onKeyDown,
  disabled,
  className,
  children,
  ref,
  ...props
}: SafariTabProps) {
  const close = disabled ? undefined : onClose;
  // A tab removed while it has the keyboard focus would leave the focus on the page, outside
  // the bar: a neighbouring tab takes it instead, unless the focus was put somewhere already.
  const setTab = useCallback(
    (tab: HTMLElement | null) => {
      const release = attachRef(ref, tab);
      return () => {
        release();
        const heir = tab && tab === tab.ownerDocument.activeElement ? tabBeside(tab) : undefined;
        if (!tab || !heir) return;
        queueMicrotask(() => {
          const { activeElement, body } = tab.ownerDocument;
          const lost = !activeElement || activeElement === body;
          if (lost && !tab.isConnected && heir.isConnected) heir.focus();
        });
      };
    },
    [ref],
  );
  return (
    <BaseTabs.Tab
      ref={setTab}
      aria-keyshortcuts={close ? "Delete Backspace" : undefined}
      disabled={disabled}
      className={withClassName("mac-safari-tab-bar-tab", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (close && !event.defaultPrevented && /^(Delete|Backspace)$/.test(event.key)) {
          // Backspace must not also take the embedding page back in its history.
          event.preventDefault();
          close(event);
        }
      }}
      {...props}
    >
      {close ? (
        // A pointer affordance only: a button cannot sit inside the tab, which is a button, so
        // the keyboard and assistive technology close the tab with Delete instead.
        <span
          className="mac-safari-tab-bar-close"
          aria-hidden="true"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            close(event);
          }}
        />
      ) : null}
      {icon ? <span className="mac-safari-tab-bar-icon">{icon}</span> : null}
      <span className="mac-safari-tab-bar-title">{children}</span>
    </BaseTabs.Tab>
  );
}

export interface SafariNewTabButtonProps extends Omit<ComponentProps<"button">, "ref"> {
  /**
   * Ref to the rendered element, a `<button>`.
   * @default undefined
   */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Safari's new-tab cell on its own, for a window with one tab, which shows no tab bar: the
 * bar's + cell at the trailing end of the toolbar, in its lower corner against the window's
 * edge. Put it last in a title-hidden `Toolbar`; it joins the toolbar's arrow-key navigation.
 * It is a `<button>` named "New Tab" (`aria-label` renames it) and takes a button's props.
 */
export function SafariNewTabButton({ className, ...props }: SafariNewTabButtonProps) {
  const rest = {
    type: "button" as const,
    "aria-label": "New Tab",
    "data-standalone": "",
    className: className ? `mac-safari-tab-bar-new ${className}` : "mac-safari-tab-bar-new",
    ...props,
  };
  return use(ToolbarContext) ? (
    <BaseToolbar.Button {...(rest as BaseToolbar.Button.Props)} />
  ) : (
    <button {...rest} />
  );
}
