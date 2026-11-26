import { SiriAssistant } from "../siri";

/**
 * Visual check target for what no screenshot shows: a short window that waits with Siri's own
 * prompt, on the flat grey #757575 over which the HUD material measures #383838. The window is
 * at 12, 12 and 200 pt tall. The comparison clicks the orb; the window then listens for longer
 * than any capture takes, with the waveform still and at full level.
 */
export default function VisualListening() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 368,
        height: 224,
        padding: 12,
        overflow: "hidden",
        background: "#757575",
      }}
    >
      <SiriAssistant
        defaultRequest={null}
        listenDuration={600_000}
        animated={false}
        level={1}
        style={{ height: 200 }}
      />
    </div>
  );
}
