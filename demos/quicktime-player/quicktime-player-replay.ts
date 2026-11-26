/**
 * Movie edits by replay, where the browser cannot encode one itself (`quicktime-player-encode.ts`): an
 * edit plays the source through a canvas (for the picture) and Web Audio (for the sound) and records
 * what comes out with `MediaRecorder`, in real time. Trimming to a stretch, turning, flipping, resizing,
 * leaving out a track and putting clips in another order are all this one pass. The result is a new
 * recording, in the browser's recording format.
 */
import { encodeMovie } from "./quicktime-player-encode";
import {
  editedSize,
  type MovieEdit,
  type MoviePiece,
  moviePainter,
} from "./quicktime-player-picture";
import { plainType, recordingType } from "./quicktime-player-recording-files";

/** Answers when `event` comes. */
const waitFor = (element: HTMLMediaElement, event: string) =>
  new Promise<void>((resolve) => {
    element.addEventListener(event, () => resolve(), { once: true });
  });

/** How long the browser may take to start the sound before an edit gives up. */
const SOUND_START_MS = 5000;

/**
 * Plays `source`, a movie or pieces of movies in order, through the edit and answers the recording. The
 * picture keeps the size of the first piece with one: a piece of another shape shows whole on black, and
 * a piece of sound alone on black. `onProgress` hears the share done, 0 to 1. Rejects when the browser
 * cannot play the source, start its sound or record, when the movie or the recorder fails along the way,
 * or when `signal` aborts: whatever it was waiting for, and with all it held let go. Call it from the
 * person's press: the sound is started before the first wait. `onJoin` hears where in the recording each
 * later piece begins, in seconds of what was recorded: playback runs a little past each piece's end
 * before it stops, so these can differ from the pieces' lengths.
 */
