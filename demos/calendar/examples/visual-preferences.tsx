import { CalendarPreferences } from "../calendar-preferences";

/**
 * Visual comparison target: the whole frame of Calendar's preferences, the General pane, as
 * the light capture shows it. Reference crop (2x pixels) x=112 y=76 w=1074 h=1084, i.e. the
 * 537 x 542 pt frame, over the capture's transparent margin (matte white).
 */
export default function VisualPreferences() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 537,
        height: 542,
        background: "#ffffff",
      }}
    >
      <CalendarPreferences style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
