import { Siri, SiriCard } from "macalicious/siri";
import type { CSSProperties, ReactNode } from "react";

// Stand-ins for the weather glyphs: plain shapes drawn here, not Apple's artwork.
const sun = (size: number) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <circle cx="12" cy="12" r="5.5" fill="#ffe000" />
    <path
      d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"
      stroke="#ffe000"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);
const moon = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M15 3a9 9 0 1 0 6 13.5A8 8 0 0 1 15 3z" fill="#ffffff" />
  </svg>
);

const hours: [string, ReactNode, number][] = [
  ["12 PM", sun(18), 75],
  ["1 PM", sun(18), 78],
  ["2 PM", sun(18), 80],
  ["3 PM", sun(18), 82],
  ["4 PM", sun(18), 82],
  ["5 PM", sun(18), 80],
  ["6 PM", sun(18), 78],
  ["7 PM", moon, 75],
  ["8 PM", moon, 73],
  ["9 PM", moon, 71],
];

const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 40px 1fr",
  alignItems: "center",
  justifyItems: "center",
  height: 39,
  padding: "1.5px 20.5px 0 17.5px",
  boxSizing: "border-box",
  lineHeight: "16px",
};

/**
 * Visual comparison target: the Siri window of the Dark Aqua capture, with its shadow,
 * answering with the Weather result. Reference: all of 10-15-Catalina-Dark-Siri.png,
 * 382 x 687 pt; the window is at 19, 18. The window itself is the same in both appearances;
 * the capture differs in the result and in the desktop picture behind it.
 *
 * The window was captured with the desktop picture blended into its materials and nothing
 * behind it, so two things here stand in for the picture: the element behind the window,
 * which gives the chrome the grey and the warm and pink casts it has in the capture (the grey
 * #757575 is what --mac-material-hud needs behind it to measure #383838), and
 * --mac-siri-card-glow, the tints in the card. The weather glyphs and the icon in the header
 * are plain shapes. The card of the capture runs on under the bottom strip; here it is given
 * the height for that.
 */
export default function VisualDark() {
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
      <Siri onClose={() => {}} onHelp={() => {}} onListen={() => {}}>
        <SiriCard
          title="Weather"
          icon={
            <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="6.5" fill="#3d3d5c" stroke="#ffffff" />
            </svg>
          }
          style={
            {
              minHeight: 530,
              "--mac-siri-card-glow":
                "radial-gradient(150px 90px at 70px 20px, #e8d8d0, transparent), radial-gradient(150px 200px at 150px 500px, #e2dae8, transparent), radial-gradient(120px 200px at 110px 260px, #d1dbde, transparent), linear-gradient(to right, transparent 50%, #d8d0d0 75%)",
            } as CSSProperties
          }
        >
          <div style={{ position: "relative", height: 94.5 }}>
            <span style={{ position: "absolute", left: 23.75, top: 25.75 }}>{sun(42)}</span>
            <div style={{ position: "absolute", left: 87, top: 15.5, lineHeight: "15.67px" }}>
              <div style={{ font: "700 14px/18px var(--mac-font-family-system)" }}>Memphis</div>
              <div style={{ marginTop: 3, fontSize: 13, color: "var(--mac-siri-card-secondary)" }}>
                Sunny
                <br />
                Chance of Rain: 0%
                <br />
                High: 84° Low: 61°
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                right: 15.5,
                top: 26.25,
                font: "200 55px/50px var(--mac-font-family-system)",
              }}
            >
              73°
            </div>
          </div>
          {hours.map(([hour, glyph, degrees]) => (
            <div key={hour} style={row}>
              <span style={{ justifySelf: "start" }}>{hour}</span>
              {glyph}
              <b style={{ justifySelf: "end" }}>{degrees}</b>
            </div>
          ))}
        </SiriCard>
      </Siri>
    </div>
  );
}
