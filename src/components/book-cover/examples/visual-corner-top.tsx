import { BookCover } from "macalicious/book-cover";

/**
 * Visual comparison target: the cover's top-right corner with the shadow around it, 20 x 17 pt
 * with the corner 10 pt in and 10 pt down. Reference crop x=927 y=224 w=40 h=34, which ends
 * above the lettering of the capture's cover. The picture is the white of that cover, on the
 * page colour of Books.
 */
export default function VisualCornerTop() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 20,
        height: 17,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <BookCover
        role="img"
        aria-label="Top corner"
        style={{ position: "absolute", left: 10 - 145.5, top: 10 }}
      >
        <span style={{ background: "#feffff" }} />
      </BookCover>
    </div>
  );
}
