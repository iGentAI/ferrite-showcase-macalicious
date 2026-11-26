import { PreferencePaneIcon } from "macalicious/preference-pane-icon";

function Block() {
  return (
    <svg viewBox="0 0 37 37" width="37" height="37" aria-hidden="true" focusable="false">
      <path d="M0 0h37v37H0z" fill="#6aa6d8" />
    </svg>
  );
}

/**
 * Fixture for what no screenshot shows: titles longer than two lines, one written with two
 * line breaks and one that wraps. The panes stand in a row that is as tall as its tallest
 * pane: each caption is cut after its second line, so both stay 82 x 85 pt and the row is
 * 164 x 85 pt. A third caption line would make it 99 pt tall.
 */
export default function VisualLongTitle() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      <PreferencePaneIcon title={"One\nTwo\nThree"}>
        <Block />
      </PreferencePaneIcon>
      <PreferencePaneIcon title="A caption that is far too long for its slot">
        <Block />
      </PreferencePaneIcon>
    </div>
  );
}
