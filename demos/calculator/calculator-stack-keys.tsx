"use client";

import { CalculatorKeypadKey } from "macalicious/calculator-keypad";
import type { StackAction } from "./calculator-rpn";

const KEYS: readonly { label: string; name: string; type: StackAction["type"] }[] = [
  { label: "x↔y", name: "Swap X and Y", type: "swap" },
  { label: "R↓", name: "Roll down", type: "rollDown" },
  { label: "R↑", name: "Roll up", type: "rollUp" },
  { label: "drop", name: "Drop", type: "drop" },
];

export interface CalculatorStackKeysProps {
  /** How many grid columns each key covers, so that the row fills the layout. */
  spans: readonly [number, number, number, number];
  onAction: (action: StackAction) => void;
}

/** RPN Mode's row of stack keys. */
export function CalculatorStackKeys({ spans, onAction }: CalculatorStackKeysProps) {
  return KEYS.map((key, index) => (
    <CalculatorKeypadKey
      key={key.type}
      variant="function"
      className="mac-calculator-science-key"
      aria-label={key.name}
      span={spans[index]}
      onClick={() => onAction({ type: key.type })}
    >
      {key.label}
    </CalculatorKeypadKey>
  ));
}
