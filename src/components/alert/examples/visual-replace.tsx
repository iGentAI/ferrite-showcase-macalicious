import { Alert, AlertButtons, AlertClose, AlertMessage, AlertPopup } from "macalicious/alert";
import { WindowControls } from "macalicious/window-controls";
import { type CSSProperties, useState } from "react";

/**
 * Visual comparison target: Finder's Replace alert (a copy conflict), the whole window capture
 * with its shadow (1022 x 424 px, 511 x 212 pt; the frame is 399 x 100 pt at 56, 38).
 *
 * The compact alert: no title bar, window controls on the window background with close and
 * zoom disabled, a 32 pt icon, 11 pt text and three small buttons, none of them the default.
 * The document icon and its caution badge are Apple's artwork: the icon area is left empty and
 * the comparisons mask it. The dark capture's window background is the tinted #303235.
 */
export default function VisualReplace() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={
        {
          position: "relative",
          width: 511,
          height: 212,
          overflow: "hidden",
          background: "white",
          "--mac-color-window-background": "light-dark(#ececec, #303235)",
        } as CSSProperties
      }
    >
      <Alert defaultOpen>
        <AlertPopup
          size="small"
          controls={<WindowControls closeDisabled zoomDisabled />}
          container={stage}
          style={
            {
              position: "absolute",
              left: 56,
              margin: 0,
              "--mac-alert-top": "38px",
            } as CSSProperties
          }
        >
          <AlertMessage style={{ width: 320 }}>
            An item named “Pippin - Apple's Forgotten Game Console.mov” already exists in this
            location. Do you want to replace it with the one you’re moving?
          </AlertMessage>
          <AlertButtons>
            <AlertClose>Keep Both</AlertClose>
            <AlertClose>Stop</AlertClose>
            <AlertClose>Replace</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </div>
  );
}
