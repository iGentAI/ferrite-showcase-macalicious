import { Music } from "../music";
import { defaultAlbums } from "../music-data";

/** The capture's library holds one album; its cover there is near black, as this one's is. */
const ALBUMS = defaultAlbums.slice(0, 1);

/**
 * Visual comparison target: the whole Music window with Albums selected and nothing loaded.
 * Reference crop (2x pixels) x=112 y=76 w=2440 h=1440, i.e. the 1220 x 720 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1220,
        height: 720,
        background: "#ffffff",
      }}
    >
      <Music albums={ALBUMS} material="opaque" style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
