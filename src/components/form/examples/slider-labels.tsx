import { Form, FormRow } from "macalicious/form";
import { Label } from "macalicious/label";
import { Slider } from "macalicious/slider";

/* A label centred under a tick mark: a box without width at the mark, the text centred on it. */
const mark = { display: "flex", justifyContent: "center", width: 0, whiteSpace: "nowrap" } as const;
/* A label is at most as wide as its container, which here has no width. */
const free = { flex: "none", maxWidth: "none" } as const;

/**
 * Labels under the end tick marks, as the Dock pane's Size slider has them: 11 pt text centred
 * on the first and the last mark, which are half a thumb (7.5 pt) in from the ends of the
 * track.
 */
function EndLabels({ min, max }: { min: string; max: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ display: "flex", justifyContent: "space-between", padding: "2px 7.5px 0" }}
    >
      <span style={mark}>
        <Label textStyle="small" style={free}>
          {min}
        </Label>
      </span>
      <span style={mark}>
        <Label textStyle="small" style={free}>
          {max}
        </Label>
      </span>
    </div>
  );
}

export default function SliderLabels() {
  return (
    <Form render={<div />} style={{ width: 320 }}>
      <FormRow label="Size:" align="start">
        <div style={{ width: 202 }}>
          <Slider
            aria-label="Size"
            tickMarks={2}
            defaultValue={40}
            getAriaValueText={(_, value) => (value < 50 ? "Small" : "Large")}
          />
          <EndLabels min="Small" max="Large" />
        </div>
      </FormRow>
      <FormRow label="Tracking speed:" align="start">
        <div style={{ width: 202 }}>
          <Slider
            aria-label="Tracking speed"
            tickMarks={10}
            tickMarkValuesOnly
            max={9}
            defaultValue={3}
          />
          <EndLabels min="Slow" max="Fast" />
        </div>
      </FormRow>
    </Form>
  );
}
