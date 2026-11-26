"use client";

// Built on Base UI's Autocomplete rather than its Combobox. A combo box holds text: what is
// typed is the value, and choosing an item only fills the field, which is Autocomplete's model
// (`value` is the input's string, there is no selected item). Combobox keeps a selected item
// apart from the text and returns to it when the text matches nothing in the list.
import { Autocomplete as BaseAutocomplete } from "@base-ui/react/autocomplete";
import type { CSSProperties, ReactNode, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
// The open list is the library's menu: its surface and its rows are drawn by these two
// components' stylesheets, on the classes this file puts on Base UI's parts.
import "../menu";
import "../menu-item";
import { TextFieldBezel } from "../text-field";
import "./combo-box.tokens.css";
import "./combo-box.css";

export interface ComboBoxProps<Item = string>
  extends Omit<
    BaseAutocomplete.Input.Props,
    "ref" | "size" | "className" | "style" | "children" | "value" | "defaultValue"
  > {
  /** The text in the field, when controlled. Use it with `onValueChange`. */
  value?: string;
  /** The text in the field at first, when uncontrolled. */
  defaultValue?: string;
  /** Called with the new text when the user types or chooses an item. */
  onValueChange?: BaseAutocomplete.Root.Props<Item>["onValueChange"];
  /** Whether the list is open, when controlled. Use it with `onOpenChange`. */
  open?: boolean;
  /**
   * Whether the list is open at first, when uncontrolled.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the list opens or closes. */
  onOpenChange?: BaseAutocomplete.Root.Props<Item>["onOpenChange"];
  /**
   * What typing and the arrow keys do, as in Base UI's Autocomplete. `"inline"` is AppKit's
   * combo box: the list always shows every item, and moving through it with the arrow keys
   * puts the highlighted item in the field. `"none"` keeps the typed text until an item is
   * chosen. `"list"` shows only the items that contain the typed text and opens while
   * typing; `"both"` does that and fills the field.
   * @default "inline"
   */
  mode?: "list" | "both" | "inline" | "none";
  /**
   * The items as data, instead of as children: with it, `children` is a function that renders
   * one item. Needed for the list to shorten while typing (`mode="list"` or `"both"`).
   */
  items?: readonly Item[];
  /**
   * The text of an item of `items` that is an object: what is matched against the typed text
   * and put in the field. An object of the shape `{ value, label }` needs none; its label is
   * used.
   */
  itemToStringValue?: (item: Item) => string;
  /** Name under which the text is submitted with a form. */
  name?: string;
  /**
   * Whether the field must hold text before its form is submitted.
   * @default false
   */
  required?: boolean;
  /**
   * Whether the text can be read and selected but not changed. The list still opens, and
   * choosing from it does nothing.
   * @default false
   */
  readOnly?: boolean;
  /**
   * Whether the control ignores input and draws the disabled look.
   * @default false
   */
  disabled?: boolean;
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Accessible name of the button that opens the list.
   * @default "Show choices"
   */
  buttonLabel?: string;
  /** Element the list is rendered into; the document body by default. */
  container?: BaseAutocomplete.Portal.Props["container"];
  /**
   * The list: `ComboBoxItem` and `ComboBoxSeparator` elements, or with `items` a function that
   * returns the `ComboBoxItem` of one item.
   */
  children?: ReactNode | ((item: Item, index: number) => ReactNode);
  /** Class of the root element (the bezel). */
  className?: string;
  /** Style of the root element; set the control's `width` here. */
  style?: CSSProperties;
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
  /** Ref to the `<input>`, to focus it or read its text. */
  inputRef?: Ref<HTMLInputElement>;
}

export interface ComboBoxItemProps extends Omit<BaseAutocomplete.Item.Props, "ref" | "value"> {
  /**
   * What choosing the item puts in the field: a string, or with `items` that are objects the
   * item's object. Without it the item's children are used, when they are a string or a
   * number.
   */
  value?: unknown;
  /** Ref to the item's element. */
  ref?: Ref<HTMLDivElement>;
}

export interface ComboBoxSeparatorProps extends Omit<BaseAutocomplete.Separator.Props, "ref"> {
  /** Ref to the separator's element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A Catalina combo box (NSComboBox): a text field with a button that opens a list of
 * suggested values under it. Any text can be typed; choosing an item fills the field.
 *
 * Built on Base UI's Autocomplete. The props listed here configure the control; every other
 * prop, `id`, `aria-label` and `placeholder` included, goes to the `<input>`. `className`,
 * `style` and `ref` go to the root element, which draws the bezel and the focus ring. It has
 * no visible label of its own: put a label beside it, or name the input with `aria-label`.
 */
export function ComboBox<Item = string>({
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen = false,
  onOpenChange,
  mode = "inline",
  items,
  itemToStringValue,
  name,
  required = false,
  readOnly = false,
  disabled = false,
  size = "regular",
  buttonLabel = "Show choices",
  container,
  children,
  className,
  style,
  ref,
  inputRef,
  ...props
}: ComboBoxProps<Item>) {
  return (
    <BaseAutocomplete.Root<Item>
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(nextOpen, details) => {
        // AppKit opens the list with the button or Down Arrow, never because of typing. Only a
        // list that follows the text (`list`, `both`) opens with it, as Base UI's does.
        if (nextOpen && details.reason === "input-change" && (mode === "inline" || mode === "none"))
          details.cancel();
        else onOpenChange?.(nextOpen, details);
      }}
      mode={mode}
      items={items}
      itemToStringValue={itemToStringValue}
      name={name}
      required={required}
      readOnly={readOnly}
      disabled={disabled}
    >
      <BaseAutocomplete.InputGroup
        render={<TextFieldBezel size={size} disabled={disabled} />}
        className={cn("mac-combo-box", className)}
        style={style}
        ref={ref}
      >
        <BaseAutocomplete.Input ref={inputRef} className="mac-text-field-input" {...props} />
        <BaseAutocomplete.Trigger className="mac-combo-box-button" aria-label={buttonLabel}>
          {/* The chevron, drawn for this library on the measured box (spec: combo-box, Chevron
              bounds): 7.5 x 4.5 pt, arms at 45 degrees and 1.36 pt thick, in the button's
              own box, whose origin is the divider at the top edge. */}
          <svg viewBox="0 0 17.5 20" aria-hidden="true" focusable="false">
            <path d="M5 8.41 5.41 8h.5l2.84 2.84L11.59 8h.5l.41.41v.6L9.01 12.5h-.52L5 9.01z" />
          </svg>
        </BaseAutocomplete.Trigger>
      </BaseAutocomplete.InputGroup>
      <BaseAutocomplete.Portal container={container}>
        <BaseAutocomplete.Positioner className="mac-menu-positioner" align="start" sideOffset={3}>
          <BaseAutocomplete.Popup className="mac-menu mac-combo-box-menu" data-size={size}>
            <BaseAutocomplete.List>{children}</BaseAutocomplete.List>
          </BaseAutocomplete.Popup>
        </BaseAutocomplete.Positioner>
      </BaseAutocomplete.Portal>
    </BaseAutocomplete.Root>
  );
}

/**
 * One suggestion in a combo box's list. Built on Base UI's Autocomplete.Item: choosing it puts
 * its `value` in the field, and `disabled` dims it.
 */
export function ComboBoxItem({ value, className, children, ...props }: ComboBoxItemProps) {
  const title = typeof children === "string" || typeof children === "number";
  return (
    <BaseAutocomplete.Item
      value={value ?? (title ? String(children) : undefined)}
      className={withClassName("mac-menu-item mac-combo-box-item", className)}
      {...props}
    >
      <span className="mac-menu-item-title">{children}</span>
    </BaseAutocomplete.Item>
  );
}

/** A separator line between groups of items in a combo box's list. */
export function ComboBoxSeparator({ className, ...props }: ComboBoxSeparatorProps) {
  return (
    <BaseAutocomplete.Separator
      className={withClassName("mac-menu-item-separator", className)}
      {...props}
    />
  );
}
