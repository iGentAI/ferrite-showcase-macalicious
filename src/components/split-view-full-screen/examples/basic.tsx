import {
  SplitViewFullScreen,
  SplitViewFullScreenDivider,
  SplitViewFullScreenTile,
} from "macalicious/split-view-full-screen";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";

export default function Basic() {
  return (
    <SplitViewFullScreen defaultActive="trailing" style={{ width: "100%", height: 240 }}>
      <SplitViewFullScreenTile side="leading">
        <TitleBar variant="title-hidden" title="Notes" />
        <WindowBody background="content" style={{ padding: 20 }}>
          Leading tile
        </WindowBody>
      </SplitViewFullScreenTile>
      <SplitViewFullScreenDivider />
      <SplitViewFullScreenTile side="trailing">
        <TitleBar variant="title-hidden" title="Browser" />
        <WindowBody background="content" style={{ padding: 20 }}>
          Trailing tile
        </WindowBody>
      </SplitViewFullScreenTile>
    </SplitViewFullScreen>
  );
}
