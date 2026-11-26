"use client";

import { MediaAppChromeButton } from "macalicious/media-app-chrome";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { useState } from "react";

/** Why the Audio output button is unavailable, as its tooltip says. */
export const AUDIO_OUTPUT_UNAVAILABLE =
  "Choosing where Music’s sound plays isn’t available in this browser: it plays through the browser’s own sound output.";
/** What the menu says while the browser keeps the outputs' names to itself. */
export const OUTPUTS_HIDDEN =
  "The browser names other outputs once this desktop may use the microphone.";
/** The menu's first row: wherever the browser sends sound. */
export const BROWSER_OUTPUT = "Browser’s Sound Output";

const canChooseOutput = () =>
  typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

/**
 * The kept output, when it is one: the device's name, or `""` for the browser's own. A device's id
 * changes for a page in a private window and when the site's data is cleared; its name does not.
 */
export const readOutput = (stored: unknown) => (typeof stored === "string" ? stored : undefined);

/** The id of the output named `label`; refused when the browser names no such output now. */
export async function outputIdOf(label: string): Promise<string> {
  if (label === "") return "";
  const device = (await namedOutputs()).find((each) => each.label === label);
  if (!device) throw new Error(`no output named ${label}`);
  return device.deviceId;
}

/** The devices the browser names; the two it lists for its own default are the menu's first row. */
async function namedOutputs(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(
    (device) =>
      device.kind === "audiooutput" &&
      device.label !== "" &&
      device.deviceId !== "" &&
      device.deviceId !== "default" &&
      device.deviceId !== "communications",
  );
}

/** Sends the elements' sound to the output `id`; `""` is the browser's own. */
export async function sendSoundTo(media: readonly HTMLMediaElement[], id: string): Promise<void> {
  await Promise.all(
    media.map((each) =>
      (each as HTMLMediaElement & { setSinkId(id: string): Promise<void> }).setSinkId(id),
    ),
  );
}

export interface MusicOutputButtonProps {
  /** The output chosen: a device's name, or `""` for the browser's own. */
  output: string;
  onChoose: (output: string) => void;
}

/** The volume slider's button: a menu of the sound outputs the browser names. */
export function MusicOutputButton({ output, onChoose }: MusicOutputButtonProps) {
  const [outputs, setOutputs] = useState<readonly MediaDeviceInfo[]>([]);
  if (!canChooseOutput()) {
    return (
      <MediaAppChromeButton
        glyph="output"
        aria-label="Audio output"
        title={AUDIO_OUTPUT_UNAVAILABLE}
        disabled
      />
    );
  }
  return (
    <Menu
      onOpenChange={(open) => {
        if (open) void namedOutputs().then(setOutputs, () => setOutputs([]));
      }}
    >
      <MenuTrigger render={<MediaAppChromeButton glyph="output" aria-label="Audio output" />} />
      <MenuPopup aria-label="Audio output">
        <MenuRadioGroup value={output} onValueChange={(next) => onChoose(String(next))}>
          <MenuRadioItem value="">{BROWSER_OUTPUT}</MenuRadioItem>
          {outputs.map((device) => (
            <MenuRadioItem key={device.deviceId} value={device.label}>
              {device.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        {outputs.length === 0 ? (
          <>
            <MenuSeparator />
            <MenuItem disabled>{OUTPUTS_HIDDEN}</MenuItem>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}
