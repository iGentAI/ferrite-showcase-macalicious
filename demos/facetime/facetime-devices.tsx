"use client";

import { MenuItem, MenuRadioGroup, MenuRadioItem } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useEffect, useRef, useState } from "react";

/** Where the person's choices of Video > Camera, Microphone and Output are kept. */
export const FACETIME_DEVICES = "facetime.devices";

/**
 * The devices chosen, by their names: a browser gives a device a different id in each browser and, in
 * a private window, after a reload. None chosen means the browser's default.
 */
export interface FaceTimeDevices {
  camera?: string;
  microphone?: string;
  output?: string;
}

export const NO_DEVICES: FaceTimeDevices = {};

/** The choices as stored, leaving out whatever FaceTime did not write. */
export function readDevices(stored: unknown): FaceTimeDevices | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { camera, microphone, output } = stored as Record<string, unknown>;
  return {
    ...(typeof camera === "string" ? { camera } : {}),
    ...(typeof microphone === "string" ? { microphone } : {}),
    ...(typeof output === "string" ? { output } : {}),
  };
}

/**
 * What to ask the browser for, given the ids of the devices chosen: first what is wanted and then with
 * less, with what the person is told if only that much could be had. The chosen devices are asked for
 * exactly, as Chromium 156 answers `ideal` with its default camera; one that has gone falls to the
 * browser's default.
 */
export function mediaAttempts({
  camera,
  microphone,
}: FaceTimeDevices): readonly (readonly [MediaStreamConstraints, string | undefined])[] {
  const chosen: MediaStreamConstraints = {
    video: camera ? { deviceId: { exact: camera } } : true,
    audio: microphone ? { deviceId: { exact: microphone } } : true,
  };
  return [
    ...(camera || microphone ? ([[chosen, undefined]] as const) : []),
    [{ video: true, audio: true }, undefined],
    [{ video: true }, "FaceTime cannot use your microphone; calls carry your picture only."],
    [{ audio: true }, "FaceTime cannot use your camera; calls carry sound only."],
  ];
}

/**
 * Puts a new device's tracks on a call under way, and says what the window then holds. A kind the new
 * stream lacks (it fell back to less), or one the call could not take, stays as it was, so that a
 * failed switch leaves the call working; what is left over is `released`, to be stopped. A sender with
 * no track was never sending: a kind the call started without joins on the next call. The senders of
 * a group's several connections move together: when one refuses a kind, those that took it go back.
 */
export async function moveCallTo(
  got: Pick<MediaStream, "getTracks">,
  before: Pick<MediaStream, "getTracks"> | null,
  senders: readonly Pick<RTCRtpSender, "track" | "replaceTrack">[],
): Promise<{ tracks: MediaStreamTrack[]; released: MediaStreamTrack[]; failed: boolean }> {
  const next = got.getTracks();
  const old = before?.getTracks() ?? [];
  const refused = new Set<string>();
  const moved: (readonly [Pick<RTCRtpSender, "replaceTrack">, MediaStreamTrack])[] = [];
  for (const sender of senders) {
    const held = sender.track;
    const track = next.find((each) => each.kind === held?.kind);
    if (!held || !track || track === held) continue;
    try {
      await sender.replaceTrack(track);
      moved.push([sender, held]);
    } catch {
      refused.add(held.kind);
    }
  }
  for (const [sender, held] of moved) {
    if (refused.has(held.kind)) await sender.replaceTrack(held).catch(() => {});
  }
  const stays = (track: MediaStreamTrack) =>
    track.readyState !== "ended" &&
    (refused.has(track.kind) || !next.some((each) => each.kind === track.kind));
  return {
    tracks: [...next.filter((track) => !refused.has(track.kind)), ...old.filter(stays)],
    released: [
      ...old.filter((track) => !stays(track)),
      ...next.filter((track) => refused.has(track.kind)),
    ],
    failed: refused.size > 0,
  };
}

interface DeviceLists {
  cameras: readonly MediaDeviceInfo[];
  microphones: readonly MediaDeviceInfo[];
  outputs: readonly MediaDeviceInfo[];
}

/** The browser's devices: named only once it has given the page a device, so read again then. */
export function useDeviceLists(asked: unknown): DeviceLists {
  const [lists, setLists] = useState<DeviceLists>({ cameras: [], microphones: [], outputs: [] });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `asked` is the moment the names become known
  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;
    let stopped = false;
    const read = () =>
      void media.enumerateDevices().then((all) => {
        if (stopped) return;
        const named = all.filter((each) => each.deviceId !== "" && each.label !== "");
        setLists({
          cameras: named.filter((each) => each.kind === "videoinput"),
          microphones: named.filter((each) => each.kind === "audioinput"),
          outputs: named.filter((each) => each.kind === "audiooutput"),
        });
      });
    read();
    media.addEventListener?.("devicechange", read);
    return () => {
      stopped = true;
      media.removeEventListener?.("devicechange", read);
    };
  }, [asked]);
  return lists;
}

