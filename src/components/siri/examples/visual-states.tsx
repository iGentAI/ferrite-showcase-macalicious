import { Siri, SiriCard } from "macalicious/siri";

/**
 * Visual check target for what no screenshot shows: a short window, listening at full level
 * with the waveform still, on the flat grey #757575 over which the HUD material measures
 * #383838. The window is at 12, 12 and 200 pt tall; its buttons are pressed and focused with
 * real input by the comparisons.
 */
export default function VisualStates() {
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
      <Siri
        listening
        animated={false}
        level={1}
        onClose={() => {}}
        onHelp={() => {}}
        onListen={() => {}}
        style={{ height: 200 }}
      >
        <SiriCard title="Result">
          <div style={{ height: 60 }} />
        </SiriCard>
      </Siri>
    </div>
  );
}
