import { GalleryView } from "macalicious/gallery-view";
import { type CSSProperties, Fragment } from "react";

// Stand-in pictures, drawn here: a two-colour gradient per item. Finder shows desktop
// pictures (Apple artwork); the comparison masks them.
const art = (index: number) =>
  `linear-gradient(160deg, hsl(${index * 47} 55% 60%), hsl(${index * 47 + 60} 60% 30%))`;

const label = (index: number) => `10-${index + 1}.jpg`;
const preview = (index: number) => (
  <div style={{ width: "100%", aspectRatio: "16 / 9", background: art(index) }} />
);
const thumbnail = (index: number) => (
  <div style={{ width: 48, height: index < 4 ? 36 : 27, background: art(index) }} />
);

const small = "var(--mac-font-control-small)";
const grey = "var(--mac-color-label-secondary)";
const rule = { height: 1, background: "light-dark(#c0c0c0, #565759)" };
const separator = { height: 1, background: "light-dark(#e6e6e6, #343638)" };
const between = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const details = [
  ["Created", "April 17, 2018 at 10:11 PM"],
  ["Modified", "April 17, 2018 at 10:11 PM"],
  ["Last opened", "5/29/18, 10:33 AM"],
  ["Dimensions", "5120×2880"],
  ["Resolution", "240×240"],
];

// A stand-in for Finder's Preview pane, laid out here with the measured rules: it is the
// example's content, not part of the component, which gives the pane, its width and divider.
function Pane() {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        padding: "0 20px 20px",
        font: small,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 94 }}>
        <div style={{ width: 44, height: 28, background: art(8) }} />
        <div>
          <div style={{ font: "600 15px / 18px var(--mac-font-family-system)" }}>10-9.jpg</div>
          <div style={{ color: grey }}>JPEG image - 9.4 MB</div>
        </div>
      </div>
      <div style={rule} />
      <div style={{ ...between, height: 32, font: "var(--mac-font-body-emphasized)" }}>
        Information
        <span style={{ font: small, color: "var(--mac-color-link)" }}>Show More</span>
      </div>
      {details.map(([name, value], index) => (
        <Fragment key={name}>
          {index > 0 && <div style={separator} />}
          <div style={{ ...between, height: 19 }}>
            <span style={{ color: grey }}>{name}</span>
            {value}
          </div>
        </Fragment>
      ))}
      <div style={{ ...rule, marginTop: 14 }} />
      <div style={{ marginTop: 9, font: "var(--mac-font-body-emphasized)" }}>Tags</div>
      <div style={{ marginTop: 6, color: "var(--mac-color-label-tertiary)" }}>Add Tags...</div>
      <div style={{ display: "flex", margin: "auto -9px 0", color: grey, textAlign: "center" }}>
        {["Rotate Left", "Markup", "More..."].map((action) => (
          <div key={action} style={{ flex: 1 }}>
            <div
              style={{
                width: 16,
                height: 16,
                margin: "0 auto 6px",
                border: "1px solid",
                borderRadius: 8,
                boxSizing: "border-box",
              }}
            />
            {action}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Visual comparison target: Finder's gallery view as the Dark Aqua screenshot has it, in a
 * larger window than the Aqua one. Reference crop (2x pixels) x=442 y=236 w=2200 h=1384, i.e.
 * 1100 x 692 pt: the 856 pt gallery (a 792 x 445.5 pt preview above the strip, ninth
 * thumbnail selected), the 1 pt divider and 243 pt of the 250 pt Preview pane. The crop
 * leaves out the window's lighter 1 pt border and its rounded corner, so the 1107 x 693 pt
 * view is clipped by the wrapper. The background is the content colour measured in that
 * window, which the desktop picture tints. Preview, thumbnails and every text are stand-ins
 * and masked.
 */
export default function VisualFinderDark() {
  return (
    <div style={{ width: 1100, height: 692, overflow: "hidden" }}>
      <GalleryView
        aria-label="Downloads"
        count={20}
        getItemLabel={label}
        renderPreview={preview}
        renderThumbnail={thumbnail}
        defaultValue={[8]}
        inspector={<Pane />}
        style={
          {
            width: 1107,
            height: 693,
            "--mac-gallery-view-background": "light-dark(#ffffff, #1e2022)",
          } as CSSProperties
        }
      />
    </div>
  );
}
