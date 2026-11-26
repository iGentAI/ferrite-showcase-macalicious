import {
  CalculatorKeypad,
  CalculatorKeypadDisplay,
  CalculatorKeypadKey,
} from "macalicious/calculator-keypad";

/**
 * Visual comparison target: the whole face of Calculator as the Dark Aqua capture shows it,
 * cleared: `0` in the display and the clear key reading `AC`. Same crop as `visual-entry`:
 * the window's frame inset by 2 pt (image px 116,80,456,634, i.e. 228 x 317 pt).
 */
export default function VisualCleared() {
  return (
    <div style={{ position: "relative", width: 228, height: 317, overflow: "hidden" }}>
      <CalculatorKeypad aria-label="Calculator" style={{ position: "absolute", left: -2, top: -2 }}>
        <CalculatorKeypadDisplay aria-label="Result">0</CalculatorKeypadDisplay>
        <CalculatorKeypadKey variant="function" aria-label="All clear">
          AC
        </CalculatorKeypadKey>
        <CalculatorKeypadKey variant="function" glyph="negate" />
        <CalculatorKeypadKey variant="function" aria-label="Percent">
          %
        </CalculatorKeypadKey>
        <CalculatorKeypadKey variant="operator" glyph="divide" />
        <CalculatorKeypadKey>7</CalculatorKeypadKey>
        <CalculatorKeypadKey>8</CalculatorKeypadKey>
        <CalculatorKeypadKey>9</CalculatorKeypadKey>
        <CalculatorKeypadKey variant="operator" glyph="multiply" />
        <CalculatorKeypadKey>4</CalculatorKeypadKey>
        <CalculatorKeypadKey>5</CalculatorKeypadKey>
        <CalculatorKeypadKey>6</CalculatorKeypadKey>
        <CalculatorKeypadKey variant="operator" glyph="subtract" />
        <CalculatorKeypadKey>1</CalculatorKeypadKey>
        <CalculatorKeypadKey>2</CalculatorKeypadKey>
        <CalculatorKeypadKey>3</CalculatorKeypadKey>
        <CalculatorKeypadKey variant="operator" glyph="add" />
        <CalculatorKeypadKey span={2}>0</CalculatorKeypadKey>
        <CalculatorKeypadKey aria-label="Decimal point">.</CalculatorKeypadKey>
        <CalculatorKeypadKey variant="operator" glyph="equals" />
      </CalculatorKeypad>
    </div>
  );
}
