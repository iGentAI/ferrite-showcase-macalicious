import { QuickLookPanel, QuickLookPanelButton } from "macalicious/quick-look-panel";
import { SystemImage } from "macalicious/system-image";

/* A stand-in for Quick Look's rotate glyph, drawn for this example: it is Apple artwork and
   not a system image. */
const rotate = (
  <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
    <path
      d="M3.5 7h8v6h-8zM4.5 4c3-2.5 6-1 7 1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

export default function Basic() {
  return (
    <div
      style={{
        padding: 24,
        background: "linear-gradient(135deg, #5b8fc4, #2f9e8f)",
      }}
    >
      <QuickLookPanel
        title="Wave.jpg"
        width={520}
        actions={
          <>
            <QuickLookPanelButton aria-label="Rotate Left">{rotate}</QuickLookPanelButton>
            <QuickLookPanelButton>Open with Preview</QuickLookPanelButton>
            <QuickLookPanelButton aria-label="Share">
              <SystemImage name="share" />
            </QuickLookPanelButton>
          </>
        }
      >
        <div
          role="img"
          aria-label="A wave"
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            background: "linear-gradient(160deg, #3fae8a, #2c6fa8 55%, #1d3f73)",
          }}
        />
      </QuickLookPanel>
    </div>
  );
}
