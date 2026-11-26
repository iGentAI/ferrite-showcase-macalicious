"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PushButton } from "macalicious/push-button";
import { TableHeader, TableHeaderCell } from "macalicious/table-header";
import { type ReactNode, useId } from "react";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { BluetoothArtwork, MouseArtwork } from "./artwork";

/** The device list's top-left corner in the window frame, border included. */
const LIST = { x: 259, y: 58 };

/** The one device of the captures, under a placeholder name. */
const MOUSE = { id: "magic-mouse", name: "Alex’s Magic Mouse 2" };

/** The name the computer is discoverable under: a placeholder for the captured host name. */
const COMPUTER = "Alexs-MacBook-Pro";

/** A line of the left column, centred on x 132 as the emblem is. */
function Centered({ y, children }: { y: number; children: ReactNode }) {
  return (
    <PaneAt x={12} y={y} width={240} style={{ justifyContent: "center" }}>
      {children}
    </PaneAt>
  );
}

/**
 * System Preferences > Bluetooth: Bluetooth on, looking for devices, one mouse in the list.
 * The button turns Bluetooth off and on again: off, the computer is not discoverable, the
 * spinner stops and the mouse is not connected. No radio is involved, and Advanced says that its
 * sheet is not part of the demo (it is in no capture). `bluetooth.connected` is whether the mouse is
 * connected while Bluetooth is on: it is in the Aqua capture and is not in the Dark Aqua one.
 *
 * Distances are those of reference/spec/apps/system-preferences-bluetooth.md, in points from
 * the top-left corner of the window frame.
 */
export function Bluetooth() {
  const [on, setOn] = usePreference("bluetooth.on", true);
  const [connected] = usePreference("bluetooth.connected", true);
  const [selected, setSelected] = usePreference<readonly string[]>("bluetooth.selected", []);
  const [menuBar, setMenuBar] = usePreference("bluetooth.showInMenuBar", false);
  const id = useId();
  const status = on && connected ? "Connected - Charged" : "Not Connected";

  return (
    <PaneForm>
      <PaneAt x={77.5} y={61.5}>
        <BluetoothArtwork />
      </PaneAt>
      <Centered y={215.5}>
        <Label textStyle="emphasized" aria-live="polite">
          Bluetooth: {on ? "On" : "Off"}
        </Label>
      </Centered>
      <PaneAt x={62} y={239}>
        <PushButton onClick={() => setOn(!on)} style={{ width: 141, paddingInline: 0 }}>
          {on ? "Turn Bluetooth Off" : "Turn Bluetooth On"}
        </PushButton>
      </PaneAt>
      {on ? (
        <>
          <Centered y={268.5}>
            <Label>Now discoverable as</Label>
          </Centered>
          <Centered y={295}>
            <Label>“{COMPUTER}”</Label>
          </Centered>
        </>
      ) : null}

      <PaneAt x={LIST.x} y={LIST.y}>
        <BorderedList style={{ width: 389, height: 316 }}>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            {/* The list's heading is the library's table header as a plain band: there are no
                columns under it, so it is not a row of column headings. It is 21 pt tall here. */}
            <TableHeader role="presentation" style={{ flex: "none", height: 21 }}>
              <TableHeaderCell role="presentation">
                <Label
                  id={`${id}-devices`}
                  textStyle="small-emphasized"
                  style={{ position: "relative", top: -1.5, marginLeft: 3 }}
                >
                  Devices
                </Label>
              </TableHeaderCell>
            </TableHeader>
            <BorderedListRows
              aria-labelledby={`${id}-devices`}
              rowHeight={47}
              value={selected}
              onValueChange={setSelected}
              style={{ flex: "1 1 0", minHeight: 0 }}
            >
              <BorderedListRow
                value={MOUSE.id}
                aria-label={`${MOUSE.name}, ${status}`}
                textValue={MOUSE.name}
                title={MOUSE.name}
                leading={
                  <span style={{ display: "flex", justifyContent: "center", width: 40 }}>
                    <MouseArtwork />
                  </span>
                }
              >
                <Label textStyle="small" color="tertiary" style={{ marginTop: 2.5 }}>
                  {status}
                </Label>
              </BorderedListRow>
            </BorderedListRows>
          </div>
          <PaneForm origin={LIST}>
            {on ? (
              <PaneAt x={612} y={62.5}>
                <ProgressSpinner size="small" aria-label="Looking for devices" />
              </PaneAt>
            ) : null}
          </PaneForm>
        </BorderedList>
      </PaneAt>

      <PaneAt x={259} y={394}>
        <Checkbox checked={menuBar} onCheckedChange={setMenuBar}>
          Show Bluetooth in menu bar
        </Checkbox>
      </PaneAt>
      <PaneAt x={519} y={391}>
        <Uncaptured action="Advanced…">
          <PushButton style={{ width: 99, paddingInline: 0 }}>Advanced…</PushButton>
        </Uncaptured>
      </PaneAt>
      <PaneFooter x={630} y={391}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
