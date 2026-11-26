/** The frame of a window holding sound alone: its controller under its title bar, in points. */
export const SOUND_SIZE = { width: 480, height: 130 } as const;
/** The narrowest a movie's frame goes: the controller and the margin beside it. */
const LEAST_WIDTH = 480;

interface Size {
  width: number;
  height: number;
}

/**
 * The frame of a window showing a movie of `movie`'s size at `scale`, keeping its shape: never
 * narrower than its controller, never larger than `room`. A movie with no picture is sound.
 */
export function movieFrameSize(movie: Size, scale: number, room: Size): Size {
  if (movie.width <= 0 || movie.height <= 0) {
    return {
      width: Math.min(room.width, SOUND_SIZE.width),
      height: Math.min(room.height, SOUND_SIZE.height),
    };
  }
  const wide = Math.max(movie.width * scale, LEAST_WIDTH);
  const fits = Math.min(1, room.width / wide, (room.height * movie.width) / (wide * movie.height));
  return {
    width: Math.min(room.width, Math.round(wide * fits)),
    height: Math.min(room.height, Math.round((wide * fits * movie.height) / movie.width)),
  };
}

/**
 * The scale after a step by `by`, from the size the window has at `now`: whatever bound holds it there,
 * the step shows, until the controller's width or the room stops it.
 */
export function steppedScale(movie: Size, now: number, by: number, room: Size): number {
  const shown = movieFrameSize(movie, now, room).width / movie.width;
  return Math.min(fitScale(movie, room), Math.max(LEAST_WIDTH / movie.width, shown * by));
}

/** One piece of a movie's picture and where it is drawn: `drawImage`'s eight numbers. */
export interface PictureStrip {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * View > Panoramic: the picture as `count` strips that fill `frame` to its edges. It is stretched
 * along the frame's longer side by more and more towards the two ends, and its centre keeps its
 * true shape.
 */
export function panoramicStrips(movie: Size, frame: Size, count = 48): PictureStrip[] {
  const wider = frame.width * movie.height >= frame.height * movie.width;
  const share = wider
    ? (movie.width * frame.height) / (movie.height * frame.width)
    : (movie.height * frame.width) / (movie.width * frame.height);
  const place = (part: number) => {
    const from = 2 * part - 1;
    return (share * from + (1 - share) * from ** 3 + 1) / 2;
  };
  return Array.from({ length: count }, (_, index) => {
    const part = index / count;
    const nextPart = (index + 1) / count;
    const along = wider ? frame.width : frame.height;
    const source = wider ? movie.width : movie.height;
    // Whole pixels, so that no seam shows between two strips.
    const to = Math.round(place(part) * along);
    const toNext = Math.round(place(nextPart) * along);
    const from = part * source;
    const size = source / count;
    return wider
      ? {
          sx: from,
          sy: 0,
          sw: size,
          sh: movie.height,
          dx: to,
          dy: 0,
          dw: toNext - to,
          dh: frame.height,
        }
      : {
          sx: 0,
          sy: from,
          sw: movie.width,
          sh: size,
          dx: 0,
          dy: to,
          dw: frame.width,
          dh: toNext - to,
        };
  });
}

/** The scale at which a movie of `movie`'s size fills `room`, keeping its shape. */
export function fitScale(movie: Size, room: Size): number {
  return Math.min(room.width / movie.width, room.height / movie.height);
}
