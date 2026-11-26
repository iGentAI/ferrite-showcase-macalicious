import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

const states = [
  ["key", "Key"],
  ["main", "Main, not key"],
  ["inactive", "Inactive"],
] as const;

/**
 * The same window in its three states. Only the `state` prop differs: the frame, the window
 * controls and the default button inside restyle themselves from `data-window-state`.
 */
export default function States() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 40, padding: "24px 48px 64px" }}>
      {states.map(([state, title]) => (
        <Window key={state} state={state} width={220} height={120}>
          <TitleBar title={title} controls={<WindowControls />} />
          <WindowBody style={{ padding: 20, display: "grid", placeItems: "end" }}>
            <PushButton variant="primary">Save</PushButton>
          </WindowBody>
        </Window>
      ))}
    </div>
  );
}
