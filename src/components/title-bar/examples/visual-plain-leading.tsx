import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the leading end of the plain 22 pt title bar of the System
 * Information window, whose title is centred on the window and therefore outside the crop.
 *
 * Reference crop x=112 y=76 w=530 h=44 (265 x 22 pt) of a 751 pt window: the top-left corner,
 * the window controls and the bar. Nothing is masked.
 */
export default function VisualPlainLeading() {
  return (
    <div
      style={{
        position: "relative",
        width: 265,
        height: 22,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={751} height={200} style={{ position: "absolute" }}>
        <TitleBar title="MacBook Pro" controls={<WindowControls />} />
      </Window>
    </div>
  );
}
