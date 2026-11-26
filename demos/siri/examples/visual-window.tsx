import type { CSSProperties } from "react";
import { SiriAssistant } from "../siri";

/**
 * Visual comparison target: the Siri window of the Aqua capture, with its shadow, answering
 * with the Weather result. Reference: all of 10-15-Catalina-Light-Siri.png, 382 x 702 pt; the
 * window is at 19, 18.
 *
 * The window was captured with the desktop picture blended into its materials and nothing
 * behind it, so two things here stand in for the picture, as in the library's own comparison
 * of the window: the element behind the window, which gives the chrome the grey and the aqua
 * cast it has in the capture (the grey #757575 is what --mac-material-hud needs behind it to
 * measure #383838), and --mac-siri-card-glow, the aqua light in the card, which the card
 * inherits from the window.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: 382,
        height: 702,
        padding: "18px 19px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 19,
          top: 18,
          width: 344,
          height: 600,
          borderRadius: 8,
          background:
            "radial-gradient(120px 70px at 150px 16px, #799a9a, transparent), radial-gradient(44px 130px at 0 140px, #879081, transparent), #757575",
        }}
      />
      <SiriAssistant
        capture="light"
        style={
          {
            "--mac-siri-card-glow":
              "radial-gradient(130px 135px at 105px 112px, #dafef5, rgb(218 254 245 / 0.7) 45%, rgb(218 254 245 / 0.25) 75%, transparent)",
          } as CSSProperties
        }
      />
    </div>
  );
}
