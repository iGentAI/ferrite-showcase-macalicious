import { MusicPreferences } from "../music-preferences";

/**
 * Visual comparison target: the whole frame of Music's Preferences on the General pane.
 * Reference crop (2x pixels) x=112 y=76 w=1066 h=584, i.e. 533 x 292 pt, over the capture's
 * transparent margin (matte white).
 */
export default function VisualPreferences() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 533,
        height: 292,
        background: "#ffffff",
      }}
    >
      <MusicPreferences animated={false} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
