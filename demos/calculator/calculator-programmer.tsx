"use client";

import { CalculatorKeypad, CalculatorKeypadKey } from "macalicious/calculator-keypad";
import { type ReactNode, useState } from "react";
import {
  type CharacterMode,
  characterOf,
  type ProgrammerAction,
  type ProgrammerBase,
  type ProgrammerOperator,
  type ProgrammerState,
  type ProgrammerUnary,
} from "./calculator-bits";

export interface ProgrammerKeypadProps {
  state: ProgrammerState;
  /** The window's display, the first cell of the keypad. */
  display: ReactNode;
  /** RPN Mode's row of stack keys; with it, the equals key is Enter. */
  stackKeys?: ReactNode;
  onAction: (action: ProgrammerAction) => void;
}

const BASES: readonly ProgrammerBase[] = [8, 10, 16];
const NIBBLES = Array.from({ length: 16 }, (_, at) => 60 - at * 4);

/** The Programmer layout: bases, the character, 64 bits to click, then the keys. */
export function ProgrammerKeypad({ state, display, stackKeys, onAction }: ProgrammerKeypadProps) {
  const [mode, setMode] = useState<CharacterMode | null>(null);
  const digit = (label: string, span?: number) => (
    <CalculatorKeypadKey
      span={span}
      disabled={Number.parseInt(label, 16) >= state.base}
      onClick={() => onAction({ type: "digits", digits: label })}
    >
      {label}
    </CalculatorKeypadKey>
  );
  const operator = (label: string, name: ProgrammerOperator) => (
    <CalculatorKeypadKey
      variant="function"
      className="mac-calculator-science-key"
      armed={state.armed === name}
      onClick={() => onAction({ type: "operator", operator: name })}
    >
      {label}
    </CalculatorKeypadKey>
  );
  const unary = (label: string, name: ProgrammerUnary) => (
    <CalculatorKeypadKey
      variant="function"
      className="mac-calculator-science-key"
      onClick={() => onAction({ type: "unary", unary: name })}
    >
      {label}
    </CalculatorKeypadKey>
  );
  const glyph = (name: "add" | "subtract" | "multiply" | "divide") => (
    <CalculatorKeypadKey
      variant="operator"
      glyph={name}
      armed={state.armed === name}
      onClick={() => onAction({ type: "operator", operator: name })}
    />
  );
  const toggleMode = (next: CharacterMode) => setMode(mode === next ? null : next);
  return (
    <CalculatorKeypad
      aria-label="Keys"
      className={
        stackKeys ? "mac-calculator-programmer mac-calculator-rpn" : "mac-calculator-programmer"
      }
    >
      {display}
      <div className="mac-calculator-bar">
        {(["ascii", "unicode"] as const).map((each) => (
          <button
            key={each}
            type="button"
            className="mac-calculator-bar-button"
            aria-pressed={mode === each}
            onClick={() => toggleMode(each)}
          >
            {each === "ascii" ? "ASCII" : "Unicode"}
          </button>
        ))}
        <output className="mac-calculator-character" aria-label="Character">
          {mode ? characterOf(state.value, mode) : ""}
        </output>
        {BASES.map((base) => (
          <button
            key={base}
            type="button"
            className="mac-calculator-bar-button"
            aria-label={`Base ${base}`}
            aria-pressed={state.base === base}
            onClick={() => onAction({ type: "base", base })}
          >
            {base}
          </button>
        ))}
      </div>
      <div className="mac-calculator-bits">
        {NIBBLES.map((low) => (
          <div key={low} className="mac-calculator-nibble">
            <div className="mac-calculator-nibble-bits">
              {[low + 3, low + 2, low + 1, low].map((bit) => {
                const on = ((state.value >> BigInt(bit)) & 1n) === 1n;
                return (
                  <button
                    key={bit}
                    type="button"
                    className="mac-calculator-bit"
                    aria-label={`Bit ${bit}`}
                    aria-pressed={on}
                    onClick={() => onAction({ type: "toggleBit", bit })}
                  >
                    {on ? "1" : "0"}
                  </button>
                );
              })}
            </div>
            <span className="mac-calculator-nibble-label">{low}</span>
          </div>
        ))}
      </div>
      {stackKeys}
      {operator("AND", "and")}
      {operator("OR", "or")}
      {digit("D")}
      {digit("E")}
      {digit("F")}
      <CalculatorKeypadKey
        variant="function"
        aria-label="All clear"
        onClick={() => onAction({ type: "allClear" })}
      >
        AC
      </CalculatorKeypadKey>
      <CalculatorKeypadKey
        variant="function"
        aria-label="Clear"
        onClick={() => onAction({ type: "clear" })}
      >
        C
      </CalculatorKeypadKey>
      {operator("NOR", "nor")}
      {operator("XOR", "xor")}
      {digit("A")}
      {digit("B")}
      {digit("C")}
      {unary("RoL", "rotateLeft")}
      {unary("RoR", "rotateRight")}
      {unary("<<", "shiftLeft")}
      {unary(">>", "shiftRight")}
      {digit("7")}
      {digit("8")}
      {digit("9")}
      {unary("2's", "twos")}
      {unary("1's", "ones")}
      {operator("X<<Y", "shiftLeftBy")}
      {operator("X>>Y", "shiftRightBy")}
      {digit("4")}
      {digit("5")}
      {digit("6")}
      {glyph("divide")}
      {glyph("add")}
      {unary("Byte Flip", "byteFlip")}
      {unary("Word Flip", "wordFlip")}
      {digit("1")}
      {digit("2")}
      {digit("3")}
      {glyph("multiply")}
      {glyph("subtract")}
      <CalculatorKeypadKey
        disabled={state.base !== 16}
        onClick={() => onAction({ type: "digits", digits: "FF" })}
      >
        FF
      </CalculatorKeypadKey>
      <CalculatorKeypadKey onClick={() => onAction({ type: "digits", digits: "00" })}>
        00
      </CalculatorKeypadKey>
      {digit("0", 3)}
      {stackKeys ? (
        <CalculatorKeypadKey
          span={2}
          variant="operator"
          className="mac-calculator-science-key"
          aria-label="Enter"
          onClick={() => onAction({ type: "equals" })}
        >
          enter
        </CalculatorKeypadKey>
      ) : (
        <CalculatorKeypadKey
          span={2}
          variant="operator"
          glyph="equals"
          onClick={() => onAction({ type: "equals" })}
        />
      )}
    </CalculatorKeypad>
  );
}
