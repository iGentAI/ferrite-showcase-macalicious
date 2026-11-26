import { Form, FormRow } from "macalicious/form";

/* The pane sets these three keys in bold, in a dimmer label colour. */
const key = (text: string) => (
  <span style={{ color: "var(--mac-color-label-tertiary)", fontWeight: 700 }}>{text}</span>
);

/**
 * Visual comparison target: Location, Kind and Status of the selected printer in the Printers &
 * Scanners pane, three `value` rows.
 *
 * Reference crop (2x pixels) x=700 y=452 w=520 h=128, i.e. 260 x 64 pt. The rows are 22 pt
 * apart (11 pt text on 14 pt lines with 8 pt between them); the keys' ink ends at x=835 and
 * the values' starts at x=855.
 */
export default function VisualPrinterValues() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 260,
        height: 64,
        paddingTop: 3,
        background: "light-dark(#e2e2e2, #363637)",
      }}
    >
      <Form
        render={<div />}
        size="small"
        labelWidth={68.5}
        style={{ "--mac-form-row-gap": "8px" } as never}
      >
        <FormRow kind="value" label={key("Location:")}>
          Castle
        </FormRow>
        <FormRow kind="value" label={key("Kind:")}>
          Printopia-D1FBAAFB-AirPrint
        </FormRow>
        <FormRow kind="value" label={key("Status:")}>
          Idle
        </FormRow>
      </Form>
    </div>
  );
}
