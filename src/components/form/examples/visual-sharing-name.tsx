import { Form, FormRow } from "macalicious/form";
import { TextField } from "macalicious/text-field";

/**
 * Visual comparison target: the Computer Name row of System Preferences > Sharing, a text
 * field with its label and two lines of explanatory text under it.
 *
 * Reference crop (2x pixels) x=200 y=194 w=1000 h=118, i.e. 500 x 59 pt. The field's box starts
 * 114.5 pt from the crop's left edge and 4.5 pt from its top, and runs past the crop's right
 * edge; the label's box ends 8 pt before it; the text starts at the field's edge, with its
 * first line box 4.5 pt under the field.
 */
export default function VisualSharingName() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 500,
        height: 59,
        paddingTop: 4.5,
        contain: "paint",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <Form labelWidth={106.5} render={<div />} style={{ width: 574 }}>
        <FormRow
          label="Computer Name:"
          description={
            <>
              Computers on your local network can access your computer at:
              <br />
              ismh15.local
            </>
          }
        >
          <TextField defaultValue="ismh15" style={{ width: 459 }} />
        </FormRow>
      </Form>
    </div>
  );
}
