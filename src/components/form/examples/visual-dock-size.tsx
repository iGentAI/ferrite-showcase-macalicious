import { Form, FormRow } from "macalicious/form";
import { Label } from "macalicious/label";
import { Slider } from "macalicious/slider";

/* A label centred under a tick mark: a box without width at the mark, the text centred on it. */
const mark = { display: "flex", justifyContent: "center", width: 0, whiteSpace: "nowrap" } as const;
/* A label is at most as wide as its container, which here has no width. */
const free = { flex: "none", maxWidth: "none" } as const;

/**
 * Visual comparison target: the Size slider of the Dock pane with "Small" and "Large" under its
 * end tick marks.
 *
 * Reference crop (2x pixels) x=626 y=190 w=444 h=84, i.e. 222 x 42 pt. The track runs from
 * x=645 to 1048 (202 pt), 9.5 pt from the crop's left edge; the thumb's fill starts 4.5 pt
 * under its top. The labels' ink spans x=636..1060 and their capitals start at y=249, 6 pt
 * under the tick marks, which end at y=237.
 */
export default function VisualDockSize() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 222,
        height: 42,
        padding: "4.5px 9.5px 0",
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <Form render={<div />} labelWidth={0} style={{ "--mac-form-label-gap": "0px" } as never}>
        <FormRow align="start">
          <div style={{ width: 202 }}>
            <Slider aria-label="Size" tickMarks={2} max={374} defaultValue={160} />
            <div
              aria-hidden="true"
              style={{ display: "flex", justifyContent: "space-between", padding: "2px 7.5px 0" }}
            >
              <span style={mark}>
                <Label textStyle="small" style={free}>
                  Small
                </Label>
              </span>
              <span style={mark}>
                <Label textStyle="small" style={free}>
                  Large
                </Label>
              </span>
            </div>
          </div>
        </FormRow>
      </Form>
    </div>
  );
}
