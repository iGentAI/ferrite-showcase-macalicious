import { BookCover } from "macalicious/book-cover";

const BOOKS = [
  { title: "Aqua and Bondi", from: "teal", to: "blue" },
  { title: "The Road to OS X", from: "orange", to: "red" },
  { title: "Field Notes", from: "green", to: "teal" },
  { title: "A Year of Pictures", from: "purple", to: "pink" },
];

/**
 * A library: covers that are links, in a wrapping row. The 30 pt between them is this
 * example's choice; the Books capture shows a single book.
 */
export default function Library() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 30, padding: 12 }}>
      {BOOKS.map((book) => (
        <BookCover key={book.title} render={<a href="#book" />} aria-label={book.title}>
          <span
            style={{
              background: `linear-gradient(160deg, var(--mac-color-system-${book.from}), var(--mac-color-system-${book.to}))`,
            }}
          />
        </BookCover>
      ))}
    </div>
  );
}
