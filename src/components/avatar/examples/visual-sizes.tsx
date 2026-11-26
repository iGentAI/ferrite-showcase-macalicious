import { Avatar } from "macalicious/avatar";

/**
 * Fixture for what the reference comparison cannot pin down: a 29 pt avatar at 10, 10 and a 48 pt one
 * at 50, 10 in an 108 x 68 pt box in the colour of Find My's sidebar.
 */
export default function VisualSizes() {
  return (
    <div
      style={{
        position: "relative",
        width: 108,
        height: 68,
        background: "light-dark(#f6f6f4, #202124)",
      }}
    >
      <Avatar alt="Me" style={{ position: "absolute", left: 10, top: 10 }} />
      <Avatar alt="Me, larger" size={48} style={{ position: "absolute", left: 50, top: 10 }} />
    </div>
  );
}
