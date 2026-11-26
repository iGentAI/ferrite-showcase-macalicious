import { useRef, useState } from "react";
import { Notes } from "../notes";
import { type NotesActions, NotesMenuBar, type NotesStatus } from "../notes-menus";

/**
 * Notes with the five notes of the reference screenshots under its menu bar. Select a note,
 * type in it, make a new one, search, add a folder. Select some text and style it from the
 * Format menu, the toolbar's format button or the keyboard (Command-B, Command-I, Command-U;
 * Control off Apple platforms); Show Fonts and Show Colors open their panels under the window.
 * The margins leave room for the window's shadow.
 */
export default function Basic() {
  const actions = useRef<NotesActions>(null);
  const [status, setStatus] = useState<NotesStatus>();
  const [panels, setPanels] = useState<HTMLDivElement | null>(null);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <NotesMenuBar actions={actions} status={status} />
      <div style={{ overflowX: "auto", padding: "7px 48px 67px" }}>
        <Notes actionsRef={actions} onStatusChange={setStatus} panelContainer={panels} />
        <div ref={setPanels} style={{ marginBlockStart: 24 }} />
      </div>
    </div>
  );
}
