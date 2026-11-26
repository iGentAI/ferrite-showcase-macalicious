import { PreferencePaneIcon } from "macalicious/preference-pane-icon";

function Block() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">
      <path d="M0 0h40v40H0z" fill="#6aa6d8" />
    </svg>
  );
}

/**
 * Fixture for the states no reference screenshot shows. `preference-pane-icon.visual.json`
 * puts it into each state with real input and checks pixels against the spec's values.
 *
 * 180 x 101 pt: 8 pt of page on every side around two 82 x 85 pt slots. Each artwork is a
 * 40 pt block of one colour (#6aa6d8) filling the allocation: the first is x 29 to 69, the
 * disabled one x 111 to 151, both y 13 to 53.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", padding: 8 }}>
      <PreferencePaneIcon id="pane" title="General">
        <Block />
      </PreferencePaneIcon>
      <PreferencePaneIcon title="Sidecar" disabled>
        <Block />
      </PreferencePaneIcon>
    </div>
  );
}
