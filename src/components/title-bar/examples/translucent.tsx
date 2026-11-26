import { TitleBar } from "macalicious/title-bar";
import { WindowControls } from "macalicious/window-controls";

/**
 * The translucent bar of a movie window, laid over the top of a picture: here a stand-in of
 * three flat bands, which show through the bar. It is the same dark bar in Aqua and in Dark
 * Aqua.
 */
export default function Translucent() {
  return (
    <div
      style={{
        position: "relative",
        width: 360,
        height: 120,
        overflow: "hidden",
        borderRadius: "var(--mac-radius-window)",
        background: "linear-gradient(90deg, #c8b89a 0 40%, #2b3140 40% 75%, #101010 75%)",
      }}
    >
      <TitleBar
        material="translucent"
        title="Movie.mov"
        controls={<WindowControls />}
        style={{ position: "absolute", inset: "0 0 auto" }}
      />
    </div>
  );
}
