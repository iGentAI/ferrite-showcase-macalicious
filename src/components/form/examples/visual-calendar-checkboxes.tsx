import { Checkbox } from "macalicious/checkbox";
import { Form, FormRow } from "macalicious/form";

/**
 * Visual comparison target: the two stacked checkboxes of Calendar Preferences > General, a
 * `vertical` row without a label.
 *
 * Reference crop (2x pixels) x=176 y=928 w=360 h=84, i.e. 180 x 42 pt. The boxes are 14 pt
 * square, 4 pt from the crop's left and top edges, and 20 pt apart: 6 pt between them.
 */
export default function VisualCalendarCheckboxes() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 180,
        height: 42,
        padding: "4px 0 0 4px",
        background: "light-dark(#ececec, #303032)",
      }}
    >
      <Form render={<div />} labelWidth={0} style={{ "--mac-form-label-gap": "0px" } as never}>
        <FormRow orientation="vertical">
          <Checkbox>Show Birthdays calendar</Checkbox>
          <Checkbox defaultChecked>Show Holidays calendar</Checkbox>
        </FormRow>
      </Form>
    </div>
  );
}
