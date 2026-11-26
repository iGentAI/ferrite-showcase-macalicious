/** One class-name part; falsy parts are dropped. */
export type ClassValue = string | false | null | undefined;

/** Join class names, skipping falsy parts. No dependency, no allocation beyond the result. */
export function cn(...parts: ClassValue[]): string {
  let out = "";
  for (const part of parts) {
    if (part) out = out ? `${out} ${part}` : part;
  }
  return out;
}

/** Base UI's `className` prop: a string, or a function of the component state. */
export type StatefulClassName<State> = string | ((state: State) => string | undefined) | undefined;

/**
 * Prepend a component's own class to a Base UI `className` prop, preserving the function form.
 *
 *   <BaseButton className={withClassName("mac-push-button", className)} />
 */
export function withClassName<State>(
  base: string,
  className: StatefulClassName<State>,
): string | ((state: State) => string) {
  if (typeof className === "function") {
    return (state: State) => cn(base, className(state));
  }
  return cn(base, className);
}
