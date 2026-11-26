import { BorderlessButton } from "macalicious/borderless-button";
import { Label } from "macalicious/label";

/**
 * Visual comparison target: "Details" at the end of the subject line in the header of Mail's
 * message, 10-15-Catalina-Light-Mail.png and 10-15-Catalina-Dark-Mail.png. Reference crop (2x
 * pixels) w=130 h=36, i.e. 65 x 18 pt, with the word's ink 17 pt from the left and its capital
 * 9 pt from the top: x=1900 y=262 in Aqua, x=1888 y=260 in Dark Aqua. The background is the
 * message pane's colour measured beside the word.
 */
export default function VisualMailDetails() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 65,
        height: 18,
        padding: "6px 0 0 16px",
        background: "light-dark(#fdfdfd, #1e1f21)",
      }}
    >
      <Label>
        <BorderlessButton color="link">Details</BorderlessButton>
      </Label>
    </div>
  );
}
