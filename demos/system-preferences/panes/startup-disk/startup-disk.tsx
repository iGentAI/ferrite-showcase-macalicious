"use client";

import { Box } from "macalicious/box";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { LockButton } from "macalicious/lock-button";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PushButton } from "macalicious/push-button";
import { type CSSProperties, useId } from "react";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { DiskArtwork } from "./artwork";

/** A volume the computer can start up from. */
export interface StartupVolume {
  id: string;
  /** The volume's name, the first line under its icon. */
  name: string;
  /** The system on it, the second line. */
  system: string;
  kind: "external" | "internal";
}

/** The volume the Aqua capture shows. */
const MACINTOSH_SSD: StartupVolume = {
  id: "macintosh-ssd",
  name: "Macintosh SSD",
  system: "macOS, 10.15",
  kind: "external",
};

/** The chooser's top-left corner in the window frame, and the width of one volume's cell. */
const CHOOSER = { x: 20, y: 83 };
const CELL = 125;

/**
 * System Preferences > Startup Disk: the locked pane. The volumes are disabled until the lock
 * is clicked (it asks for no password); then a click chooses the volume to start up from and
 * the line under the chooser names it. Restart and Target Disk Mode say that they are not part of the
 * demo: a page cannot
 * restart the computer.
 *
 * The volumes are the setting `startup-disk.volumes`; `startup-disk.scanning` shows the
 * spinner of a chooser that is still looking for volumes, as the Dark Aqua capture does.
 *
 * Distances are those of reference/spec/apps/system-preferences-startup-disk.md, in points
 * from the top-left corner of the window frame.
 */
export function StartupDisk() {
  const [volumes] = usePreference<readonly StartupVolume[]>("startup-disk.volumes", [
    MACINTOSH_SSD,
  ]);
  const [scanning] = usePreference("startup-disk.scanning", false);
  const [selected, setSelected] = usePreference<string>("startup-disk.selected", MACINTOSH_SSD.id);
  const [lock, setLock] = usePreference<"locked" | "unlocked">("startup-disk.lock", "locked");
  const id = useId();
  const locked = lock === "locked";
  const startup = volumes.find((volume) => volume.id === selected);

  return (
    <PaneForm>
      <PaneAt x={22.5} y={56.5}>
        <Label id={`${id}-heading`} textStyle="emphasized">
          Select the system you want to use to start up your computer
        </Label>
      </PaneAt>
      {scanning ? (
        <PaneAt x={630} y={57}>
          <ProgressSpinner size="small" aria-label="Looking for startup disks" />
        </PaneAt>
      ) : null}

      <PaneAt x={CHOOSER.x} y={CHOOSER.y}>
        <Box
          variant="content"
          aria-labelledby={`${id}-heading`}
          style={{ width: 628, height: 100 }}
        >
          <PaneForm origin={CHOOSER}>
            {volumes.map((volume, index) => (
              <PaneAt key={volume.id} x={CHOOSER.x + index * CELL} y={90.5} width={CELL}>
                {/* The artwork starts 5 pt under the button's top edge; the hook closes the gap
                    to the caption, which starts right under the artwork. */}
                <ImageButton
                  aria-label={`${volume.name}, ${volume.system}`}
                  aria-pressed={volume.id === selected}
                  disabled={locked}
                  onClick={() => setSelected(volume.id)}
                  label={
                    <>
                      {volume.name}
                      <br />
                      {volume.system}
                    </>
                  }
                  style={{ width: "100%", "--mac-image-button-gap": "1px" } as CSSProperties}
                >
                  <DiskArtwork kind={volume.kind} />
                </ImageButton>
              </PaneAt>
            ))}
          </PaneForm>
        </Box>
      </PaneAt>

      <PaneAt x={28.5} y={191}>
        <Label textStyle="small" aria-live="polite">
          {startup ? (
            <>
              You have selected {startup.system}
              <br />
              on the disk “{startup.name}.”
            </>
          ) : (
            "You have not selected a startup disk."
          )}
        </Label>
      </PaneAt>
      <PaneAt x={495} y={199}>
        <Uncaptured action="Restart…">
          <PushButton style={{ width: 153, paddingInline: 0 }}>Restart…</PushButton>
        </Uncaptured>
      </PaneAt>

      <PaneAt x={23.5} y={255.5}>
        <Label>Click to restart this computer in target disk mode</Label>
      </PaneAt>
      <PaneAt x={495} y={254}>
        <Uncaptured action="Target Disk Mode…">
          <PushButton style={{ width: 153, paddingInline: 0 }}>Target Disk Mode…</PushButton>
        </Uncaptured>
      </PaneAt>
      <PaneAt x={23} y={274}>
        <Label textStyle="small">
          After you restart this computer in target disk mode, you can connect it to
          <br />
          another computer using a Thunderbolt or FireWire cable and use it as a
          <br />
          hard disk.
        </Label>
      </PaneAt>

      <PaneFooter x={19.5} y={354.5}>
        <LockButton state={lock} onClick={() => setLock(locked ? "unlocked" : "locked")} />
      </PaneFooter>
    </PaneForm>
  );
}
