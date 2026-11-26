import { Checkbox } from "macalicious/checkbox";
import { Form, FormRow, FormSeparator } from "macalicious/form";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { TextField } from "macalicious/text-field";

export default function Basic() {
  return (
    <Form style={{ width: 400 }}>
      <FormRow
        label="Computer Name:"
        description="Computers on your local network can access your computer at: ismh15.local"
      >
        <TextField defaultValue="ismh15" style={{ width: "100%" }} />
      </FormRow>
      <FormSeparator />
      <FormRow label="Start week on:">
        <PopUpButton defaultValue="sunday" style={{ width: 180 }}>
          <PopUpButtonItem value="sunday">Sunday</PopUpButtonItem>
          <PopUpButtonItem value="monday">Monday</PopUpButtonItem>
        </PopUpButton>
      </FormRow>
      <FormRow>
        <Checkbox defaultChecked>Show Holidays calendar</Checkbox>
      </FormRow>
    </Form>
  );
}
