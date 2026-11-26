"use client";

import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { Separator } from "macalicious/separator";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { GearPicture } from "./artwork";
import "./software-update.css";
import { Uncaptured } from "../uncaptured";

/**
 * What "Automatically keep my Mac up to date" shows: mixed while only some of the automatic
 * updates of the Advanced sheet are on, as captured.
 */
export type AutomaticUpdates = "on" | "off" | "mixed";

/**
 * System Preferences > Software Update, with the Mac up to date. The checkbox starts mixed, as
 * captured, and a click turns every automatic update on, as AppKit does for a mixed checkbox.
 * Nothing is checked or installed: the Details link and the Advanced button say that their sheets
 * are not part of the demo, since no screenshot shows them.
 *
 * The setting `software-update.lastChecked` holds the words after "Last checked:", which differ
 * between the two captures.
 *
 * Distances are those of reference/spec/apps/system-preferences-software-update.md, in points
 * from the top-left corner of the window frame.
 */
export function SoftwareUpdate() {
  const [automatic, setAutomatic] = usePreference<AutomaticUpdates>(
    "software-update.automatic",
    "mixed",
  );
  const [lastChecked] = usePreference("software-update.lastChecked", "Today at 10:47 AM");

  return (
    <PaneForm>
      <div className="mac-system-preferences-software-update-detail" />
      <Separator
        aria-hidden="true"
        orientation="vertical"
        style={{ position: "absolute", top: 0, bottom: 0, left: 192 }}
      />

      {/* The column with the picture: everything is centred 96 pt from the window's edge. */}
      <PaneAt x={40} y={66}>
        <GearPicture />
      </PaneAt>
      <PaneAt x={20.5} y={189.5} width={150} style={{ justifyContent: "center" }}>
        <Label textStyle="emphasized">Software Update</Label>
      </PaneAt>
      <PaneAt x={20.5} y={209} width={150} style={{ justifyContent: "center" }}>
        <Label textStyle="small" align="center" style={{ whiteSpace: "pre" }}>
          {"This Mac is enrolled in the\nApple Developer Seed\nProgram"}
        </Label>
      </PaneAt>
      <PaneAt x={20.5} y={251} width={150} style={{ justifyContent: "center" }}>
        <Uncaptured action="Details…" nativeButton={false}>
          <Label textStyle="small" color="link" render={<a href="#software-update-details" />}>
            Details…
          </Label>
        </Uncaptured>
      </PaneAt>

      <PaneAt x={235.5} y={65}>
        <Label textStyle="emphasized">Your Mac is up to date — macOS Catalina Beta 10.15</Label>
      </PaneAt>
      <PaneAt x={234.5} y={87}>
        <Label textStyle="small">Last checked: {lastChecked}</Label>
      </PaneAt>

      <PaneAt x={235} y={248}>
        <Checkbox
          checked={automatic === "on"}
          indeterminate={automatic === "mixed"}
          onCheckedChange={(checked) => setAutomatic(checked ? "on" : "off")}
        >
          Automatically keep my Mac up to date
        </Checkbox>
      </PaneAt>
      {/* A bezel is drawn half a point inside the control's box: the button's bezel is the
          98 x 20 pt at 520.5, 245.5 that the blueprint gives. */}
      <PaneAt x={520} y={245}>
        <Uncaptured action="Advanced…">
          <PushButton style={{ width: 99, paddingInline: 0 }}>Advanced…</PushButton>
        </Uncaptured>
      </PaneAt>
      <PaneFooter x={627} y={245}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
