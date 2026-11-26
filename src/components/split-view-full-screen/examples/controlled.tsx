import {
  SplitViewFullScreen,
  SplitViewFullScreenDivider,
  SplitViewFullScreenTile,
} from "macalicious/split-view-full-screen";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { useState } from "react";

/** The split and the active tile held by the caller, and shown in the tiles. */
export default function Controlled() {
  const [split, setSplit] = useState(0.44);
  const [active, setActive] = useState<"leading" | "trailing">("leading");
  return (
    <SplitViewFullScreen
      split={split}
      onSplitChange={setSplit}
      min={0.3}
      max={0.7}
      active={active}
      onActiveChange={setActive}
      style={{ width: "100%", height: 240 }}
    >
      <SplitViewFullScreenTile side="leading">
        <TitleBar variant="title-hidden" title="Leading" />
        <WindowBody style={{ padding: 20 }}>
          {Math.round(split * 100)}% of the width{active === "leading" ? ", active" : ""}
        </WindowBody>
      </SplitViewFullScreenTile>
      <SplitViewFullScreenDivider aria-label="Resize Leading and Trailing" />
      <SplitViewFullScreenTile side="trailing">
        <TitleBar variant="title-hidden" title="Trailing" />
        <WindowBody style={{ padding: 20 }}>
          {100 - Math.round(split * 100)}% of the width{active === "trailing" ? ", active" : ""}
        </WindowBody>
      </SplitViewFullScreenTile>
    </SplitViewFullScreen>
  );
}