export async function replayMovie(
  source: Blob | readonly MoviePiece[],
  edit: MovieEdit,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
  onJoin?: (seconds: number) => void,
): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") throw new Error("this browser cannot record");
  const pieces: readonly MoviePiece[] =
    source instanceof Blob
      ? [{ blob: source, start: edit.start ?? 0, end: edit.end ?? Number.POSITIVE_INFINITY }]
      : source;
  // One element for each movie: a movie's element can give its sound to Web Audio only once.
  const elements = new Map<Blob, { video: HTMLVideoElement; url: string }>();
  for (const { blob } of pieces) {
    if (elements.has(blob)) continue;
    const video = document.createElement("video");
    video.playsInline = true;
    video.preload = "auto";
    // What leaves the element goes to the recorder through Web Audio; with no sound wanted it goes nowhere.
    video.muted = edit.noAudio === true;
    elements.set(blob, { video, url: URL.createObjectURL(blob) });
  }
  const videos = [...elements.values()].map((each) => each.video);
  const context = edit.noAudio ? null : new AudioContext();
  const soundStarted = context?.resume();
  let painting: ReturnType<typeof setInterval> | undefined;
  let watching: ReturnType<typeof setInterval> | undefined;
  let soundWait: ReturnType<typeof setTimeout> | undefined;
  let recorder: MediaRecorder | null = null;
  const tracks: MediaStreamTrack[] = [];

  // Whatever is waited for, a cancellation or a failure of the movie or the recorder ends the wait.
  let stopWaiting: (reason: unknown) => void = () => {};
  const ended = new Promise<never>((_resolve, reject) => {
    stopWaiting = reject;
  });
  ended.catch(() => {});
  const cancelled = () => stopWaiting(signal?.reason ?? new Error("cancelled"));
  if (signal?.aborted) cancelled();
  signal?.addEventListener("abort", cancelled);
  const movieFailed = () => stopWaiting(new Error("this browser cannot play the movie"));
  for (const video of videos) video.addEventListener("error", movieFailed);
  const until = <T>(wait: Promise<T>) => Promise.race([wait, ended]);
  const seekTo = async (video: HTMLVideoElement, seconds: number) => {
    const seeked = until(waitFor(video, "seeked"));
    video.currentTime = seconds;
    await seeked;
  };

  try {
    const encoded = await until(encodeMovie(pieces, edit, onProgress, signal, onJoin));
    if (encoded) return encoded;
    if (soundStarted) {
      await until(
        Promise.race([
          soundStarted,
          new Promise<never>((_resolve, reject) => {
            soundWait = setTimeout(
              () => reject(new Error("the browser did not start the sound")),
              SOUND_START_MS,
            );
          }),
        ]),
      );
    }
    for (const { video, url } of elements.values()) {
      const loaded = until(waitFor(video, "loadedmetadata"));
      video.src = url;
      await loaded;
      if (!Number.isFinite(video.duration)) await seekTo(video, Number.MAX_SAFE_INTEGER);
    }
    const stretches = pieces.flatMap((piece) => {
      const video = elements.get(piece.blob)?.video;
      if (!video) return [];
      const start = Math.max(0, piece.start);
      const end = Math.min(video.duration, piece.end);
      return end > start ? [{ video, start, end }] : [];
    });
    const first = stretches[0];
    if (!first) throw new Error("nothing is left of the movie");
    const pictured = stretches.find(({ video }) => video.videoWidth > 0 && video.videoHeight > 0);
    const wantPicture = pictured !== undefined && !edit.noVideo;
    if (!wantPicture && edit.noAudio) throw new Error("nothing is left of the movie");

    // A picture is drawn only once the frame at the start has been decoded.
    await seekTo(first.video, first.start);

    let shown = first.video;
    let paint = () => {};
    if (wantPicture) {
      const size = editedSize(pictured.video.videoWidth, pictured.video.videoHeight, edit);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const draw = canvas.getContext("2d");
      if (!draw) throw new Error("this browser cannot draw the movie");
      const turnFrame = moviePainter(draw, size, edit);
      paint = () => turnFrame(shown);
      paint();
      painting = setInterval(paint, 33);
      tracks.push(...canvas.captureStream().getVideoTracks());
    }
    if (context) {
      const output = context.createMediaStreamDestination();
      for (const video of videos) context.createMediaElementSource(video).connect(output);
      tracks.push(...output.stream.getAudioTracks());
    }

    const type = recordingType(wantPicture ? "movie" : "audio", (each) =>
      MediaRecorder.isTypeSupported(each),
    );
    const take = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type } : undefined);
    recorder = take;
    const chunks: Blob[] = [];
    take.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    take.addEventListener("error", (event) => {
      const said = (event as Event & { error?: { message?: unknown } }).error?.message;
      stopWaiting(new Error(typeof said === "string" && said ? said : "the recorder failed"));
    });
    const stopped = new Promise<void>((resolve) =>
      take.addEventListener("stop", () => resolve(), { once: true }),
    );
    const whole = stretches.reduce((sum, { start, end }) => sum + end - start, 0);
    let done = 0;
    let recorded = 0;
    for (const [index, { video, start, end }] of stretches.entries()) {
      if (index > 0) {
        // The recorder keeps no time for the seek, or the join would hold a frame still.
        take.pause();
        onJoin?.(recorded);
        shown = video;
        await seekTo(video, start);
        paint();
      }
      // The recorder waits for the movie to move: what it took before that would be a still frame, and
      // every later moment in the result would fall that much after its place.
      await until(video.play());
      if (index === 0) take.start();
      else take.resume();
      const began = performance.now();
      await until(
        new Promise<void>((resolve, reject) => {
          watching = setInterval(() => {
            onProgress(Math.min(1, (done + video.currentTime - start) / whole));
            if (video.currentTime >= end || video.ended) resolve();
            else if (take.state === "inactive") reject(new Error("the recorder stopped early"));
          }, 20);
        }),
      );
      clearInterval(watching);
      video.pause();
      recorded += (performance.now() - began) / 1000;
      done += end - start;
    }
    if (take.state !== "inactive") take.stop();
    await until(stopped);
    // A recorder tells its error before the stop it causes: what that left is not the whole movie.
    await Promise.race([ended, Promise.resolve()]);
    if (chunks.length === 0) throw new Error("nothing was recorded");
    return new Blob(chunks, { type: plainType(take.mimeType || type || "") });
  } finally {
    clearInterval(painting);
    clearInterval(watching);
    clearTimeout(soundWait);
    signal?.removeEventListener("abort", cancelled);
    for (const video of videos) {
      video.removeEventListener("error", movieFailed);
      video.pause();
    }
    if (recorder && recorder.state !== "inactive") recorder.stop();
    for (const track of tracks) track.stop();
    context?.close().catch(() => {});
    for (const { video, url } of elements.values()) {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
  }
}
