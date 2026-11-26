import { TokenFieldCompletions } from "macalicious/token-field-completions";

/**
 * Fixture for the list of completions, which no reference screenshot shows.
 * `token-field-completions.visual.json` types into the field and checks the pixels it expects.
 *
 * 216 x 112 pt: 8 pt of page on every side of a 200 pt field. The field's edge is x 8 to 208
 * and y 8 to 30; its text box is 19 pt high from y 9.5. With the token "Work" before it, the
 * list hangs under the text box, 3 pt below it: from y 31.5, three 19 pt rows (from y 35.5,
 * 54.5 and 73.5) between 4 pt of padding, ending at y 96.5.
 */
export default function VisualStates() {
  return (
    <div style={{ padding: 8, height: 96, lineHeight: 0 }}>
      <TokenFieldCompletions
        id="field"
        aria-label="Tags"
        completions={["Travel", "Trips", "Train", "Home"]}
        defaultValue={["Work"]}
        style={{ width: 200 }}
      />
    </div>
  );
}
