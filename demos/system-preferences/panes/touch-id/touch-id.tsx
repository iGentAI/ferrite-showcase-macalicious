"use client";

import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { type ReactNode, useId } from "react";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { AddFingerprintArtwork, FingerprintArtwork, TouchIdArtwork } from "./artwork";

/** The settings region's top-left corner in the window frame: its leading edge is the divider. */
const SETTINGS = { x: 192, y: 38 };

/** Centre of the first tile, and the distance from one tile's centre to the next. */
const FIRST_TILE = 312;
const TILE_PITCH = 129;
/** A tile's box: wide enough for its caption, and 5 pt of clear space above the picture. */
const TILE_WIDTH = 124;
/** macOS keeps at most three fingerprints for an account. */
const MOST_FINGERPRINTS = 3;

/** What Touch ID is used for: key, top edge, title. All four are on in the captures. */
const USES = [
  ["unlock", 224, "Unlocking your Mac"],
  ["applePay", 246, "Apple Pay"],
  ["stores", 268, "iTunes Store, App Store & Apple Books"],
  ["autoFill", 290, "Password AutoFill"],
] as const;

function Use({ id, y, title }: { id: string; y: number; title: string }) {
  const [checked, setChecked] = usePreference(`touch-id.${id}`, true);
  return (
    <PaneAt x={228} y={y}>
      <Checkbox checked={checked} onCheckedChange={setChecked}>
        {title}
      </Checkbox>
    </PaneAt>
  );
}

function Tile({ index, children }: { index: number; children: ReactNode }) {
  return (
    <PaneAt
      x={FIRST_TILE + index * TILE_PITCH - TILE_WIDTH / 2}
      y={105}
      width={TILE_WIDTH}
      style={{ justifyContent: "center" }}
    >
      {children}
    </PaneAt>
  );
}

/**
 * System Preferences > Touch ID. No finger is read: "Add a fingerprint" adds the next saved
 * fingerprint at once, up to the three macOS keeps, and a saved fingerprint's tile says that
 * renaming and removing are not part of the demo (they are in no capture). The four uses keep their state.
 *
 * Distances are those of reference/spec/apps/system-preferences-touch-id.md, in points from
 * the top-left corner of the window frame.
 */
export function TouchId() {
  const [fingerprints, setFingerprints] = usePreference<readonly string[]>(
    "touch-id.fingerprints",
    ["Finger 1"],
  );
  const id = useId();

  return (
    <>
      <PaneAt x={39.5} y={66}>
        <TouchIdArtwork />
      </PaneAt>

      <PaneAt x={SETTINGS.x} y={SETTINGS.y}>
        <Box edges="leading" aria-label="Touch ID" style={{ width: 476, height: 300 }}>
          <PaneForm origin={SETTINGS}>
            <PaneAt x={216.5} y={52.5}>
              <Label>
                Touch ID lets you use your fingerprint to unlock your Mac and make
                <br />
                purchases with Apple Pay, iTunes Store, App Store and Apple Books.
              </Label>
            </PaneAt>

            {fingerprints.map((name, index) => (
              <Tile key={name} index={index}>
                <Uncaptured action={name}>
                  <ImageButton label={name}>
                    <FingerprintArtwork />
                  </ImageButton>
                </Uncaptured>
              </Tile>
            ))}
            {fingerprints.length < MOST_FINGERPRINTS ? (
              <Tile index={fingerprints.length}>
                <ImageButton
                  label="Add a fingerprint"
                  onClick={() =>
                    setFingerprints([...fingerprints, `Finger ${fingerprints.length + 1}`])
                  }
                >
                  <AddFingerprintArtwork />
                </ImageButton>
              </Tile>
            ) : null}

            <PaneAt x={217} y={200.5}>
              <Label id={`${id}-uses`}>Use Touch ID for:</Label>
            </PaneAt>
            {/* biome-ignore lint/a11y/useSemanticElements: a fieldset cannot take the label placed beside it as its legend */}
            <div role="group" aria-labelledby={`${id}-uses`}>
              {USES.map(([key, y, title]) => (
                <Use key={key} id={key} y={y} title={title} />
              ))}
            </div>

            <PaneFooter x={627} y={299}>
              <Uncaptured action="Help">
                <HelpButton />
              </Uncaptured>
            </PaneFooter>
          </PaneForm>
        </Box>
      </PaneAt>
    </>
  );
}
