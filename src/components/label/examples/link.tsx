import { Label } from "macalicious/label";

const caption = { display: "block", marginBottom: 4 } as const;

/**
 * A link is a label rendered as a real `<a>`. Pressed and keyboard-focused are transient, so
 * this gallery pins them with `data-force`.
 */
export default function Link() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: 28 }}>
      <div>
        <Label textStyle="mini" color="secondary" style={caption}>
          Normal
        </Label>
        <Label textStyle="small" color="link" render={<a href="#link" />}>
          Details…
        </Label>
      </div>
      <div>
        <Label textStyle="mini" color="secondary" style={caption}>
          Pressed
        </Label>
        <Label textStyle="small" color="link" data-force="pressed" render={<a href="#link" />}>
          Details…
        </Label>
      </div>
      <div>
        <Label textStyle="mini" color="secondary" style={caption}>
          Keyboard focus
        </Label>
        <Label textStyle="small" color="link" data-force="focus" render={<a href="#link" />}>
          Details…
        </Label>
      </div>
    </div>
  );
}
