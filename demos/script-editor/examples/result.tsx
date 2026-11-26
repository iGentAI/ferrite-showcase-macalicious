import { Label } from "macalicious/label";
import { useState } from "react";
import { ScriptEditor } from "../script-editor";
import { sampleSource } from "../script-editor-data";

/**
 * A script with a result. Press Run, the triangle: the Result view shows what the last
 * statement gave, and the Log view what `log` wrote. Take the closing quote off a string and
 * press Compile to see an error.
 */
export default function Result() {
  const [status, setStatus] = useState("The script has not run yet.");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <ScriptEditor
        title="Untitled"
        defaultSource={sampleSource}
        defaultDescription="Greets, and gives the answer."
        onRun={(result) =>
          setStatus(result ? `The script gave ${result}.` : "The script gave no result.")
        }
        width="100%"
        height={420}
        style={{ maxWidth: 700 }}
      />
      <Label color="secondary" role="status">
        {status}
      </Label>
    </div>
  );
}
