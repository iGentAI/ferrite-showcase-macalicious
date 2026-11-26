"use client";

import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { ProgressBar } from "macalicious/progress-bar";
import { PushButton } from "macalicious/push-button";
import { Separator } from "macalicious/separator";
import { type CSSProperties, useId } from "react";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { ClockPicture, DiskPicture, StopGlyph } from "./artwork";
import "./time-machine.css";
import { Uncaptured } from "../uncaptured";

/** The detail region's top-left corner in the window frame: it fills the pane from x 229. */
const DETAIL = { x: 229, y: 38 };

/** The backup the Aqua capture is in the middle of, in megabytes. */
const COPIED = 504.6;
const TOTAL = 787.8;

const NOTE = "mac-system-preferences-time-machine-note";

const KEPT = [
  "Local snapshots as space permits",
  "Hourly backups for the past 24 hours",
  "Daily backups for the past month",
  "Weekly backups for all previous months",
];

/**
 * System Preferences > Time Machine. The Aqua capture is in the middle of a backup (a progress
 * bar, a button that stops it and an estimate); the Dark Aqua capture is idle and lists the
 * dates of the backups. The button that stops the backup takes the pane from the first state
 * to the second. Nothing is backed up, and the progress does not advance.
 *
 * Distances are those of reference/spec/apps/system-preferences-time-machine.md, in points
 * from the top-left corner of the window frame.
 */
export function TimeMachine() {
  const [automatic, setAutomatic] = usePreference("time-machine.backUpAutomatically", true);
  const [backingUp, setBackingUp] = usePreference("time-machine.backingUp", true);
  const [available] = usePreference("time-machine.available", "49.7 GB");
  const [inMenuBar, setInMenuBar] = usePreference("time-machine.showInMenuBar", true);
  const id = useId();

  return (
    <PaneForm>
      <PaneAt x={59} y={71}>
        <ClockPicture />
      </PaneAt>
      <PaneAt x={0} y={194} width={230} style={{ justifyContent: "center" }}>
        <Label textStyle="emphasized">Time Machine</Label>
      </PaneAt>
      <PaneAt x={37.5} y={228}>
        <Checkbox checked={automatic} onCheckedChange={setAutomatic}>
          Back Up Automatically
        </Checkbox>
      </PaneAt>

      <PaneAt x={DETAIL.x} y={DETAIL.y}>
        <Box edges="leading" aria-label="Backups" style={{ width: 439, height: 402 }}>
          <PaneForm origin={DETAIL}>
            <PaneAt x={243} y={65} width={415}>
              <Separator aria-hidden="true" style={{ width: "100%" }} />
            </PaneAt>

            <PaneAt x={296} y={95}>
              <DiskPicture />
            </PaneAt>
            <PaneAt x={269} y={170}>
              <Uncaptured action="Select Disk…">
                <PushButton style={{ width: 107, paddingInline: 0 }}>Select Disk…</PushButton>
              </Uncaptured>
            </PaneAt>

            <PaneAt x={400.5} y={93}>
              <Label textStyle="emphasized">Time Machine</Label>
            </PaneAt>
            <PaneAt x={400.5} y={113}>
              <p className={NOTE}>{available} of 60 GB available</p>
            </PaneAt>
            {backingUp ? (
              <>
                <PaneAt x={401} y={138.5} width={199}>
                  <ProgressBar
                    aria-labelledby={`${id}-status`}
                    value={COPIED}
                    max={TOTAL}
                    style={{ width: "100%" }}
                  />
                </PaneAt>
                <PaneAt x={616.5} y={134.5}>
                  <ImageButton
                    aria-label="Stop backing up"
                    onClick={() => setBackingUp(false)}
                    style={{ "--mac-image-button-padding": "0px" } as CSSProperties}
                  >
                    <StopGlyph />
                  </ImageButton>
                </PaneAt>
                <PaneAt x={401} y={153}>
                  <p id={`${id}-status`} className={NOTE}>
                    Backing up: {COPIED} MB of {TOTAL} MB
                  </p>
                </PaneAt>
                <PaneAt x={401} y={172}>
                  <p className={NOTE}>Less than a minute remaining</p>
                </PaneAt>
              </>
            ) : (
              <>
                <PaneAt x={400.5} y={133}>
                  <p className={NOTE}>Oldest backup: Yesterday, 10:17 AM</p>
                </PaneAt>
                <PaneAt x={401} y={152}>
                  <p className={NOTE}>Latest backup: Today, 10:15 AM</p>
                </PaneAt>
                <PaneAt x={401} y={171}>
                  <p className={NOTE}>
                    Next backup: {automatic ? "Today, 11:15 AM" : "Automatic backups off"}
                  </p>
                </PaneAt>
              </>
            )}

            <PaneAt x={243} y={224} width={415}>
              <Separator aria-hidden="true" style={{ width: "100%" }} />
            </PaneAt>

            <PaneAt x={261.5} y={243}>
              <p id={`${id}-keeps`} className={NOTE}>
                Time Machine keeps:
              </p>
            </PaneAt>
            <PaneAt x={262.5} y={265}>
              <ul
                aria-labelledby={`${id}-keeps`}
                className="mac-system-preferences-time-machine-keeps"
              >
                {KEPT.map((item) => (
                  <li key={item} className={NOTE}>
                    • {item}
                  </li>
                ))}
              </ul>
            </PaneAt>
            <PaneAt x={261.5} y={338}>
              <p className={NOTE}>The oldest backups are deleted when your disk becomes full.</p>
            </PaneAt>

            <PaneAt x={261} y={405}>
              <Checkbox checked={inMenuBar} onCheckedChange={setInMenuBar}>
                Show Time Machine in menu bar
              </Checkbox>
            </PaneAt>
            <PaneAt x={534} y={402}>
              <Uncaptured action="Options…">
                <PushButton style={{ width: 86, paddingInline: 0 }}>Options…</PushButton>
              </Uncaptured>
            </PaneAt>
            <PaneFooter x={629} y={402}>
              <Uncaptured action="Help">
                <HelpButton />
              </Uncaptured>
            </PaneFooter>
          </PaneForm>
        </Box>
      </PaneAt>
    </PaneForm>
  );
}
