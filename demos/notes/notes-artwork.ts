/*
 * Placeholder pictures for this demo. The reference captures show a screenshot embedded in the
 * first note and a photograph in the third; neither is included and neither is imitated. Each
 * placeholder is the box of the picture it stands for, filled with one neutral grey and crossed
 * by its two diagonals, as SVG in a data: URI. The visual comparisons mask these boxes.
 */

const placeholder = (width: number, height: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="${width}" height="${height}" fill="#c7c7cc"/>` +
      `<path d="M0 0L${width} ${height}M${width} 0L0 ${height}" stroke="#aeaeb2" stroke-width="1"/>` +
      "</svg>",
  )}`;

/** 462 x 307 pt: the box of the screenshot that the first note of the reference capture embeds. */
export const SCREENSHOT = placeholder(462, 307);

/** 41 x 40 pt: the note list's thumbnail of the embedded screenshot. */
export const SCREENSHOT_THUMBNAIL = placeholder(41, 40);

/** 41 x 40 pt: the note list's thumbnail of a photograph. */
export const PHOTO_THUMBNAIL = placeholder(41, 40);

/** 320 x 180 pt: the box of a photograph inside a note. */
export const PHOTO = placeholder(320, 180);
