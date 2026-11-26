import type { CSSProperties } from "react";
import { SiriAssistant } from "../siri";

/**
 * Visual comparison target: the Siri window of the Dark Aqua capture, with its shadow,
 * answering with the Weather result of that capture. Reference: all of
 * 10-15-Catalina-Dark-Siri.png, 382 x 687 pt; the window is at 19, 18. The window itself is the
 * same in both appearances; the capture differs in the forecast and in the desktop picture
 * behind it.
 *
 * As in visual-window, the element behind the window gives the chrome the grey and the warm
 * and pink casts it has in the capture, and --mac-siri-card-glow the tints in the card.
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: 382,
        height: 687,
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
            "radial-gradient(150px 130px at 85px 0, #bb7261, transparent), radial-gradient(190px 110px at 175px 615px, #f394cc, transparent), radial-gradient(80px 170px at 0 580px, #a07868, transparent), #757575",
        }}
      />
      <SiriAssistant
        capture="dark"
        style={
          {
            "--mac-siri-card-glow":
              "radial-gradient(150px 90px at 70px 20px, #e8d8d0, transparent), radial-gradient(150px 200px at 150px 500px, #e2dae8, transparent), radial-gradient(120px 200px at 110px 260px, #d1dbde, transparent), linear-gradient(to right, transparent 50%, #d8d0d0 75%)",
          } as CSSProperties
        }
      />
    </div>
  );
}
