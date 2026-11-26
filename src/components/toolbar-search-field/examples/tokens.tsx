import { ToolbarSearchField, ToolbarSearchFieldToken } from "macalicious/toolbar-search-field";
import { useState } from "react";

/**
 * A search by a criterion, as in Finder: Return turns the typed text into a Name token; the
 * clear button, Escape, or Delete in the empty field removes the token.
 */
export default function Tokens() {
  const [name, setName] = useState<string | null>("report");
  const [text, setText] = useState("");
  return (
    <div style={{ padding: 12, background: "var(--mac-material-titlebar)" }}>
      <ToolbarSearchField
        value={text}
        onValueChange={setText}
        tokens={
          name != null && <ToolbarSearchFieldToken criterion="Name">{name}</ToolbarSearchFieldToken>
        }
        onClear={() => setName(null)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && text) {
            setName(text);
            setText("");
          }
          if (event.key === "Backspace" && !text) setName(null);
        }}
        style={{ width: 240 }}
      />
    </div>
  );
}
