import { Automator } from "../automator";

/**
 * Visual comparison target for a state no screenshot shows: a workflow of two steps. The
 * comparison clicks Run, which finishes at once here (`stepInterval` 0), so both steps carry
 * the mark of a step that has run and the log lists them and the run.
 */
export default function VisualRun() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1000,
        height: 868,
        background: "#ffffff",
      }}
    >
      <Automator
        stepInterval={0}
        defaultWorkflow={["ask-for-finder-items", "create-archive"]}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
