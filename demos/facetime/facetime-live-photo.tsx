"use client";

import { PushButton } from "macalicious/push-button";

/** Why Live Photo is dimmed. */
export const NO_LIVE_PHOTO = "A Live Photo needs the other person's picture in a video call.";

const JPEG_QUALITY = 0.92;

/** The frame `video` shows now, as a JPEG: `null` when it has no frame or the browser cannot encode one. */
async function frameOf(video: HTMLVideoElement): Promise<Blob | null> {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}

/** How long the motion of a Live Photo lasts, from the moment it is taken. */
export const LIVE_MOTION_MS = 3_000;

/**
 * The next `ms` of the picture and sound `video` plays, as a movie: `null` when the browser cannot
 * record it. A page has no moments before the press without recording all along, so it starts there.
 */
export function motionOf(
  video: HTMLVideoElement,
  ms: number = LIVE_MOTION_MS,
): Promise<Blob | null> {
  const stream = video.srcObject;
  if (
    typeof MediaRecorder === "undefined" ||
    typeof MediaStream === "undefined" ||
    !(stream instanceof MediaStream)
  ) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      resolve(null);
      return;
    }
    const pieces: Blob[] = [];
    recorder.ondataavailable = (event) => pieces.push(event.data);
    recorder.onerror = () => resolve(null);
    recorder.onstop = () =>
      resolve(pieces.length ? new Blob(pieces, { type: recorder.mimeType }) : null);
    recorder.start();
    setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, ms);
  });
}

/**
 * Tells the others in the call, then keeps the frame `video` shows in the person's Photos library,
 * and the seconds that follow beside it, with their sound. No picture is kept unless they were told.
 * Answers the sentence to tell the person.
 */
export async function keepLivePhoto(
  video: HTMLVideoElement | null,
  tell: () => Promise<string | null>,
  now: number = Date.now(),
): Promise<string> {
  const person = video?.dataset.remote ?? "the other person";
  const frame = video && (await frameOf(video));
  if (!frame) return `There was no picture of ${person} to take.`;
  const untold = await tell();
  if (untold) return `The Live Photo was not taken: ${untold}.`;
  const { importPicture } = await import("../photos/photos-library");
  try {
    const motion = video ? await motionOf(video) : null;
    await importPicture(frame, { name: `FaceTime Photo of ${person}`, takenMs: now });
    if (!motion) return `Live Photo of ${person} saved to Photos, as a still.`;
    await importPicture(motion, { name: `FaceTime Live Photo of ${person}`, takenMs: now });
    return `Live Photo of ${person} saved to Photos, with its motion and sound.`;
  } catch (error) {
    const why = error instanceof Error ? error.message : "The library refused it";
    return `The Live Photo could not be saved. ${why}.`;
  }
}

/**
 * The call panel's Live Photo: a still of the other person's picture and the seconds that follow, kept
 * in Photos, with the others told first.
 */
export function LivePhotoButton({
  video,
  tell,
  unavailable,
  onTaken,
}: {
  /** The picture to take, read when it is pressed. */
  video: () => HTMLVideoElement | null;
  /** Tells the others in the call: `null`, or why they could not be told. */
  tell: () => Promise<string | null>;
  /** Why the button is dimmed, when it is. */
  unavailable?: string;
  /** Told the sentence to show once it is kept, or why it was not. */
  onTaken: (sentence: string) => void;
}) {
  return (
    <PushButton
      size="small"
      disabled={unavailable !== undefined}
      title={unavailable}
      onClick={() => void keepLivePhoto(video(), tell).then(onTaken)}
    >
      Live Photo
    </PushButton>
  );
}
