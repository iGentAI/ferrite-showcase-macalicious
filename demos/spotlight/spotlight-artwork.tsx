import type { SpotlightCategory } from "./spotlight-data";

export interface SpotlightArtworkProps {
  /** The kind of result the placeholder stands for: it decides the shape and the tint. */
  category: SpotlightCategory;
  /**
   * `row` fills the 16 pt box of a result, `top-hit` the 28.5 pt box at the end of the field,
   * and `preview` is the 96 pt picture of a summary.
   * @default "row"
   */
  size?: "row" | "top-hit" | "preview";
}

/**
 * The placeholder for an icon. Spotlight shows Apple's icons (a document, a folder, the
 * Dictionary and Safari applications), which are not reproduced: each kind of result has a
 * plain shape in one flat tint instead (a disc, a square, an upright or a lying rectangle).
 * It is not a drawing of any icon. Decorative: it has no name.
 */
export function SpotlightArtwork({ category, size = "row" }: SpotlightArtworkProps) {
  return (
    <span
      className="mac-spotlight-app-artwork"
      data-category={category}
      data-size={size}
      aria-hidden="true"
    />
  );
}
