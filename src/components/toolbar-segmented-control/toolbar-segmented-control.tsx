"use client";

import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { createContext, type Ref, use } from "react";
import { withClassName } from "../../lib/cn";
import { ToolbarContext } from "../../lib/toolbar-context";
import "./toolbar-segmented-control.tokens.css";
import "./toolbar-segmented-control.css";

/** Set below a momentary control: 1 while it is enabled, 2 while it is disabled. */
const MomentaryContext = createContext(0);

export interface ToolbarSegmentedControlProps
  extends Omit<BaseToggleGroup.Props<string>, "multiple" | "ref"> {
  /**
   * `"joined"` is one bezel divided into segments (the Finder view switcher). `"separated"`
   * gives every segment its own bezel (Preview's zoom buttons). `"navigation"` is
   * the Back and Forward pair: separate bezels that touch, as those of `"separated"` do.
   * @default "joined"
   */
  variant?: "joined" | "separated" | "navigation";
  /**
   * How the segments behave. `"select-one"`: a selected segment cannot be deselected, so once
   * one is selected exactly one stays selected, like the Finder view switcher; start it with a
   * `defaultValue` or `value`. `"select-any"`: each segment is an independent toggle.
   * `"momentary"`: segments are plain buttons that act when clicked and keep no selection;
   * give each an `onClick`.
   * @default "select-one"
   */
  tracking?: "select-one" | "select-any" | "momentary";
  /** Ref to the rendered group element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The segmented control of a toolbar (NSSegmentedControl, textured rounded): the one toolbar
 * control that may show a lasting selection.
 *
 * Built on Base UI's Toggle Group, whose API it keeps: `value` and `defaultValue` are arrays of
 * the selected segments' values, and `onValueChange` receives the new array. On its own the
 * group is one tab stop with arrow keys between segments; in a `Toolbar` its segments join the
 * toolbar's arrow-key navigation. Give the group an `aria-label`, and every segment that shows
 * only a glyph one too.
 */
export function ToolbarSegmentedControl({
  variant = "joined",
  tracking = "select-one",
  onValueChange,
  disabled,
  className,
  value,
  defaultValue,
  ...props
}: ToolbarSegmentedControlProps) {
  const inToolbar = use(ToolbarContext);
  const attributes = {
    "data-variant": variant,
    "data-tracking": tracking,
    className: withClassName("mac-toolbar-segmented-control", className),
  };

  if (tracking === "momentary") {
    // A toggle group moves focus only between toggles, so momentary segments (toolbar buttons)
    // need a toolbar's roving focus: the enclosing one, or one of the control's own.
    return (
      <MomentaryContext value={disabled ? 2 : 1}>
        {inToolbar ? (
          <BaseToggleGroup disabled={disabled} {...attributes} {...props} />
        ) : (
          <BaseToolbar.Root
            role="group"
            aria-orientation={undefined}
            disabled={disabled}
            {...({ ...attributes, ...props } as BaseToolbar.Root.Props)}
          />
        )}
      </MomentaryContext>
    );
  }

  return (
    <BaseToggleGroup
      multiple={tracking === "select-any"}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={(next, details) => {
        // AppKit's select-one mode never leaves the control without a selection.
        if (tracking === "select-one" && next.length === 0) details.cancel();
        else onValueChange?.(next, details);
      }}
      {...attributes}
      {...props}
    />
  );
}

export interface ToolbarSegmentProps extends Omit<BaseToggle.Props, "ref"> {
  /** Ref to the rendered button. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * One segment of a `ToolbarSegmentedControl`. In the selecting modes give it the `value` the
 * group reports; in a momentary control give it an `onClick`.
 */
export function ToolbarSegment({ className, value, ...props }: ToolbarSegmentProps) {
  const momentary = use(MomentaryContext);
  const rest = {
    className: withClassName("mac-toolbar-segmented-control-segment", className),
    ...props,
  };

  if (!momentary) return <BaseToggle value={value} {...rest} />;
  return (
    <BaseToolbar.Button
      {...(rest as BaseToolbar.Button.Props)}
      disabled={momentary === 2 || rest.disabled}
    />
  );
}
