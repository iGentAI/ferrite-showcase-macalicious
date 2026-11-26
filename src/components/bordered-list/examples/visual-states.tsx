import {
  BorderedList,
  BorderedListGroupRow,
  BorderedListRow,
  BorderedListRows,
} from "macalicious/bordered-list";
import { GradientButton } from "macalicious/gradient-button";

/**
 * Visual check target for the states no screenshot shows: a 120 x 125 pt bordered list on
 * the window background with a group row (23 pt), then four 20 pt rows without text, the
 * third disabled, the first selected, and an attached bar with one button. The rows fill the
 * frame exactly. The comparisons click rows and use the keyboard.
 */
export default function VisualStates() {
  return (
    <div style={{ width: 120, height: 125, background: "light-dark(#ececec, #323232)" }}>
      <BorderedList
        style={{ width: 120, height: 125 }}
        footer={<GradientButton glyph="add" aria-label="Add" />}
      >
        <BorderedListRows aria-label="States" defaultValue={["a"]}>
          <BorderedListGroupRow aria-hidden="true" />
          <BorderedListRow value="a" aria-label="a" />
          <BorderedListRow value="b" aria-label="b" />
          <BorderedListRow value="c" aria-label="c" disabled />
          <BorderedListRow value="d" aria-label="d" />
        </BorderedListRows>
      </BorderedList>
    </div>
  );
}
