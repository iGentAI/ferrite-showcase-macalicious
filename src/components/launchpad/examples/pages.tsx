import { Launchpad, LaunchpadItem } from "macalicious/launchpad";
import { PushButton } from "macalicious/push-button";
import { type CSSProperties, useState } from "react";

const COLORS = ["blue", "green", "orange", "pink", "purple", "red", "teal", "yellow"];
const APPS = Array.from({ length: 14 }, (_, index) => ({
  name: `App ${index + 1}`,
  color: COLORS[index % COLORS.length],
}));

const desktop = {
  position: "relative",
  width: "100%",
  height: 420,
  padding: 20,
  boxSizing: "border-box",
  overflow: "hidden",
  background:
    "linear-gradient(160deg, var(--mac-color-system-orange), var(--mac-color-system-purple))",
  "--mac-launchpad-inset-bottom": "0px",
} as CSSProperties;

/**
 * Fourteen apps on a grid of three by two: three pages. The page is controlled, so the
 * desktop can show which one Launchpad was left on.
 */
export default function Pages() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  return (
    <div ref={setElement} style={desktop}>
      <PushButton onClick={() => setOpen(true)}>Show Launchpad</PushButton>
      <p style={{ color: "white" }}>Page {page + 1} of 3</p>
      <Launchpad
        open={open}
        onOpenChange={setOpen}
        container={element}
        columns={3}
        rows={2}
        page={page}
        onPageChange={setPage}
      >
        {APPS.map((app) => (
          <LaunchpadItem key={app.name} label={app.name}>
            <span
              style={{
                width: "86%",
                height: "86%",
                borderRadius: "50%",
                background: `var(--mac-color-system-${app.color})`,
              }}
            />
          </LaunchpadItem>
        ))}
      </Launchpad>
    </div>
  );
}
