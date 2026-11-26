/*
 * A slideshow recorded as a movie: File > Export of a saved slideshow. The pictures are drawn on a
 * canvas as long as they would be shown, and a movie of the show as long as it runs, so recording
 * takes as long as the slideshow runs, and the browser's MediaRecorder writes what the canvas, the
 * chosen song and the movies' own sound give it.
 */

import { readDriveFile } from "./photos-drive";
import { NO_EDIT, renderEdit } from "./photos-edit";
import { decodePicture, type LibraryPhoto, readOriginal } from "./photos-library";
import { isVideo } from "./photos-served-data";

const MOVIE_WIDTH = 1280;
const MOVIE_HEIGHT = 720;
const FRAMES_PER_SECOND = 30;
/** How far Ken Burns moves in on a picture while it is shown. */
const KEN_BURNS_ZOOM = 0.08;
/** How long a dissolve takes, at most half the time a picture is shown, in seconds. */
const DISSOLVE_SECONDS = 1;

const MOVIE_TYPES = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];

/** The kind of movie this browser records, or `null` where it records none. */
export function slideshowMovieType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MOVIE_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export const slideshowMovieExtension = (type: string) =>
  type.startsWith("video/mp4") ? "mp4" : "webm";

async function pictureOf(photo: LibraryPhoto): Promise<ImageBitmap> {
  const decoded = await decodePicture(await readOriginal(photo));
  try {
    return await createImageBitmap(renderEdit(decoded, photo.edit ?? NO_EDIT, MOVIE_WIDTH));
  } finally {
    decoded.close();
  }
}

function draw(
  context: CanvasRenderingContext2D,
  picture: ImageBitmap,
  zoom: number,
  alpha: number,
) {
  const scale = Math.min(MOVIE_WIDTH / picture.width, MOVIE_HEIGHT / picture.height) * zoom;
  const width = picture.width * scale;
  const height = picture.height * scale;
  context.globalAlpha = alpha;
  context.drawImage(picture, (MOVIE_WIDTH - width) / 2, (MOVIE_HEIGHT - height) / 2, width, height);
  context.globalAlpha = 1;
}

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 1000 / FRAMES_PER_SECOND));

/** A movie of the show, loaded to its first frame. */
async function movieOf(photo: LibraryPhoto): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.playsInline = true;
  video.src = URL.createObjectURL(await readOriginal(photo));
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(video.error ?? new Error("the movie cannot be read"));
  });
  return video;
}

function drawMovie(context: CanvasRenderingContext2D, video: HTMLVideoElement) {
  const scale = Math.min(MOVIE_WIDTH / video.videoWidth, MOVIE_HEIGHT / video.videoHeight);
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  context.fillStyle = "#000";
  context.fillRect(0, 0, MOVIE_WIDTH, MOVIE_HEIGHT);
  context.drawImage(video, (MOVIE_WIDTH - width) / 2, (MOVIE_HEIGHT - height) / 2, width, height);
}

export interface SlideshowMovieOptions {
  theme: string;
  seconds: number;
  /** The drive file of the song played under it, as long as the movie runs. */
  musicFile?: string;
  type: string;
}

/** The slideshow's pictures and movies, one after another, as a movie of the kind asked for. */
export async function recordSlideshow(
  photos: readonly LibraryPhoto[],
  { theme, seconds, musicFile, type }: SlideshowMovieOptions,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = MOVIE_WIDTH;
  canvas.height = MOVIE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("this browser cannot draw a movie");
  context.fillRect(0, 0, MOVIE_WIDTH, MOVIE_HEIGHT);
  const stream = canvas.captureStream(FRAMES_PER_SECOND);
  const audio = musicFile || photos.some(isVideo) ? new AudioContext() : null;
  const heard = audio?.createMediaStreamDestination();
  const songLevel = audio?.createGain();
  let source: AudioBufferSourceNode | null = null;
  let silence: ConstantSourceNode | null = null;
  let recorder: MediaRecorder | null = null;
  let previous: ImageBitmap | null = null;
  let failure: unknown = null;
  const parts: Blob[] = [];
  let stopped: Promise<unknown> = Promise.resolve();
  try {
    if (heard) for (const track of heard.stream.getAudioTracks()) stream.addTrack(track);
    if (audio && heard) {
      // Chromium's recorder holds back the picture until its sound track has data: the pictures
      // before a show's first movie would be lost with nothing playing into the track.
      silence = audio.createConstantSource();
      silence.offset.value = 0;
      silence.connect(heard);
      silence.start();
    }
    if (audio && musicFile && heard && songLevel) {
      const song = await audio.decodeAudioData(
        await (await readDriveFile(musicFile, "")).arrayBuffer(),
      );
      source = audio.createBufferSource();
      source.buffer = song;
      source.loop = true;
      source.connect(songLevel).connect(heard);
      await audio.suspend();
      source.start();
    }
    const started = new MediaRecorder(stream, { mimeType: type });
    recorder = started;
    started.ondataavailable = (event) => parts.push(event.data);
    started.onerror = (event) => {
      failure = (event as Event & { error?: unknown }).error ?? new Error("the recorder failed");
    };
    stopped = new Promise((resolve) => {
      started.onstop = resolve;
    });
    for (const photo of photos) {
      // Reading a picture takes as long as it takes: the movie and its song wait, so that each
      // picture runs for its own time and none is held on screen meanwhile.
      if (started.state === "recording") started.pause();
      await audio?.suspend();
      if (isVideo(photo)) {
        const video = await movieOf(photo).catch((error: unknown) => {
          console.warn(`Photos left a movie out of the slideshow (${error})`);
          return null;
        });
        if (!video) continue;
        try {
          if (audio && heard) audio.createMediaElementSource(video).connect(heard);
          if (songLevel) songLevel.gain.value = 0;
          await audio?.resume();
          if (started.state === "inactive") started.start();
          else started.resume();
          await video.play().catch((error: unknown) => {
            if (!(error instanceof DOMException && error.name === "NotAllowedError")) throw error;
            video.muted = true;
            return video.play();
          });
          for (;;) {
            if (failure) throw failure;
            drawMovie(context, video);
            if (video.ended || video.paused || video.error) break;
            await nextFrame();
          }
        } finally {
          video.pause();
          if (songLevel) songLevel.gain.value = 1;
          URL.revokeObjectURL(video.src);
        }
        previous?.close();
        previous = null;
        continue;
      }
      const picture = await pictureOf(photo);
      await audio?.resume();
      if (started.state === "inactive") started.start();
      else started.resume();
      const fade = Math.min(DISSOLVE_SECONDS, seconds / 2) * 1000;
      const shown = seconds * 1000;
      const began = performance.now();
      for (;;) {
        if (failure) throw failure;
        const passed = performance.now() - began;
        context.fillStyle = "#000";
        context.fillRect(0, 0, MOVIE_WIDTH, MOVIE_HEIGHT);
        const zoom = theme === "ken-burns" ? 1 + (KEN_BURNS_ZOOM * passed) / shown : 1;
        if (theme === "dissolve" && previous && passed < fade) {
          draw(context, previous, 1, 1);
          draw(context, picture, zoom, passed / fade);
        } else draw(context, picture, zoom, 1);
        if (passed >= shown) break;
        await nextFrame();
      }
      previous?.close();
      previous = picture;
    }
  } finally {
    previous?.close();
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      await stopped;
    }
    source?.stop();
    silence?.stop();
    for (const track of stream.getTracks()) track.stop();
    await audio?.close();
  }
  if (failure) throw failure;
  return new Blob(parts, { type: type.split(";")[0] });
}
