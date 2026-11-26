import { RadioButton, RadioGroup } from "macalicious/radio-button";

export default function Basic() {
  return (
    <RadioGroup defaultValue="automatic" aria-label="Show scroll bars">
      <RadioButton value="automatic">Automatically based on mouse or trackpad</RadioButton>
      <RadioButton value="scrolling">When scrolling</RadioButton>
      <RadioButton value="always">Always</RadioButton>
    </RadioGroup>
  );
}
