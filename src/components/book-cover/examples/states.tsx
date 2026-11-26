import { BookCover } from "macalicious/book-cover";
import type { CSSProperties } from "react";

const art = (
  <span
    style={{
      background:
        "linear-gradient(160deg, var(--mac-color-system-purple), var(--mac-color-system-pink))",
    }}
  />
);

const small = { "--mac-book-cover-width": "96px" } as CSSProperties;

/**
 * The states of a cover that is a button, at a smaller width. Pressed and focused are
 * transient, so this gallery pins them with the `data-force` preview attribute; in an
 * application they come from :active and :focus-visible.
 */
export default function States() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: 12 }}>
      <BookCover render={<button type="button" />} aria-label="Normal" style={small}>
        {art}
      </BookCover>
      <BookCover
        render={<button type="button" />}
        data-force="pressed"
        aria-label="Pressed"
        style={small}
      >
        {art}
      </BookCover>
      <BookCover
        render={<button type="button" />}
        data-force="focus"
        aria-label="Keyboard focus"
        style={small}
      >
        {art}
      </BookCover>
      <BookCover render={<button type="button" disabled />} aria-label="Disabled" style={small}>
        {art}
      </BookCover>
      <div data-window-state="inactive">
        <BookCover
          render={<button type="button" />}
          data-force="focus"
          aria-label="Focus, window not key"
          style={small}
        >
          {art}
        </BookCover>
      </div>
      <BookCover role="img" aria-label="No picture" style={small} />
    </div>
  );
}
