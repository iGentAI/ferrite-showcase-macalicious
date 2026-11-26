import { SavePanel } from "macalicious/save-panel";

const places = [
  { value: "documents", label: "Documents" },
  { value: "desktop", label: "Desktop" },
];

/**
 * Visual check target: the collapsed form on the window background with the 20 pt margins of
 * a sheet, 440 pt wide. No screenshot shows a Save panel, so the comparison reads pixels: the
 * three controls 30 pt apart in one column, and the two buttons at the trailing end.
 */
export default function VisualCollapsed() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 440,
        padding: 20,
        background: "var(--mac-color-window-background)",
      }}
    >
      <SavePanel locations={places} location="documents" defaultTags={[]} />
    </div>
  );
}
