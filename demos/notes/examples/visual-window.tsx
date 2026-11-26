import { Notes } from "../notes";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Notes.png, 2224 x 1556 px, i.e.
 * 1112 x 778 pt: the 1000 x 666 pt window at (56, 38) with its shadow around it, over the
 * white matte the comparison sets behind the capture's transparent margin.
 *
 * The capture was taken while the account was syncing: a spinner turns beside "iCloud" and the
 * lock, table, checklist and format buttons are dimmed. No pane has the focus, so both
 * selections are grey.
 */
export default function VisualWindow() {
  return (
    <div style={{ width: 1112, height: 778, background: "white", position: "relative" }}>
      <Notes syncing style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
