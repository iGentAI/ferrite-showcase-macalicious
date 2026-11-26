import { useCallback, useState } from "react";

// State that a prop can take over, the way Base UI's components do it: `value` controls it,
// `defaultValue` only starts it, and `onChange` hears every change either way.
//
//   const [value, setValue] = useControlled(props.value, props.defaultValue ?? [], props.onValueChange);
export function useControlled<T>(
  controlled: T | undefined,
  initial: T,
  onChange?: (value: T) => void,
): [T, (value: T) => void] {
  const [own, setOwn] = useState(initial);
  const set = useCallback(
    (value: T) => {
      setOwn(value);
      onChange?.(value);
    },
    [onChange],
  );
  return [controlled === undefined ? own : controlled, set];
}
