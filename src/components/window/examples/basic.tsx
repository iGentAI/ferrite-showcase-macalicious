import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

export default function Basic() {
  return (
    <div style={{ padding: "24px 48px 64px" }}>
      <Window width={360} height={160}>
        <TitleBar title="Untitled" controls={<WindowControls />} />
        <WindowBody style={{ padding: 20, display: "grid", gap: 12, justifyItems: "end" }}>
          <span style={{ justifySelf: "start" }}>A window is a frame around your content.</span>
          <PushButton variant="primary">OK</PushButton>
        </WindowBody>
      </Window>
    </div>
  );
}
