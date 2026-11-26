/**
 * What every way of making an edited movie shares (`quicktime-player-replay.ts`,
 * `quicktime-player-encode.ts`): what is asked of it, and how a frame is drawn.
 */

export interface MovieEdit {
  /** Where the result begins and ends, in seconds of the source; by default all of it. */
  start?: number;
  end?: number;
  /** Quarter turns clockwise. */
  turns?: 0 | 1 | 2 | 3;
  flipX?: boolean;
  flipY?: boolean;
  /** The picture's height at most, in pixels: Export As's sizes. */
  height?: number;
  /** Leaves the sound out. */
  noAudio?: boolean;
  /** Leaves the picture out. */
  noVideo?: boolean;
}

/** A stretch of a movie, for an edit of several in order. */
export interface MoviePiece {
  blob: Blob;
  /** Where it begins and ends, in seconds of that movie. */
  start: number;
  end: number;
}

/** The picture's size after an edit: turned, and no taller than `height`, in even pixels. */
export function editedSize(
  width: number,
  height: number,
  edit: Pick<MovieEdit, "turns" | "height">,
): { width: number; height: number } {
  const sideways = (edit.turns ?? 0) % 2 === 1;
  const shown = sideways ? { width: height, height: width } : { width, height };
  const scale = edit.height && edit.height < shown.height ? edit.height / shown.height : 1;
  const even = (value: number) => Math.max(2, 2 * Math.round((value * scale) / 2));
  return { width: even(shown.width), height: even(shown.height) };
}

/** What `box` shows of a picture: all of it in its own shape, snapped to the box when it is that shape. */
function shownIn(picture: { videoWidth: number; videoHeight: number }, box: [number, number]) {
  const [width, height] = box;
  if (!picture.videoWidth || !picture.videoHeight) return null;
  const scale = Math.min(width / picture.videoWidth, height / picture.videoHeight);
  const across = picture.videoWidth * scale;
  const down = picture.videoHeight * scale;
  return {
    width: width - across < 2 ? width : across,
    height: height - down < 2 ? height : down,
  };
}

/**
 * Draws a movie's frame through an edit onto a canvas of `size`: a piece of another shape shows whole
 * on black, and a piece of sound alone is black.
 */
export function moviePainter(
  draw: CanvasRenderingContext2D,
  size: { width: number; height: number },
  edit: Pick<MovieEdit, "turns" | "flipX" | "flipY">,
): (shown: HTMLVideoElement) => void {
  const turns = edit.turns ?? 0;
  const [sourceWidth, sourceHeight] =
    turns % 2 === 1 ? [size.height, size.width] : [size.width, size.height];
  return (shown) => {
    const box = shownIn(shown, [sourceWidth, sourceHeight]);
    if (!box || box.width < sourceWidth || box.height < sourceHeight) {
      draw.setTransform(1, 0, 0, 1, 0, 0);
      draw.fillStyle = "#000";
      draw.fillRect(0, 0, size.width, size.height);
    }
    if (!box) return;
    draw.setTransform(1, 0, 0, 1, size.width / 2, size.height / 2);
    draw.rotate((turns * Math.PI) / 2);
    draw.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1);
    draw.drawImage(shown, -box.width / 2, -box.height / 2, box.width, box.height);
  };
}
