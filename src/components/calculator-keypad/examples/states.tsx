import {
  CalculatorKeypad,
  CalculatorKeypadDisplay,
  CalculatorKeypadKey,
} from "macalicious/calculator-keypad";

const columns = { "--mac-calculator-keypad-columns": "repeat(3, 76px)" } as React.CSSProperties;
const rows = { "--mac-calculator-keypad-rows": "repeat(4, 47px)" } as React.CSSProperties;

/**
 * Every key role in its normal, pressed and focused state, an armed operator and a disabled
 * key. The transient states are pinned with `data-force`, which is for documentation only.
 */
export default function States() {
  return (
    <CalculatorKeypad aria-label="Key states" style={{ ...columns, ...rows }}>
      <CalculatorKeypadDisplay aria-label="Result" fitLength={5}>
        1234567.89
      </CalculatorKeypadDisplay>
      <CalculatorKeypadKey variant="function">AC</CalculatorKeypadKey>
      <CalculatorKeypadKey>7</CalculatorKeypadKey>
      <CalculatorKeypadKey variant="operator" glyph="add" />

      <CalculatorKeypadKey variant="function" data-force="pressed" aria-label="Percent, pressed">
        %
      </CalculatorKeypadKey>
      <CalculatorKeypadKey data-force="pressed" aria-label="8, pressed">
        8
      </CalculatorKeypadKey>
      <CalculatorKeypadKey
        variant="operator"
        glyph="multiply"
        data-force="pressed"
        aria-label="Multiply, pressed"
      />

      <CalculatorKeypadKey
        variant="function"
        glyph="negate"
        data-force="focus"
        aria-label="Negate, focused"
      />
      <CalculatorKeypadKey data-force="focus" aria-label="9, focused">
        9
      </CalculatorKeypadKey>
      <CalculatorKeypadKey
        variant="operator"
        glyph="divide"
        data-force="focus"
        aria-label="Divide, focused"
      />

      <CalculatorKeypadKey variant="function" disabled>
        C
      </CalculatorKeypadKey>
      <CalculatorKeypadKey disabled>0</CalculatorKeypadKey>
      <CalculatorKeypadKey variant="operator" glyph="subtract" armed aria-label="Subtract, armed" />
    </CalculatorKeypad>
  );
}
