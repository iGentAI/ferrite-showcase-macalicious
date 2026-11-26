import { BorderlessButton } from "macalicious/borderless-button";
import { Label } from "macalicious/label";

/** Both colours, then the focused and disabled looks, each in a line of text. */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <Label color="secondary">
        Inherited colour: <BorderlessButton>and 1 More</BorderlessButton>
      </Label>
      <Label>
        Link colour: <BorderlessButton color="link">Details</BorderlessButton>
      </Label>
      <Label>
        Keyboard focus:{" "}
        <BorderlessButton color="link" data-force="focus">
          Details
        </BorderlessButton>
      </Label>
      <Label>
        Disabled:{" "}
        <BorderlessButton color="link" disabled>
          Details
        </BorderlessButton>
      </Label>
    </div>
  );
}
