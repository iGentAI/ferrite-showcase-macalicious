import { AppStore } from "../app-store";

/**
 * Visual comparison target: the whole App Store window of both captures, on Discover, with
 * the content pane scrolled by the 20 pt over the hero, so that the hero's bottom edge is
 * 340 pt under the window's top, as captured.
 * Reference crop (2x pixels) x=112 y=76 w=2492 h=1714, i.e. the 1246 x 857 pt frame, over the
 * capture's transparent margin (matte white). The two captures show the same content, so the
 * dark comparison renders this example too.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1246,
        height: 857,
        background: "var(--mac-app-store-visual-matte)",
      }}
    >
      <AppStore
        material="opaque"
        defaultScrollTop={20}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
