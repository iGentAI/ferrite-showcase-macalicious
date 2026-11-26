"use client";

import { DefaultButton } from "macalicious/default-button";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { Separator } from "macalicious/separator";
import { useId } from "react";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { FamilyPicture } from "./artwork";
import "./family-sharing.css";
import { Uncaptured } from "../uncaptured";

/** What a family shares, in the order of the capture. */
const BENEFITS = [
  "Share purchased apps, music, movies, books, and TV shows.",
  "Share an Apple Music family subscription.",
  "Share an iCloud storage plan for everyone’s photos, files, and backups.",
  "Share your location with family members and help find missing devices.",
  "Share a photo album, family calendars, and reminders.",
  "Create accounts for children in your family.",
] as const;

/**
 * System Preferences > Family Sharing, before a family is set up: the introduction, with no
 * setting to keep. Next would start the setup, which no screenshot shows, so it says so.
 *
 * Distances are those of reference/spec/apps/system-preferences-family-sharing.md, in points
 * from the top-left corner of the window frame.
 */
export function FamilySharing() {
  const id = useId();

  return (
    <PaneForm>
      <div className="mac-system-preferences-family-sharing-detail" />
      <Separator
        aria-hidden="true"
        orientation="vertical"
        style={{ position: "absolute", top: 0, bottom: 0, left: 194 }}
      />

      {/* The column with the picture: both are centred 97 pt from the window's edge. */}
      <PaneAt x={41} y={66}>
        <FamilyPicture />
      </PaneAt>
      <PaneAt x={22} y={190} width={150} style={{ justifyContent: "center" }}>
        <Label textStyle="emphasized">Family Sharing</Label>
      </PaneAt>

      <PaneAt x={217} y={60}>
        <Label id={`${id}-title`} textStyle="emphasized">
          Set up Family Sharing
        </Label>
      </PaneAt>
      <PaneAt x={217} y={84}>
        <Label style={{ whiteSpace: "pre" }}>
          {
            "Family Sharing is the easy way to share your family’s purchases,\nsubscriptions, storage, and more."
          }
        </Label>
      </PaneAt>
      <PaneAt x={218.5} y={121.5}>
        <ul
          aria-labelledby={`${id}-title`}
          className="mac-system-preferences-family-sharing-benefits"
        >
          {BENEFITS.map((benefit) => (
            <li key={benefit}>
              <Label textStyle="small">{benefit}</Label>
            </li>
          ))}
        </ul>
      </PaneAt>

      {/* A bezel is drawn half a point inside the control's box: the blueprint's rectangles
          are the bezels. */}
      <PaneFooter x={19.5} y={286.5}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
      <PaneAt x={591} y={287}>
        <Uncaptured action="Next">
          <DefaultButton style={{ width: 57, paddingInline: 0 }}>Next</DefaultButton>
        </Uncaptured>
      </PaneAt>
    </PaneForm>
  );
}
