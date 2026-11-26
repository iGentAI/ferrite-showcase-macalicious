import {
  ProgressWindow,
  ProgressWindowItem,
  ProgressWindowName,
} from "macalicious/progress-window";
import { WindowControls } from "macalicious/window-controls";

/** A stand-in document icon: a plain page with a folded corner, 23 x 31 pt. */
function DocumentIcon() {
  return (
    <svg width="23" height="31" viewBox="0 0 23 31" aria-hidden="true">
      <path d="M.5.5h15l7 7v23H.5z" fill="#fcfcfc" stroke="#b4b4b4" />
      <path d="M15.5.5v7h7" fill="#e4e4e4" stroke="#b4b4b4" />
    </svg>
  );
}

export default function Basic() {
  return (
    <div style={{ padding: "24px 48px 64px" }}>
      <ProgressWindow controls={<WindowControls closeDisabled zoomDisabled />}>
        <ProgressWindowItem
          icon={<DocumentIcon />}
          title={
            <>
              Copying “
              <ProgressWindowName>Holiday in the mountains, final cut.mov</ProgressWindowName>” to
              “Desktop”
            </>
          }
          status="192.9 MB of 6 GB - About 3 minutes"
          value={3}
          onStop={() => {}}
        />
      </ProgressWindow>
    </div>
  );
}
