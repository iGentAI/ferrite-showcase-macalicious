import { PushButton } from "macalicious/push-button";
import { SystemImage } from "macalicious/system-image";

/**
 * The two forms apps add to the standard push button: a compact bezel around one image, and an
 * emphasised title. Beside each is the standard button for comparison.
 */
export default function Forms() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <PushButton compact aria-label="Share">
        <SystemImage name="share" />
      </PushButton>
      <PushButton aria-label="Share, standard width">
        <SystemImage name="share" />
      </PushButton>
      <PushButton variant="emphasized">Done</PushButton>
      <PushButton variant="emphasized" disabled>
        Done
      </PushButton>
      <PushButton>Edit</PushButton>
    </div>
  );
}
