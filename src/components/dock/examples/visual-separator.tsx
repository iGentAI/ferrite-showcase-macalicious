import { Dock, DockItem, DockSeparator } from "macalicious/dock";

/**
 * Visual comparison target: the separator slot between the last application and the first
 * stack. Reference crop (2x pixels) x=2728 y=1930 w=82 h=170 of the Desktop screenshots, 41
 * by 85 pt, which lies between the two icons: the line is 20 pt from the crop's left edge.
 * The wallpaper is the mean colour of the photograph above the shelf there.
 */
export default function VisualSeparator() {
  const icon = <span style={{ width: 52, height: 52, borderRadius: 12, background: "#8e8e93" }} />;
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 41,
        height: 85,
        background: "light-dark(#122a40, #0a1828)",
      }}
    >
      <Dock style={{ left: -67, right: "auto", margin: 0 }}>
        <DockItem label="Settings" icon={icon} />
        <DockSeparator />
        <DockItem label="Downloads" icon={icon} />
      </Dock>
    </div>
  );
}
