import { ForceQuit } from "../force-quit";

/**
 * Visual comparison target for a state no screenshot shows: the window while it asks before a
 * force quit. Six applications with the fifth selected, so that the selected row is clear of
 * the sheet and its shadow; the comparison clicks the button. The sheet is 420 pt wide, wider
 * than the window, so the window stands 111 pt inside a 560 pt matte.
 */
export default function VisualConfirmation() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 560,
        height: 307,
        background: "#ffffff",
      }}
    >
      <ForceQuit
        style={{ position: "absolute", top: 0, left: 111 }}
        defaultApplications={[
          { id: "mail", name: "Mail" },
          { id: "safari", name: "Safari" },
          { id: "notes", name: "Notes" },
          { id: "preview", name: "Preview" },
          { id: "textedit", name: "TextEdit" },
          { id: "finder", name: "Finder", relaunches: true },
        ]}
        defaultSelectedId="textedit"
      />
    </div>
  );
}
