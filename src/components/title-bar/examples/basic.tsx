import { TitleBar } from "macalicious/title-bar";
import { WindowControls } from "macalicious/window-controls";

export default function Basic() {
  return <TitleBar title="Untitled" controls={<WindowControls />} style={{ width: 360 }} />;
}
