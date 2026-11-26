import { Label } from "macalicious/label";
import { useState } from "react";
import { Dictionary } from "../dictionary";

/**
 * The window opened on all sources: an entry then has a section for every source that knows
 * the word. The line under the window reports what `onLookUp` was called with; it starts with
 * the first word that "d" finds, which the window opens on.
 */
export default function Sources() {
  const [word, setWord] = useState<string | null>("desktop");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <Dictionary
        defaultQuery="d"
        defaultScope="all"
        onLookUp={setWord}
        width="100%"
        height={460}
        style={{ maxWidth: 690 }}
      />
      <Label color="secondary" role="status">
        {word ? `Showing the entry for “${word}”.` : "No entry is shown."}
      </Label>
    </div>
  );
}
