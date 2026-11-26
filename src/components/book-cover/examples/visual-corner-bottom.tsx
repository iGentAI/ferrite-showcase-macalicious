import { BookCover } from "macalicious/book-cover";

/**
 * Visual comparison target: the cover's bottom-right corner with the shadow around it, 20 x 20
 * pt with the corner at the middle. Reference crop x=927 y=604 w=40 h=40. The picture is the
 * white of the capture's cover there, on the page colour of Books.
 */
export default function VisualCornerBottom() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 20,
        height: 20,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <BookCover
        role="img"
        aria-label="Bottom corner"
        style={{ position: "absolute", left: 10 - 145.5, top: 10 - 190 }}
      >
        <span style={{ background: "#feffff" }} />
      </BookCover>
    </div>
  );
}
