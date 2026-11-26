import { Desktop } from "macalicious/desktop";
import { DesktopIcon } from "macalicious/desktop-icon";
import { DesktopStack } from "macalicious/desktop-stack";

// A stand-in photograph. A stack's sheet sizes its thumbnail; as an icon's artwork it needs a
// size of its own.
function Photo({ hue, size }: { hue: number; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 60% 70%), hsl(${hue + 40} 50% 40%))`,
      }}
    />
  );
}

function Page() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <path d="M14 4h26l10 10v46H14z" fill="#ffffff" stroke="#a0a4aa" />
      <path d="M22 26h20M22 34h20M22 42h14" stroke="#c2c6cc" strokeWidth="2" />
    </svg>
  );
}

export default function Basic() {
  return (
    <Desktop style={{ width: "100%", height: 470 }}>
      <DesktopStack label="Images" thumbnail={<Photo hue={200} />}>
        <DesktopIcon icon={<Photo hue={200} size={64} />}>Coast.jpg</DesktopIcon>
        <DesktopIcon icon={<Photo hue={30} size={64} />}>Dunes.jpg</DesktopIcon>
      </DesktopStack>
      <DesktopStack label="PDF Documents" defaultOpen>
        <DesktopIcon icon={<Page />}>Energy Guide.pdf</DesktopIcon>
        <DesktopIcon icon={<Page />}>Aqua and Bondi.pdf</DesktopIcon>
      </DesktopStack>
    </Desktop>
  );
}
