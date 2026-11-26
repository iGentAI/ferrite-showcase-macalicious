import {
  AssistantWindow,
  AssistantWindowActions,
  AssistantWindowHeading,
  AssistantWindowText,
} from "macalicious/assistant-window";
import { PushButton } from "macalicious/push-button";

/**
 * Visual comparison target: Boot Camp Assistant's Introduction step, cropped at the window's
 * frame from the full-screen capture (1566 x 1096 px, 783 x 548 pt). The desktop picture shows
 * at the four corners and around the frame, so the box clips the shadow and the comparisons
 * mask the corners.
 *
 * The diamonds at the left are Apple's artwork: two plain diamonds stand in for them and the
 * comparisons mask their area, which reaches over the left edge of the text box. The wording
 * of the text is a stand-in of the same length, and the comparisons that score the layout mask
 * it. The buttons have the capture's widths. The dark capture's window background is the
 * tinted #303132, close to the catalog's tinted window colour, which the box sets.
 */
export default function VisualBootCamp() {
  return (
    <div
      style={{
        width: 783,
        height: 548,
        overflow: "hidden",
        ["--mac-color-window-background" as string]: "var(--mac-color-window-background-tinted)",
      }}
    >
      <AssistantWindow
        title="Boot Camp Assistant"
        artwork={
          <svg
            width="219"
            height="380"
            viewBox="0 0 219 380"
            style={{ marginTop: 65 }}
            aria-hidden="true"
          >
            <path d="M90 10l110 110-110 110-110-110z" fill="#b9bcc2" />
            <path d="M90 150l110 110-110 110-110-110z" fill="#9a9ea6" />
          </svg>
        }
      >
        <AssistantWindowHeading id="assistant-visual-step">Introduction</AssistantWindowHeading>
        <AssistantWindowText aria-labelledby="assistant-visual-step">
          <p>
            Boot Camp Assistant helps you install Microsoft Windows on an Intel-based Mac. It
            creates a partition for Windows on your startup disk and downloads the support software
            that Windows needs.
          </p>
          <p>IMPORTANT: Back up your disk before you create a partition or install Windows.</p>
        </AssistantWindowText>
        <AssistantWindowActions
          leading={<PushButton style={{ width: 164 }}>Open Boot Camp Help</PushButton>}
        >
          <PushButton>Continue</PushButton>
        </AssistantWindowActions>
      </AssistantWindow>
    </div>
  );
}
