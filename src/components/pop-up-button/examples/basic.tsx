import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

export default function Basic() {
  return (
    <PopUpButton defaultValue="medium" aria-label="Sidebar icon size" style={{ width: 149 }}>
      <PopUpButtonItem value="small">Small</PopUpButtonItem>
      <PopUpButtonItem value="medium">Medium</PopUpButtonItem>
      <PopUpButtonItem value="large">Large</PopUpButtonItem>
    </PopUpButton>
  );
}
