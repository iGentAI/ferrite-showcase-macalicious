import { Terminal } from "../terminal";
import { DEFAULT_FRAME } from "../terminal-frame";

/** The Terminal window alone, 24 pt from each edge, for its pixel checks. */
export default function VisualWindow() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: DEFAULT_FRAME.width + 48,
        height: DEFAULT_FRAME.height + 48,
        padding: 24,
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <Terminal style={DEFAULT_FRAME} />
    </div>
  );
}
