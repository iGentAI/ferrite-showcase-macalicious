"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { useRender } from "@base-ui/react/use-render";
import {
  createContext,
  createElement,
  type ElementType,
  type ReactElement,
  type ReactNode,
  use,
  useState,
  useSyncExternalStore,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { parseMenuKeyEquivalent } from "../../lib/menu-key-equivalent";
import "./menu-item.tokens.css";
import "./menu-item.css";

export interface MenuItemLabelProps {
  /**
   * A 16 pt image before the title, normally an inline SVG drawn with `currentColor`. The
   * row is 21 pt high with one, in a menu of any size.
   */
  image?: ReactNode;
  /**
   * The key equivalent shown at the trailing edge: modifier names, then the key, joined with
   * `+`, for example `"shift+command+q"` (see `macalicious/lib/menu-key-equivalent`).
   */
  keyEquivalent?: string;
  /** The item's title. */
  children?: ReactNode;
}

/** A row's content. */
export function MenuItemLabel({ image, keyEquivalent, children }: MenuItemLabelProps) {
  const shortcut = keyEquivalent && parseMenuKeyEquivalent(keyEquivalent);
  return (
    <>
      {image != null && <span className="mac-menu-item-image">{image}</span>}
      <span className="mac-menu-item-title">{children}</span>
      {shortcut && (
        // The item announces the shortcut through aria-keyshortcuts; the glyphs are for the eye.
        <span className="mac-menu-item-key" aria-hidden="true">
          <span className="mac-menu-item-key-modifiers">{shortcut.modifiers}</span>
          <span className="mac-menu-item-key-character">{shortcut.key}</span>
        </span>
      )}
    </>
  );
}

// Props of any of the three item kinds, whose Base UI states differ.
// biome-ignore lint/suspicious/noExplicitAny: see above
type RowProps = Record<string, any>;
type Checked = boolean | "mixed" | undefined;

// A disabled item. Catalina's arrow keys and type-select pass over an item that cannot be
// chosen, while Base UI keeps a disabled item in the keyboard order. So a disabled item is
// rendered outside Base UI's list: an element with the same role and attributes, announced as
// disabled, which cannot be highlighted, focused or chosen. `render` is applied as Base UI
// applies it; then everything that could activate the element is taken off it, whether it
// came from the item or from `render`: every event handler, the tab stop and a link's
// destination. A rendered button, select, textarea or input is disabled as well.
function DisabledRow({ checked, props }: { checked: Checked; props: RowProps }) {
  const { className, style, render, ...rest } = props;
  const state = { disabled: true, highlighted: false, checked: checked === true };
  // biome-ignore lint/suspicious/noExplicitAny: a value, or a function of the item's state
  const of = (value: any) => (typeof value === "function" ? value(state) : value);
  // The role is the item's own (menuitem, menuitemcheckbox or menuitemradio), in `rest`.
  const { type, props: merged } = useRender({
    render,
    state,
    props: {
      "aria-disabled": "true",
      "data-disabled": "",
      "data-checked": state.checked ? "" : undefined,
      ...rest,
      "aria-checked": checked,
      className: cn("mac-menu-item", of(className)),
      style: of(style),
    },
  }) as ReactElement<RowProps>;
  const kept = { ...merged };
  // Event handlers, the item's props that are not attributes, and what would let the element
  // take the focus or be edited.
  const gone =
    /^(on[A-Z]|(label|closeOnClick|nativeButton|disabled|checked|value|tabIndex|contentEditable)$)/;
  for (const name in kept) if (gone.test(name)) delete kept[name];
  if (typeof type === "string") {
    delete kept.href;
    if (/^(button|select|textarea|input)$/.test(type)) kept.disabled = true;
  } else kept.tabIndex = -1;
  return createElement(type, kept);
}

const never = () => () => {};

// One row: the Base UI part with the item's class and content, or its disabled form.
function useRow(
  Part: ElementType,
  role: string,
  checked: Checked,
  { image, keyEquivalent, children, ...props }: RowProps,
) {
  // Off Apple platforms Command is the Control key (menu-key-commands). The platform is not
  // known on the server, so the markup says Meta until the page has hydrated.
  const apple = useSyncExternalStore(
    never,
    () => /Mac|iP/.test(navigator.platform),
    () => true,
  );
  const aria = keyEquivalent && parseMenuKeyEquivalent(keyEquivalent).aria;
  // An item with a key equivalent takes the attribute from it; one without keeps its own.
  // Where Command is the Control key, a key equivalent with Control and Command names that
  // key twice and cannot be typed, so it is not announced.
  if (aria)
    props["aria-keyshortcuts"] = apple
      ? aria
      : /^C.*Meta/.test(aria)
        ? undefined
        : aria.replace("Meta", "Control");
  props.children = (
    <MenuItemLabel image={image} keyEquivalent={keyEquivalent}>
      {children}
    </MenuItemLabel>
  );
  return props.disabled ? (
    <DisabledRow checked={checked} props={{ role, ...props }} />
  ) : (
    <Part {...props} className={withClassName("mac-menu-item", props.className)} />
  );
}

export interface MenuItemProps extends BaseMenu.Item.Props, MenuItemLabelProps {
  /**
   * AppKit's `indentationLevel`: each level moves the title 11 pt further in.
   * @default 0
   */
  indentationLevel?: number;
}

/** A command (NSMenuItem). */
export function MenuItem({ indentationLevel, ...props }: MenuItemProps) {
  return useRow(BaseMenu.Item, "menuitem", undefined, {
    "data-indentation": indentationLevel || undefined,
    ...props,
  });
}

export interface MenuCheckboxItemProps extends BaseMenu.CheckboxItem.Props, MenuItemLabelProps {
  /**
   * AppKit's mixed state: the item shows a dash instead of a checkmark, for a setting that
   * is on for only part of the selection. Choosing the item still reports through
   * `onCheckedChange`.
   * @default false
   */
  mixed?: boolean;
  /**
   * Whether choosing the item closes the menu, as a Catalina menu does.
   * @default true
   */
  closeOnClick?: boolean;
}

/** An item: on, off or mixed. */
export function MenuCheckboxItem({
  mixed,
  closeOnClick = true,
  defaultChecked = false,
  onCheckedChange,
  ...props
}: MenuCheckboxItemProps) {
  // The state is held here, so that it outlives the item's being disabled and enabled again.
  const [own, setOwn] = useState(defaultChecked);
  const on = props.checked ?? own;
  return useRow(BaseMenu.CheckboxItem, "menuitemcheckbox", mixed ? "mixed" : on, {
    closeOnClick,
    ...props,
    checked: on,
    onCheckedChange: (next: boolean, details: BaseMenu.CheckboxItem.ChangeEventDetails) => {
      onCheckedChange?.(next, details);
      if (!details.isCanceled) setOwn(next);
    },
    ...(mixed && { "aria-checked": "mixed", "data-mixed": "" }),
  });
}

// The group's value, for a disabled radio item, which Base UI does not render.
const RadioValue = createContext<unknown>(undefined);

/** Props of `MenuRadioGroup`: those of Base UI's Menu.RadioGroup. */
export interface MenuRadioGroupProps extends BaseMenu.RadioGroup.Props {}

/** Radio items. */
export function MenuRadioGroup({ onValueChange, ...props }: MenuRadioGroupProps) {
  // Follows an uncontrolled group's value; a controlled one names it.
  const [chosen, setChosen] = useState(props.defaultValue);
  return (
    <RadioValue value={props.value === undefined ? chosen : props.value}>
      <BaseMenu.RadioGroup
        onValueChange={(value, details) => {
          onValueChange?.(value, details);
          if (!details.isCanceled) setChosen(value);
        }}
        {...props}
      />
    </RadioValue>
  );
}

export interface MenuRadioItemProps extends BaseMenu.RadioItem.Props, MenuItemLabelProps {
  /**
   * Whether choosing the item closes the menu, as a Catalina menu does.
   * @default true
   */
  closeOnClick?: boolean;
}

/** One radio item. */
export function MenuRadioItem({ closeOnClick = true, ...props }: MenuRadioItemProps) {
  return useRow(BaseMenu.RadioItem, "menuitemradio", props.value === use(RadioValue), {
    closeOnClick,
    ...props,
  });
}

/** Props of `MenuSeparator`: those of Base UI's Separator. */
export interface MenuSeparatorProps extends BaseMenu.Separator.Props {}

/** A separator. */
export function MenuSeparator({ className, ...props }: MenuSeparatorProps) {
  return (
    <BaseMenu.Separator
      className={withClassName("mac-menu-item-separator", className)}
      {...props}
    />
  );
}

export interface MenuSectionProps extends Omit<BaseMenu.Group.Props, "title"> {
  /** The section header: a dimmed title above the section's items, which names the group. */
  title: ReactNode;
}

/** A titled section. */
export function MenuSection({ title, children, ...props }: MenuSectionProps) {
  return (
    <BaseMenu.Group {...props}>
      <BaseMenu.GroupLabel className="mac-menu-item-header">{title}</BaseMenu.GroupLabel>
      {children}
    </BaseMenu.Group>
  );
}
