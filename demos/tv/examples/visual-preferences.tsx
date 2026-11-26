import { TvPreferences } from "../tv-preferences";

/**
 * Visual comparison target: the whole frame of TV's Preferences on the General pane.
 * Reference crop (2x pixels) x=112 y=76 w=1280 h=720, i.e. 640 x 360 pt, over the capture's
 * transparent margin (matte white).
 */
export default function VisualPreferences() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 640,
        height: 360,
        background: "#ffffff",
      }}
    >
      <TvPreferences animated={false} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