/** The id, in this browser now, of the device of `devices` with the name kept. */
export const idOf = (devices: readonly MediaDeviceInfo[], name: string | undefined) =>
  devices.find((each) => each.label === name)?.deviceId;

/**
 * The camera and microphone: asked for when the window opens, let go when it closes, and asked for
 * again when the person's choice is known, since a browser names its devices only once it has given
 * the page one. One asking runs at a time, each taking over from what the one before left, so the
 * latest choice ends up on the window and the call, and what was in use is let go only once the new
 * tracks have taken over from it.
 */
export function useLocalMedia(
  devices: FaceTimeDevices,
  senders: () => readonly Pick<RTCRtpSender, "track" | "replaceTrack">[],
  tell: (notice: string) => void,
  /** FaceTime is off: nothing is asked for, and what was held is let go. */
  off = false,
) {
  const [local, setLocal] = useState<MediaStream | null>(null);
  // Whether asking has been answered, either way.
  const [settled, setSettled] = useState(false);
  const lists = useDeviceLists(local);
  const camera = idOf(lists.cameras, devices.camera);
  const microphone = idOf(lists.microphones, devices.microphone);
  const held = useRef<MediaStream | null>(null);
  const turn = useRef(Promise.resolve());
  const open = useRef(true);
  const asks = useRef({ senders, tell });
  asks.current = { senders, tell };
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      for (const track of held.current?.getTracks() ?? []) track.stop();
      held.current = null;
    };
  }, []);
  useEffect(() => {
    let superseded = false;
    const ask = async () => {
      if (superseded) return;
      if (off) {
        for (const track of held.current?.getTracks() ?? []) track.stop();
        held.current = null;
        setLocal(null);
        setSettled(true);
        return;
      }
      const media = navigator.mediaDevices;
      if (!media?.getUserMedia) {
        asks.current.tell("This browser cannot use a camera or a microphone here.");
        setSettled(true);
        return;
      }
      let got: MediaStream | null = null;
      for (const [constraints, warning] of mediaAttempts({ camera, microphone })) {
        try {
          got = await media.getUserMedia(constraints);
          if (warning) asks.current.tell(warning);
          break;
        } catch {
          // Try with less.
        }
      }
      if (superseded || !open.current) {
        for (const track of got?.getTracks() ?? []) track.stop();
        return;
      }
      if (!got) {
        if (!held.current) {
          asks.current.tell(
            "FaceTime cannot use your camera or microphone. Allow them for this page.",
          );
        }
        setSettled(true);
        return;
      }
      const moved = await moveCallTo(got, held.current, asks.current.senders());
      for (const track of moved.released) track.stop();
      const fresh = got.getTracks();
      const stream =
        moved.tracks.length === fresh.length && moved.tracks.every((each) => fresh.includes(each))
          ? got
          : new MediaStream(moved.tracks);
      // Only now is it the stream to take over from: a later asking waits for this one.
      if (!open.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      held.current = stream;
      if (moved.failed) {
        asks.current.tell(
          "The call could not move to that device. It goes on with the one it had.",
        );
      }
      setLocal(stream);
      setSettled(true);
    };
    turn.current = turn.current.then(ask);
    return () => {
      superseded = true;
    };
  }, [camera, microphone, off]);
  return { local, settled, lists };
}

/** Why Video > Output is dimmed in a browser that cannot send a page's sound elsewhere. */
export const OUTPUT_UNAVAILABLE =
  "This browser plays a page's sound through its own output: FaceTime cannot choose another.";

export const canChooseOutput = () =>
  typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

/** One of Video > Camera, Microphone and Output: the devices, with the one in use chosen. */
export function DeviceSubmenu({
  title,
  devices,
  value,
  unavailable,
  onChoose,
}: {
  title: string;
  devices: readonly MediaDeviceInfo[];
  value: string | undefined;
  /** Why the submenu is dimmed, when it does not depend on the devices. */
  unavailable?: string;
  onChoose: (name: string) => void;
}) {
  if (unavailable !== undefined || devices.length === 0) {
    return (
      <MenuItem
        disabled
        title={unavailable ?? `This browser offers FaceTime no ${title.toLowerCase()}.`}
      >
        {title}
      </MenuItem>
    );
  }
  return (
    <Submenu>
      <SubmenuTrigger>{title}</SubmenuTrigger>
      <SubmenuPopup>
        <MenuRadioGroup value={value} onValueChange={(next) => onChoose(String(next))}>
          {devices.map(({ deviceId, label }) => (
            <MenuRadioItem key={deviceId} value={label}>
              {label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </SubmenuPopup>
    </Submenu>
  );
}
