import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import type { CSSProperties } from "react";

const blocks = "\u2588\u2588\u2588\u2588\u2588\u2588";

/**
 * Visual check target for forced colours: a 120 x 70 pt bordered list of two 34 pt rows with
 * a title and a subtitle, whose text is runs of full blocks, so that a pixel of it can be
 * read whatever the font. The colour of text on an emphasised selection is given a marker
 * value (red): in forced colours a selected row must not show it, and its subtitle must not
 * keep the secondary label colour, because both lines are the system's highlight text.
 */
export default function VisualForcedColors() {
  return (
    <BorderedList
      style={
        {
          width: 120,
          height: 70,
          "--mac-color-selected-content-text": "#ff0000",
        } as CSSProperties
      }
    >
      <BorderedListRows aria-label="Forced colours" rowHeight={34} defaultValue={["b"]}>
        <BorderedListRow value="a" aria-label="a" title={blocks} subtitle={blocks} />
        <BorderedListRow value="b" aria-label="b" title={blocks} subtitle={blocks} />
      </BorderedListRows>
    </BorderedList>
  );
}
