import { RadioButton, RadioGroup } from "macalicious/radio-button";

/** A horizontal group, as Voice Feedback in the Siri pane: 10 pt from a title to the next button. */
export default function Horizontal() {
  return (
    <RadioGroup orientation="horizontal" defaultValue="on" aria-label="Voice Feedback">
      <RadioButton value="on">On</RadioButton>
      <RadioButton value="off">Off</RadioButton>
    </RadioGroup>
  );
}
