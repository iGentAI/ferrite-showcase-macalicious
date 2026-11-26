import { Terminal } from "../terminal";
import { DEFAULT_FRAME } from "../terminal-frame";

/**
 * Terminal, working: type at the prompt. This page has no drive, so commands that would change a
 * file say so; on the Ferrite desktop the same window works on the person's files.
 */
export default function Basic() {
  return (
    <div style={{ display: "grid", placeItems: "center", padding: 24 }}>
      <Terminal style={DEFAULT_FRAME} />
    </div>
  );
}
