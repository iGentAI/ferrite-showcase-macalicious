"use client";

import { Autocomplete as BaseAutocomplete } from "@base-ui/react/autocomplete";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { use } from "react";
import { cn } from "../../lib/cn";
import { ToolbarContext } from "../../lib/toolbar-context";
// The open list is the combo box's: the library's menu surface with that component's rows
// (`ComboBoxItem`, `ComboBoxSeparator`), drawn by its stylesheet on the classes this file
// puts on Base UI's parts.
import "../combo-box";
import type { ComboBoxProps } from "../combo-box";
// The bezel's fill, edges and ink are the toolbar button's tokens.
import "../toolbar-button";
import "./toolbar-combo-box.tokens.css";
import "./toolbar-combo-box.css";

export interface ToolbarComboBoxProps<Item = string> extends Omit<ComboBoxProps<Item>, "size"> {
  /**
   * The size of the bar the control is in, one of a toolbar's two sizes, not one of the three
   * control sizes: there is no `"mini"`. `"regular"` is as high as the other toolbar
   * controls, 22 pt with 13 pt text. `"small"` is the control of TextEdit's format bar: 16 pt
   * over Aqua's border, 15 pt of fill, with 9 pt text.
   * @default "regular"
   */
  size?: "regular" | "small";
}

/**
 * The combo box of a toolbar (NSComboBox in a toolbar or a format bar): the textured rounded
 * bezel of a toolbar button holding a text field and, after a hairline, a button with a down
 * chevron that opens a list of suggested values. Any text can be typed; choosing an item fills
 * the field. TextEdit's font size control is this one.
 *
 * It is the `ComboBox` in a toolbar's bezel and takes that component's props, except that
 * `size` has a toolbar's two values and no `"mini"`; its children are
 * `ComboBoxItem` and `ComboBoxSeparator` elements from `macalicious/combo-box`. Built on Base
 * UI's Autocomplete: the props listed configure the control, every other prop goes to the
 * `<input>`, and `className`, `style` and `ref` go to the root element, which draws the bezel.
 * Inside a `Toolbar` the field joins the toolbar's arrow-key navigation. Name it with
 * `aria-label`.
 */
export function ToolbarComboBox<Item = string>({
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
}: ToolbarComboBoxProps<Item>) {
  const inToolbar = use(ToolbarContext);
  return (
    <BaseAutocomplete.Root<Item>
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(nextOpen, details) => {
        // As the combo box: the list opens with the button or Down Arrow, never because of
        // typing, unless it follows the text (`list`, `both`).
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
        className={cn("mac-toolbar-combo-box", className)}
        data-size={size}
        style={style}
        ref={ref}
      >
        <BaseAutocomplete.Input
          ref={inputRef}
          className="mac-toolbar-combo-box-input"
          // In a toolbar the field is one of its items: the arrow keys reach it, and inside
          // the text they move the insertion point.
          render={inToolbar ? <BaseToolbar.Input /> : undefined}
          {...props}
        />
        <BaseAutocomplete.Trigger className="mac-toolbar-combo-box-button" aria-label={buttonLabel}>
          {/* The chevron, drawn for this library on the measured box (spec: toolbar-combo-box,
              Chevron): arms of 3.13 pt at 45 degrees, stroke 1.3, in a 7 x 5 pt box. */}
          <svg viewBox="0 0 7 5" aria-hidden="true" focusable="false">
            <path d="M.37.6l3.13 3.13 3.13-3.13" />
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
