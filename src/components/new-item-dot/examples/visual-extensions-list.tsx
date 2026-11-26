import { NewItemDot } from "macalicious/new-item-dot";

/**
 * Visual comparison target: the dot beside an extension in System Preferences › Extensions.
 * Reference crop (2x pixels) x=658 y=880 w=24 h=24, i.e. 12 x 12 pt with the 6 pt dot at
 * (3, 3) pt on the white list background.
 */
export default function VisualExtensionsList() {
  return (
    <div
      style={{
        position: "relative",
        width: 12,
        height: 12,
        background: "light-dark(#ffffff, #1d1e1f)",
      }}
    >
      <NewItemDot style={{ position: "absolute", left: 3, top: 3 }} />
    </div>
  );
}
