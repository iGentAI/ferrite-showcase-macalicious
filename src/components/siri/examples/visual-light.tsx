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
const cloud = (behind: ReactNode) => (
  <span style={{ position: "relative", display: "block", width: 25, height: 18 }}>
    <span style={{ position: "absolute", left: 0, top: -2 }}>{behind}</span>
    <svg
      viewBox="0 0 20 12"
      width="20"
      height="12"
      aria-hidden="true"
      style={{ position: "absolute", right: 0, bottom: 0 }}
    >
      <path d="M5 12a4 4 0 0 1 0-8 6 6 0 0 1 11 2 3 3 0 0 1 0 6z" fill="#ffffff" />
    </svg>
  </span>
);

const hours: [string, ReactNode, number][] = [
  ["4 PM", cloud(sun(16)), 96],
  ["5 PM", cloud(sun(16)), 93],
  ["6 PM", sun(18), 91],
  ["7 PM", cloud(moon), 87],
  ["8 PM", cloud(moon), 84],
  ["9 PM", moon, 82],
  ["10 PM", moon, 78],
  ["11 PM", moon, 78],
  ["12 AM", moon, 75],
  ["1 AM", moon, 73],
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
 * Visual comparison target: the Siri window of the Aqua capture, with its shadow, answering
 * with the Weather result. Reference: all of 10-15-Catalina-Light-Siri.png, 382 x 702 pt; the
 * window is at 19, 18.
 *
 * The window was captured with the desktop picture blended into its materials and nothing
 * behind it, so two things here stand in for the picture: the element behind the window,
 * which gives the chrome the grey and the aqua cast it has in the capture (the grey #757575
 * is what --mac-material-hud needs behind it to measure #383838), and --mac-siri-card-glow,
 * the aqua light in the card. The weather glyphs and the icon in the header are plain shapes.
 */
export default function VisualLight() {
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
              "--mac-siri-card-glow":
                "radial-gradient(130px 135px at 105px 112px, #dafef5, rgb(218 254 245 / 0.7) 45%, rgb(218 254 245 / 0.25) 75%, transparent)",
            } as CSSProperties
          }
        >
          <div style={{ position: "relative", height: 109.5 }}>
            <span style={{ position: "absolute", left: 23.75, top: 25.75 }}>{sun(42)}</span>
            <div style={{ position: "absolute", left: 87, top: 15.5, lineHeight: "15.67px" }}>
              <div style={{ font: "700 14px/18px var(--mac-font-family-system)" }}>Memphis</div>
              <div style={{ marginTop: 3, fontSize: 13, color: "var(--mac-siri-card-secondary)" }}>
                Sunny
                <br />
                Chance of
                <br />
                Rain: 20%
                <br />
                High: 97° Low: 64°
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                right: 15.5,
                top: 33.75,
                font: "200 55px/50px var(--mac-font-family-system)",
              }}
            >
              95°
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
