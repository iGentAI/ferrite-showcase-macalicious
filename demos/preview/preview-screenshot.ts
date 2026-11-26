import { canvasBlob } from "./preview-export";

/** The rows of File > Take Screenshot. */
export type ScreenshotKind = "selection" | "window" | "screen";

/** Why the rows are dimmed where the browser cannot capture. */
export const NO_CAPTURE = "This browser cannot capture the screen for a web page.";

export const canCaptureScreen = (): boolean =>
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);

/** A screenshot's name, as a Mac names it. */
export function screenshotName(at: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  return `Screen Shot ${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} at ${two(
    at.getHours(),
  )}.${two(at.getMinutes())}.${two(at.getSeconds())}.png`;
}

/**
 * One frame of what the person shares in the browser's own chooser, as a PNG: `null` when they turn
 * it down. The chooser starts on a window or on the whole screen as `kind` asks, and the browser
 * decides what they may pick.
 */
export async function captureScreen(kind: ScreenshotKind): Promise<Blob | null> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: kind === "screen" ? "monitor" : "window" },
      audio: false,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") return null;
    throw error;
  }
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return await canvasBlob(canvas, "image/png");
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}
