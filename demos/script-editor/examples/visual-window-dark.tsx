import { useLayoutEffect, useRef } from "react";
import { ScriptEditor } from "../script-editor";

/**
 * Visual comparison target: the whole Script Editor window of the Dark Aqua capture, whose
 * title has no number and whose script is scrolled 10 pt down. Reference crop (2x pixels)
 * x=112 y=76 w=1400 h=1410, i.e. the 700 x 705 pt frame, over the capture's transparent
 * margin (matte white).
 */
export default function VisualWindowDark() {
  const frame = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const script = frame.current?.querySelector('[aria-label="Script"]');
    if (script) script.scrollTop = 10;
  }, []);
  return (
    <div
      ref={frame}
      style={{
        position: "relative",
        overflow: "hidden",
        width: 700,
        height: 705,
        background: "#ffffff",
      }}
    >
      <ScriptEditor
        title="Untitled (Untitled Mail Rule Action.scptd)"
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
