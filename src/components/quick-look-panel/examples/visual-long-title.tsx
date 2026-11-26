import { QuickLookPanel, QuickLookPanelButton } from "macalicious/quick-look-panel";

/**
 * Visual check, without a reference: a name too long for the bar is cut short and stays
 * between the discs and the actions. The title's box is painted magenta so that the check can
 * read where it ends; the panel stands on white, over which the bar's material is a flat
 * colour.
 */
export default function VisualLongTitle() {
  return (
    <div style={{ width: 300, height: 38, overflow: "hidden", background: "#ffffff" }}>
      <QuickLookPanel
        width={300}
        height={200}
        aria-label="A very long file name"
        title={
          <span style={{ background: "#ff00ff", color: "#ff00ff" }}>
            A very long file name that cannot fit in the bar beside the actions.jpg
          </span>
        }
        actions={
          <QuickLookPanelButton style={{ width: 120, padding: 0 }}>Open</QuickLookPanelButton>
        }
      />
    </div>
  );
}
