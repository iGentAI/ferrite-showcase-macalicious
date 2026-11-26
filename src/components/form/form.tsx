import { Field } from "@base-ui/react/field";
import { Fieldset } from "@base-ui/react/fieldset";
import { Form as BaseForm } from "@base-ui/react/form";
import type { ComponentProps, CSSProperties, ReactNode, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import { Separator, type SeparatorProps } from "../separator";
import "./form.css";

export interface FormProps extends Omit<BaseForm.Props, "ref"> {
  /**
   * AppKit control size of the form: the font of its labels and the space between its rows.
   * Give the controls inside the same size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Which edge of the label column the labels are set against. `"end"` is the Catalina form:
   * every label ends just before its control. `"start"` is the list of keys and values of
   * System Information.
   * @default "end"
   */
  labelAlign?: "end" | "start";
  /**
   * Width of the label column: a number of points or any CSS length. Without it the column is
   * as wide as the longest label. Set it to line up two forms, or to keep the controls in
   * place when the labels change.
   */
  labelWidth?: number | string;
  /** Ref to the `<form>` element. */
  ref?: Ref<HTMLFormElement>;
}

/**
 * A Catalina form (the layout AppKit builds with NSGridView): a column of labels that end in
 * a colon, each right-aligned against the control it names, and a column of controls on the
 * same baselines.
 *
 * It is Base UI's Form, a `<form>` that collects the values of the fields inside and takes
 * `onFormSubmit`, `errors` and `validationMode`. Children are `FormRow` and `FormSeparator`
 * elements; anything else spans both columns. Inside another `<form>`, render a `<div>`:
 * `render={<div />}`.
 */
export function Form({
  size = "regular",
  labelAlign = "end",
  labelWidth,
  className,
  style,
  ...props
}: FormProps) {
  const width = typeof labelWidth === "number" ? `${labelWidth}px` : labelWidth;
  const own = width === undefined ? undefined : ({ "--mac-form-label-width": width } as const);
  return (
    <BaseForm
      data-size={size}
      data-label-align={labelAlign}
      className={withClassName("mac-form", className)}
      style={
        typeof style === "function"
          ? (state) => ({ ...own, ...style(state) }) as CSSProperties
          : ({ ...own, ...style } as CSSProperties)
      }
      {...props}
    />
  );
}

export interface FormRowProps extends Omit<ComponentProps<"div">, "children"> {
  /**
   * The row's label, in the label column: text that ends in a colon. Without it the controls
   * still sit in the control column, as a checkbox under other rows does.
   */
  label?: ReactNode;
  /**
   * What the label names. `"field"`: the one control of the row, which the label then names
   * for assistive technology (Base UI's Field). `"group"`: several controls, such as a stack
   * of checkboxes or a pop-up button followed by text; the row is then a group named by the
   * label (Base UI's Fieldset). `"value"`: text that is not a control, as in a list of keys
   * and values; the label is a term and the content its definition.
   * @default "field"
   */
  kind?: "field" | "group" | "value";
  /**
   * The `id` of the one control the label is for, when that control is not a Base UI control
   * the field can name by itself (a plain `<input>`, a control of another library). The label
   * is then a native `<label>` for it, and the row is not a Base UI Field: `disabled` and
   * `description` are then yours to wire to the control.
   */
  labelFor?: string;
  /**
   * Explanatory text under the controls, in the small system font. In a `"field"` row it
   * describes the control to assistive technology.
   */
  description?: ReactNode;
  /**
   * How the controls of the row are laid out: side by side on one baseline, or one under the
   * other, as a stack of checkboxes or radio buttons.
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /**
   * How the label and the controls line up: on their first baselines, or by their centres or
   * top edges, for controls without text such as a slider or an image well.
   * @default "baseline"
   */
  align?: "baseline" | "center" | "start";
  /**
   * Draws the label and the description in the disabled label colour. In a `"field"` row,
   * with or without a label, it also disables the control; in the other kinds, disable the
   * controls yourself.
   * @default false
   */
  disabled?: boolean;
  /** The control or controls of the row, or the value of a `"value"` row. */
  children?: ReactNode;
  /** Ref to the row's element. */
  ref?: Ref<HTMLDivElement>;
}

const present = (node: ReactNode) => node !== undefined && node !== null && node !== false;

/**
 * One row of a `Form`: a label in the label column and, beside it, the control or controls it
 * names, with optional explanatory text under them.
 */
export function FormRow({
  label,
  kind = "field",
  labelFor,
  description,
  orientation = "horizontal",
  align = "baseline",
  disabled = false,
  className,
  children,
  ...props
}: FormRowProps) {
  const hasLabel = present(label);
  const hasDescription = present(description);
  const shared = {
    "data-kind": kind,
    "data-orientation": orientation,
    "data-align": align,
    "data-disabled": disabled ? "" : undefined,
    className: cn("mac-form-row", className),
    ...props,
  };
  const controls = <div className="mac-form-controls">{children}</div>;

  if (kind === "field" && labelFor === undefined) {
    // Also without a label or description: the field is what disables the row's control.
    return (
      <Field.Root disabled={disabled} {...shared}>
        {hasLabel ? (
          // Not a native <label>: clicking a label does nothing in AppKit, and a <label>
          // would press a pop-up button when its label is clicked.
          <Field.Label nativeLabel={false} render={<span />} className="mac-form-label">
            {label}
          </Field.Label>
        ) : null}
        {controls}
        {hasDescription ? (
          <Field.Description render={<div />} className="mac-form-description">
            {description}
          </Field.Description>
        ) : null}
      </Field.Root>
    );
  }

  if (kind === "group" && hasLabel && labelFor === undefined) {
    // A <div>, not a <fieldset>: a fieldset lays its legend out on its border and cannot take
    // part in the form's grid as a subgrid.
    const group = (
      // biome-ignore lint/a11y/useSemanticElements: see above.
      <div role="group" />
    );
    return (
      // The props are a <div>'s; Fieldset.Root types them for the <fieldset> it replaces.
      <Fieldset.Root render={group} {...(shared as Fieldset.Root.Props)}>
        <Fieldset.Legend render={<span />} className="mac-form-label">
          {label}
        </Fieldset.Legend>
        {controls}
        {hasDescription ? <div className="mac-form-description">{description}</div> : null}
      </Fieldset.Root>
    );
  }

  const value = kind === "value" && hasLabel && labelFor === undefined;
  return (
    <div {...shared}>
      {hasLabel ? (
        labelFor === undefined ? (
          <span role={value ? "term" : undefined} className="mac-form-label">
            {label}
          </span>
        ) : (
          <label htmlFor={labelFor} className="mac-form-label">
            {label}
          </label>
        )
      ) : null}
      {value ? (
        <div role="definition" className="mac-form-controls">
          {children}
        </div>
      ) : (
        controls
      )}
      {hasDescription ? <div className="mac-form-description">{description}</div> : null}
    </div>
  );
}

export interface FormSeparatorProps extends SeparatorProps {}

/**
 * The line between two groups of rows: a `Separator` across both columns, with the section
 * spacing (20 pt) above and below it.
 */
export function FormSeparator({ className, ...props }: FormSeparatorProps) {
  return <Separator className={withClassName("mac-form-separator", className)} {...props} />;
}
