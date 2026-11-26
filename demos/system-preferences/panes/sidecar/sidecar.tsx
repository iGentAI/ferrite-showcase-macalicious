"use client";

import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PullDownButton } from "macalicious/pull-down-button";
import { useId } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { TabletArtwork } from "./artwork";

type SidebarSide = "left" | "right";
type TouchBarEdge = "bottom" | "top";

/**
 * System Preferences > Sidecar, with no device to connect to, as captured. The picture of the
 * tablet follows the two pop-up buttons and their checkboxes; nothing is connected.
 *
 * Distances are those of reference/spec/apps/system-preferences-sidecar.md, in points from the
 * top-left corner of the window frame. The blueprint gives the bezel of a pop-up button and of
 * the help button; the control's box, its alignment rectangle, is one hairline larger all round.
 */
export function Sidecar() {
  const [showSidebar, setShowSidebar] = usePreference("sidecar.showSidebar", true);
  const [sidebarSide, setSidebarSide] = usePreference<SidebarSide>("sidecar.sidebarSide", "left");
  const [showTouchBar, setShowTouchBar] = usePreference("sidecar.showTouchBar", true);
  const [touchBarEdge, setTouchBarEdge] = usePreference<TouchBarEdge>(
    "sidecar.touchBarEdge",
    "bottom",
  );
  const [doubleTap, setDoubleTap] = usePreference("sidecar.doubleTap", false);
  const served = servedByDesktopApp();
  const id = useId();

  return (
    <PaneForm>
      <PaneAt x={73.5} y={65}>
        <TabletArtwork
          sidebar={showSidebar ? sidebarSide : null}
          touchBar={showTouchBar ? touchBarEdge : null}
        />
      </PaneAt>

      <PaneAt x={334} y={101}>
        <Checkbox checked={showSidebar} onCheckedChange={setShowSidebar}>
          Show Sidebar
        </Checkbox>
      </PaneAt>
      <PaneAt x={446} y={98}>
        <PopUpButton<SidebarSide>
          aria-label="Sidebar position"
          value={sidebarSide}
          onValueChange={(value) => value && setSidebarSide(value)}
          style={{ width: 103.5 }}
        >
          <PopUpButtonItem value="left">on the left</PopUpButtonItem>
          <PopUpButtonItem value="right">on the right</PopUpButtonItem>
        </PopUpButton>
      </PaneAt>

      <PaneAt x={334} y={137}>
        <Checkbox checked={showTouchBar} onCheckedChange={setShowTouchBar}>
          Show Touch Bar
        </Checkbox>
      </PaneAt>
      <PaneAt x={460} y={134}>
        <PopUpButton<TouchBarEdge>
          aria-label="Touch Bar position"
          value={touchBarEdge}
          onValueChange={(value) => value && setTouchBarEdge(value)}
          style={{ width: 118.5 }}
        >
          <PopUpButtonItem value="bottom">on the bottom</PopUpButtonItem>
          <PopUpButtonItem value="top">on the top</PopUpButtonItem>
        </PopUpButton>
      </PaneAt>

      <PaneAt x={334} y={173}>
        <Checkbox
          checked={doubleTap && !served}
          disabled={served}
          title={served ? "A web page cannot reach an Apple Pencil's double tap." : undefined}
          onCheckedChange={setDoubleTap}
        >
          Enable double tap on Apple Pencil
        </Checkbox>
      </PaneAt>

      {/* The label and the button are centred under the picture, on x 182. The button is 102 pt
          wide in the captures and grows with its title in a wider font. */}
      <PaneAt x={82} y={244.5} width={200} style={{ justifyContent: "center" }}>
        <Label id={`${id}-connect`}>Connect to:</Label>
      </PaneAt>
      <PaneAt x={82} y={270.5} width={200} style={{ justifyContent: "center" }}>
        {/* No device is in reach, so the menu has nothing to offer and the button is disabled. */}
        <PullDownButton
          title="No Devices"
          aria-labelledby={`${id}-connect`}
          disabled
          style={{ minWidth: 102 }}
        />
      </PaneAt>

      <PaneFooter x={627} y={307}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
