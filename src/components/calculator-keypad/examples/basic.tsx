import {
  CalculatorKeypad,
  CalculatorKeypadDisplay,
  CalculatorKeypadKey,
} from "macalicious/calculator-keypad";
import { useState } from "react";

/** The basic calculator's keys. Digits are typed into the display; AC clears it. */
export default function Basic() {
  const [value, setValue] = useState("0");
  const type = (digit: string) => setValue((v) => (v === "0" ? digit : v + digit));
  const digit = (label: string) => (
    <CalculatorKeypadKey onClick={() => type(label)}>{label}</CalculatorKeypadKey>
  );

  return (
    <CalculatorKeypad aria-label="Calculator">
      <CalculatorKeypadDisplay aria-label="Result">{value}</CalculatorKeypadDisplay>
      <CalculatorKeypadKey variant="function" aria-label="All clear" onClick={() => setValue("0")}>
        AC
      </CalculatorKeypadKey>
      <CalculatorKeypadKey variant="function" glyph="negate" />
      <CalculatorKeypadKey variant="function" aria-label="Percent">
        %
      </CalculatorKeypadKey>
      <CalculatorKeypadKey variant="operator" glyph="divide" />
      {digit("7")}
      {digit("8")}
      {digit("9")}
      <CalculatorKeypadKey variant="operator" glyph="multiply" />
      {digit("4")}
      {digit("5")}
      {digit("6")}
      <CalculatorKeypadKey variant="operator" glyph="subtract" />
      {digit("1")}
      {digit("2")}
      {digit("3")}
      <CalculatorKeypadKey variant="operator" glyph="add" />
      <CalculatorKeypadKey span={2} onClick={() => type("0")}>
        0
      </CalculatorKeypadKey>
      <CalculatorKeypadKey aria-label="Decimal point">.</CalculatorKeypadKey>
      <CalculatorKeypadKey variant="operator" glyph="equals" />
    </CalculatorKeypad>
  );
}
