import { Checkbox } from "macalicious/checkbox";
import { Form, FormRow } from "macalicious/form";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

/**
 * Rows whose label names more than one control, as in Messages > Preferences > General: a
 * stack of checkboxes, and a pop-up button followed by text.
 */
export default function Groups() {
  return (
    <Form>
      <FormRow label="Keep messages:">
        <PopUpButton defaultValue="forever" style={{ width: 200 }}>
          <PopUpButtonItem value="forever">Forever</PopUpButtonItem>
          <PopUpButtonItem value="year">One Year</PopUpButtonItem>
          <PopUpButtonItem value="month">30 Days</PopUpButtonItem>
        </PopUpButton>
      </FormRow>
      <FormRow label="Application:" kind="group" orientation="vertical">
        <Checkbox>Save history when conversations are closed</Checkbox>
        <Checkbox defaultChecked>Notify me about messages from unknown contacts</Checkbox>
        <Checkbox>Notify me when my name is mentioned</Checkbox>
        <Checkbox defaultChecked>Play sound effects</Checkbox>
      </FormRow>
      <FormRow label="Show:" kind="group">
        <PopUpButton defaultValue="12" aria-label="Hours shown" style={{ width: 54 }}>
          <PopUpButtonItem value="8">8</PopUpButtonItem>
          <PopUpButtonItem value="12">12</PopUpButtonItem>
        </PopUpButton>
        <Label>hours at a time</Label>
      </FormRow>
    </Form>
  );
}
