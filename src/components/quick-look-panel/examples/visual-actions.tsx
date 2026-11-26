import { QuickLookPanel, QuickLookPanelButton } from "macalicious/quick-look-panel";

/**
 * Visual comparison target: the trailing end of the Quick Look bar with its four buttons
 * (Rotate, Markup, Open with Preview, Share). Reference crop (2x pixels) w=614 h=76 ending at
 * the panel's top-right corner: x=2650 y=90 in the light capture, x=2556 y=118 in the dark
 * one, i.e. 307 x 38 pt.
 *
 * The three glyphs are Apple artwork and are left out and masked, as is the title of the text
 * button, whose measured width is set because text is set in the fallback font off Apple
 * platforms. The backdrop is the colour that gives the bar colour measured here; in the dark
 * capture the picture behind the bar gets darker towards the right, and so does the backdrop.
 */
export default function VisualActions() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 307,
        height: 38,
        background:
          "linear-gradient(to right, light-dark(#80a1bd, #1d2838), light-dark(#80a1bd, #0d1e36) 35%)",
      }}
    >
      <QuickLookPanel
        title="10-9.jpg"
        width={892}
        height={547}
        style={{ position: "absolute", top: 0, right: 0 }}
        actions={
          <>
            <QuickLookPanelButton aria-label="Rotate Left" />
            <QuickLookPanelButton aria-label="Markup" />
            <QuickLookPanelButton style={{ width: 136.5, padding: 0 }}>
              Open with Preview
            </QuickLookPanelButton>
            <QuickLookPanelButton aria-label="Share" />
          </>
        }
      />
    </div>
  );
}
