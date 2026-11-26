import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";

export default function Basic() {
  return (
    <WindowTabBar aria-label="Folders" defaultValue="home" style={{ width: 460 }}>
      <WindowTab value="recents">Recents</WindowTab>
      <WindowTab value="home">Home</WindowTab>
      <WindowTab value="documents">Documents</WindowTab>
    </WindowTabBar>
  );
}
