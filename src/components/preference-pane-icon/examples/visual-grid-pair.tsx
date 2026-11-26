import { PreferencePaneIcon, PreferencePaneIconGrid } from "macalicious/preference-pane-icon";

/** A block of one colour the size of the measured artwork; the comparisons mask it. */
function Block() {
  return (
    <svg viewBox="0 0 37 37" width="37" height="37" aria-hidden="true" focusable="false">
      <path d="M0 0h37v37H0z" fill="#6aa6d8" />
    </svg>
  );
}

/**
 * Visual comparison target: General and Desktop & Screen Saver, the first two panes of the
 * System Preferences grid, on the upper band (#e5e5e5 in Aqua, #353637 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=122 y=400 w=328 h=160, that is 164 x 80 pt: two column slots of
 * 82 pt (their centres are image x 204 and 368) from 5 pt above the 40 pt artwork allocation
 * (image y 410). The slot is 85 pt tall, so the crop cuts its last 5 pt of clear space. The
 * caption's first capitals start at image y 508, 54 pt into the crop; the second line is 14 pt
 * lower. The artwork is a stand-in block, masked in every comparison.
 */
export default function VisualGridPair() {
  return (
    <div
      style={{
        width: 164,
        height: 80,
        overflow: "hidden",
        background: "light-dark(#e5e5e5, #353637)",
      }}
    >
      <PreferencePaneIconGrid columns={2}>
        <PreferencePaneIcon title="General">
          <Block />
        </PreferencePaneIcon>
        <PreferencePaneIcon title={"Desktop &\nScreen Saver"}>
          <Block />
        </PreferencePaneIcon>
      </PreferencePaneIconGrid>
    </div>
  );
}
