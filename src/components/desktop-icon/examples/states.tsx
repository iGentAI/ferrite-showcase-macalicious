import { Desktop } from "macalicious/desktop";
import { DesktopIcon } from "macalicious/desktop-icon";

function Page() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <path d="M14 4h26l10 10v46H14z" fill="#ffffff" stroke="#a0a4aa" />
      <path d="M22 26h20M22 34h20M22 42h14" stroke="#c2c6cc" strokeWidth="2" />
    </svg>
  );
}

/** Normal, selected, dimmed and a name that needs two lines. Tab to an icon to see the ring. */
export default function States() {
  return (
    <Desktop style={{ height: 150 }} defaultValue={["Selected.pdf"]}>
      <DesktopIcon icon={<Page />}>Normal.pdf</DesktopIcon>
      <DesktopIcon icon={<Page />}>Selected.pdf</DesktopIcon>
      <DesktopIcon icon={<Page />} dimmed>
        Dimmed.pdf
      </DesktopIcon>
      <DesktopIcon icon={<Page />}>Aqua and Bondi.pdf</DesktopIcon>
    </Desktop>
  );
}
