import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentProps, CSSProperties, ReactNode, Ref } from "react";
import { cn } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./text-field.tokens.css";
import "./text-field.css";

export interface TextFieldBezelProps extends ComponentProps<"div"> {
  /**
   * Bezel style. `"square"` is Catalina's standard field; `"rounded"` is AppKit's rounded
   * bezel; `"capsule"` is the field with round ends that Messages types a message in;
   * `"none"` draws no bezel and no fill.
   * @default "square"
   */
  bezel?: "square" | "rounded" | "capsule" | "none";
  /**
   * AppKit control size: the bezel's height and the font its content inherits.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Draws the disabled look: fainter edges and dimmed text. It disables nothing; disable the
   * controls inside.
   * @default false
   */
  disabled?: boolean;
  /**
   * Whether the bezel draws the focus ring while something inside it has the keyboard. Switch
   * it off when the content draws a ring of its own.
   * @default true
   */
  focusRing?: boolean;
}

/**
 * The bezel of a Catalina text field without the `<input>`: the edge, the fill and the focus
 * ring around content of your own, for a control that looks like a text field but edits
 * something else, such as the segments of a date. It is a `<div>` and takes every `<div>`
 * prop; what is inside decides the role, the name and the keyboard behaviour.
 */
export function TextFieldBezel({
  bezel = "square",
  size = "regular",
  disabled = false,
  focusRing = true,
  className,
  ...props
}: TextFieldBezelProps) {
  return (
    <div
      data-bezel={bezel}
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      data-focus-ring={focusRing ? undefined : "none"}
      className={cn("mac-text-field", className)}
      {...props}
    />
  );
}

export interface TextFieldProps
  extends Omit<BaseInput.Props, "ref" | "size" | "className" | "style" | "children"> {
  /**
   * Bezel style. `"square"` is Catalina's standard field; `"rounded"` is AppKit's rounded
   * bezel; `"capsule"` is the field with round ends that Messages types a message in;
   * `"none"` draws no bezel and no fill, for a field inside a surface that already
   * frames it.
   * @default "square"
   */
  bezel?: "square" | "rounded" | "capsule" | "none";
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /** Class of the root element (the bezel). */
  className?: string;
  /** Style of the root element; set the field's `width` here. */
  style?: CSSProperties;
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
  /** Ref to the `<input>`, to focus it or read its value. */
  inputRef?: Ref<HTMLInputElement>;
  /**
   * Content drawn inside the bezel after the text, such as an indicator. It does not shrink;
   * the text takes the remaining width.
   */
  children?: ReactNode;
}

/**
 * A Catalina text field (NSTextField with a bezel): one line of editable text.
 *
 * Built on Base UI's Input, so it works inside a Base UI Field and accepts `value`,
 * `defaultValue`, `onValueChange`, `disabled`, `readOnly`, `placeholder` and every native
 * input attribute; those go to the `<input>`. `className`, `style` and `ref` go to the root
 * element, which draws the bezel and the focus ring.
 */
export function TextField({
  bezel = "square",
  size = "regular",
  className,
  style,
  ref,
  inputRef,
  children,
  disabled,
  ...props
}: TextFieldProps) {
  return (
    <TextFieldBezel
      ref={ref}
      bezel={bezel}
      size={size}
      disabled={disabled}
      className={className}
      style={style}
    >
      <BaseInput
        ref={inputRef as Ref<HTMLElement>}
        disabled={disabled}
        className="mac-text-field-input"
        {...props}
      />
      {children}
    </TextFieldBezel>
  );
}
