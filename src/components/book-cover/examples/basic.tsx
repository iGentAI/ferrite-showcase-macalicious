import { BookCover } from "macalicious/book-cover";

/** A book in a library. The cover is a gradient drawn here: the library ships no artwork. */
export default function Basic() {
  return (
    <BookCover role="img" aria-label="Aqua and Bondi">
      <span
        style={{
          background:
            "linear-gradient(160deg, var(--mac-color-system-teal), var(--mac-color-system-blue))",
        }}
      />
    </BookCover>
  );
}
