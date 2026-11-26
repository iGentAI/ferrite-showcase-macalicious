import { DesktopIcon } from "macalicious/desktop-icon";

/** One selected icon on a flat backdrop, for the state checks: nothing in a screenshot shows it. */
export default function VisualSelected() {
  return (
    <div style={{ width: 116, height: 112, background: "light-dark(#9ec1e2, #061e41)" }}>
      <DesktopIcon icon={null} selected>
        Notes
      </DesktopIcon>
    </div>
  );
}
