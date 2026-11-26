import { SmartSearchField, SmartSearchFieldButton } from "macalicious/smart-search-field";

/**
 * Visual comparison target: the field of the inactive Safari window behind the Picture in
 * Picture video, in both appearances (the comparison sets the window state): padlock and
 * host, the audio button and Reload.
 *
 * Reference crop (2x pixels) 514 x 26 pt around the 507 pt fill, which starts 3.5 pt from the
 * crop's left edge and 2 pt from its top: x=1056 y=116 in the light capture, x=1084 y=90 in
 * the dark one. An inactive window's toolbar is flat. The tracking token takes back the 6.5 pt
 * by which the fallback font sets the host wider than San Francisco, so the padlock is scored
 * where the capture has it.
 */
export default function VisualInactive() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 514,
        height: 26,
        padding: "2px 3.5px 0",
        background: "light-dark(#f6f6f6, #2b2c2f)",
        ["--mac-tracking-regular" as string]: "-0.59px",
      }}
    >
      <SmartSearchField
        defaultValue="https://www.youtube.com/"
        secure
        trailing={
          <>
            <SmartSearchFieldButton glyph="audio" aria-label="Mute this tab" />
            <SmartSearchFieldButton glyph="reload" aria-label="Reload this page" />
          </>
        }
      />
    </div>
  );
}
