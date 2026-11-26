import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { type CSSProperties, useState } from "react";

/**
 * Visual comparison target: Finder's Empty Trash alert, the whole window capture with its
 * shadow (1064 x 526 px, 532 x 263 pt; the frame is 420 x 151 pt at 56, 38).
 *
 * The alert is rendered into this box instead of the document body, so that it is part of the
 * capture, and placed where the capture has it. The Trash icon is Apple's artwork: the icon
 * area is left empty and the comparisons mask it. The dark capture's window background is the
 * tinted #303031, not the catalog window colour.
 */
export default function VisualEmptyTrash() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={
        {
          position: "relative",
          width: 532,
          height: 263,
          overflow: "hidden",
          background: "white",
          "--mac-color-window-background": "light-dark(#ececec, #303031)",
        } as CSSProperties
      }
    >
      <Alert defaultOpen>
        <AlertPopup
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
          <AlertMessage style={{ width: 290 }}>
            Are you sure you want to permanently erase the items in the Trash?
          </AlertMessage>
          <AlertInformativeText>You can’t undo this action.</AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose render={<DefaultButton />} style={{ width: 114 }}>
              Empty Trash
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </div>
  );
}
