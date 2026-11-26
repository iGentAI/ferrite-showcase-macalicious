/**
 * What the Photo Booth demo shows: four pages of nine effects, and the pictures taken.
 * An effect is a CSS filter, a CSS transform or both, applied to the placeholder picture. A camera's
 * frame is computed on instead for the first two pages (`photo-booth-effects.ts`) and for the
 * backdrops of the fourth (`photo-booth-backdrop.ts`). The third page opens with three effects that
 * follow a face (`photo-booth-tracked.ts`), which have neither; the rest of it is invented, and takes
 * these. Photo Booth's page there holds only effects that follow a face.
 */

/** One effect of the Effects browser. */
export interface PhotoBoothEffect {
  /** Identifies the effect; `"normal"` is the picture as it is. */
  id: string;
  /** The name shown over the effect's preview. */
  name: string;
  /** A CSS `filter` value that changes the picture's colours. */
  filter?: string;
  /** A CSS `transform` value that distorts the picture. */
  transform?: string;
}

/** A picture taken with the shutter. */
export interface PhotoBoothPicture {
  /** The picture's number, from 1, in the order the pictures were taken. */
  number: number;
  /** The id of the effect it was taken with. */
  effect: string;
  /** Identifies a picture its owner keeps, such as one stored on a server. */
  id?: string;
  /** Changes when the picture's image does, so that one shown large is read again. */
  rev?: number;
  /**
   * The address of the picture's image, such as an object URL of a camera frame. Without one the
   * placeholder picture stands in for it.
   */
  src?: string;
  /** Whether `src` already shows the effect, so the strip draws it as it is. */
  baked?: boolean;
  /** Whether it is a movie clip, which plays where a picture is shown large. */
  clip?: boolean;
}

/** The picture as it is: the middle cell of every page. */
export const NORMAL: PhotoBoothEffect = { id: "normal", name: "Normal" };

/**
 * The pages of the Effects browser, nine effects each, row by row. The second page has the
 * names of the reference capture; the first distorts the picture and the third follows a face, its
 * names from memory of the real app.
 */
export const EFFECT_PAGES: readonly (readonly PhotoBoothEffect[])[] = [
  [
    { id: "bulge", name: "Bulge", transform: "scale(1.45)" },
    { id: "dent", name: "Dent", transform: "scale(1.02, 1.5)" },
    { id: "twirl", name: "Twirl", transform: "rotate(24deg) scale(1.6)" },
    { id: "squeeze", name: "Squeeze", transform: "scale(1.5, 1.02)" },
    NORMAL,
    { id: "mirror", name: "Mirror", transform: "scaleX(-1)" },
    { id: "light-tunnel", name: "Light Tunnel", filter: "brightness(1.5) contrast(1.4)" },
    { id: "fish-eye", name: "Fish Eye", transform: "scale(1.9)" },
    { id: "stretch", name: "Stretch", transform: "skewX(-18deg) scale(1.5)" },
  ],
  [
    { id: "sepia", name: "Sepia", filter: "sepia(1)" },
    { id: "black-and-white", name: "Black and White", filter: "grayscale(1)" },
    { id: "plastic-camera", name: "Plastic Camera", filter: "saturate(1.8) hue-rotate(-20deg)" },
    { id: "comic-book", name: "Comic Book", filter: "contrast(2.2) saturate(1.6)" },
    NORMAL,
    { id: "color-pencil", name: "Color Pencil", filter: "brightness(1.5) saturate(0.5)" },
    { id: "glow", name: "Glow", filter: "blur(2px) brightness(1.25)" },
    { id: "thermal-camera", name: "Thermal Camera", filter: "hue-rotate(200deg) saturate(3)" },
    { id: "x-ray", name: "X-Ray", filter: "invert(1) grayscale(1)" },
  ],
  [
    { id: "dizzy", name: "Dizzy" },
    { id: "love-birds", name: "Love Birds" },
    { id: "balloons", name: "Balloons" },
    { id: "hearts", name: "Hearts" },
    NORMAL,
    { id: "lovestruck", name: "Lovestruck" },
    { id: "nose-twirl", name: "Nose Twirl" },
    { id: "chipmunk", name: "Chipmunk" },
    { id: "frog", name: "Frog" },
  ],
  [
    { id: "backdrop-sunset", name: "Sunset", filter: "sepia(1) saturate(3)" },
    { id: "backdrop-ocean", name: "Ocean", filter: "hue-rotate(180deg) saturate(2)" },
    { id: "backdrop-aurora", name: "Aurora", filter: "hue-rotate(120deg) brightness(0.6)" },
    { id: "backdrop-stage", name: "Stage", filter: "hue-rotate(-40deg) brightness(0.5)" },
    NORMAL,
    { id: "backdrop-user-1", name: "User Backdrop" },
    { id: "backdrop-user-2", name: "User Backdrop" },
    { id: "backdrop-user-3", name: "User Backdrop" },
    { id: "backdrop-user-4", name: "User Backdrop" },
  ],
];

/** The effect with an id, or the picture as it is for an id no page has. */
export function findEffect(id: string): PhotoBoothEffect {
  for (const page of EFFECT_PAGES) {
    const found = page.find((effect) => effect.id === id);
    if (found) return found;
  }
  return NORMAL;
}

/** A page index the browser has: a whole number from 0 to the last page. */
export function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 0;
  return Math.min(Math.max(Math.trunc(page), 0), EFFECT_PAGES.length - 1);
}

/** The pictures with one more, taken with an effect. */
export function takePicture(
  pictures: readonly PhotoBoothPicture[],
  effect: string,
): PhotoBoothPicture[] {
  const last = pictures.reduce((most, picture) => Math.max(most, picture.number), 0);
  return [...pictures, { number: last + 1, effect: findEffect(effect).id }];
}
