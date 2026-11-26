import { describe, expect, it } from "vitest";
import {
  derivedName,
  plainType,
  recordingName,
  recordingProblem,
  recordingType,
  timeText,
} from "./quicktime-player-recording-files";

const AT = new Date(2026, 10, 1, 9, 5, 7);

describe("QuickTime Player's recording files", () => {
  it("names a take as macOS names a screen recording, with the extension of what was recorded", () => {
    expect(recordingName("movie", "video/webm;codecs=vp8,opus", AT)).toBe(
      "Movie Recording 2026-11-01 at 09.05.07.webm",
    );
    expect(recordingName("movie", "video/mp4", AT)).toBe(
      "Movie Recording 2026-11-01 at 09.05.07.mp4",
    );
    expect(recordingName("audio", "audio/mp4", AT)).toBe(
      "Audio Recording 2026-11-01 at 09.05.07.m4a",
    );
    expect(recordingName("screen", "", AT)).toBe("Screen Recording 2026-11-01 at 09.05.07.webm");
  });

  it("names a copy once, in the format it now is", () => {
    expect(derivedName("Harbour.mov", "edited", "video/webm")).toBe("Harbour edited.webm");
    expect(derivedName("Harbour edited.webm", "edited", "video/webm")).toBe("Harbour edited.webm");
    expect(derivedName("Harbour.webm", "audio only", "audio/mp4")).toBe("Harbour audio only.m4a");
  });

  it("asks for WebM first and falls back to what the browser records", () => {
    expect(recordingType("movie", () => true)).toBe("video/webm;codecs=vp8,opus");
    expect(recordingType("audio", () => true)).toBe("audio/webm;codecs=opus");
    expect(recordingType("screen", (type) => type === "video/mp4")).toBe("video/mp4");
    expect(recordingType("audio", (type) => type === "audio/mp4")).toBe("audio/mp4");
    expect(recordingType("movie", () => false)).toBeUndefined();
  });

  it("keeps a media type without its parameters", () => {
    expect(plainType("video/webm;codecs=vp8,opus")).toBe("video/webm");
    expect(plainType("")).toBe("");
  });

  it("shows a length in minutes, and hours when it has them", () => {
    expect(timeText(0)).toBe("0:00");
    expect(timeText(125)).toBe("2:05");
    expect(timeText(3723)).toBe("1:02:03");
  });

  it("says why a device was refused", () => {
    const refused = new DOMException("no", "NotAllowedError");
    const missing = new DOMException("no", "NotFoundError");
    expect(recordingProblem("audio", refused)).toContain("not allowed to use the microphone");
    expect(recordingProblem("screen", refused)).toContain("cancelled");
    expect(recordingProblem("movie", missing)).toBe("No camera is connected.");
    expect(recordingProblem("audio", new Error("broke"))).toBe(
      "The recording could not be started: broke",
    );
  });
});
