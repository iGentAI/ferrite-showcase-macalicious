import { BootCampAssistant } from "../boot-camp-assistant";

/**
 * Visual comparison target: the Introduction step, cropped at the window's frame from the
 * full-screen captures (1566 x 1096 px, 783 x 548 pt). The desktop picture shows at the four
 * corners and around the frame, so the box clips the shadow and the comparisons mask the
 * corners.
 *
 * The captures' window background is the one tinted by the desktop picture behind the window,
 * which the box sets as the library's own example of this window does. The artwork column's
 * placeholder stands where the captures have Boot Camp's diamonds; the comparisons mask that
 * area, which reaches over the left edge of the text box.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        width: 783,
        height: 548,
        overflow: "hidden",
        ["--mac-color-window-background" as string]: "var(--mac-color-window-background-tinted)",
      }}
    >
      <BootCampAssistant />
    </div>
  );
}
