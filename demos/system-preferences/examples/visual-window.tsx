import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the whole window on the Show All grid, 668 x 554 pt, with the
 * search field focused as in both captures.
 *
 * Reference crop x=112 y=76 w=1336 h=1108: the opaque frame without its shadow. The pane
 * artwork, the account picture and every caption are masked in the layout comparison: the
 * artwork is a stand-in and the text is set in the fallback font off Apple platforms.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 554,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        searchFieldProps={{ "data-force": "focus" } as Record<string, string>}
      />
    </div>
  );
}
