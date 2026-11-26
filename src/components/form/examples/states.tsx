import { Checkbox } from "macalicious/checkbox";
import { Form, FormRow } from "macalicious/form";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { TextField } from "macalicious/text-field";

/** The three control sizes, a disabled row, and explanatory text under a checkbox. */
export default function States() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 420 }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <Form key={size} size={size} labelWidth={110}>
          <FormRow label="Network Name:">
            <PopUpButton size={size} defaultValue="home" style={{ width: 180 }}>
              <PopUpButtonItem value="home">Home</PopUpButtonItem>
              <PopUpButtonItem value="office">Office</PopUpButtonItem>
            </PopUpButton>
          </FormRow>
          <FormRow label="Password:" disabled>
            <TextField size={size} defaultValue="Not required" style={{ width: 180 }} />
          </FormRow>
          <FormRow
            description="Known networks will be joined automatically."
            style={{ "--mac-form-description-indent": "20px" } as never}
          >
            <Checkbox size={size}>Ask to join new networks</Checkbox>
          </FormRow>
        </Form>
      ))}
    </div>
  );
}
