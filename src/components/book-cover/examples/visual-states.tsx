import { BookCover } from "macalicious/book-cover";

/**
 * Fixture for what no screenshot shows: a cover that is a button, 145.5 x 190 pt, 10 pt from
 * the top left of a 170 x 215 pt box in the page colour of Books, with a picture of one colour.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 170,
        height: 215,
        padding: 10,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <BookCover id="cover" render={<button type="button" />} aria-label="Open">
        <span style={{ background: "#ff00ff" }} />
      </BookCover>
    </div>
  );
}
