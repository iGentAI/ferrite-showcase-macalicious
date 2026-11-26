/*
 * The demo's drawings, all original. The mark before "News" stands in for Apple's logo. The
 * pictures of the stories are placeholders: the captures have news photographs there, which
 * belong to their publishers, and the demo shows the same abstract mark in a flat panel for
 * every one of them. The toolbar's two glyphs are the library's System Images.
 */

/** The mark before "News" in the Business News cell: a folded sheet, where Stocks has Apple's logo. */
export function NewsGlyph() {
  return (
    <svg
      className="mac-stocks-news-glyph"
      width="9"
      height="10.5"
      viewBox="0 0 9 10.5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M1.5 0h4L9 3.5v5.5A1.5 1.5 0 0 1 7.5 10.5h-6A1.5 1.5 0 0 1 0 9V1.500A1.500 1.500 0 0 1 1.500 0zM2 5v1h5V5zm0 2.200v1h3.500v-1z"
      />
    </svg>
  );
}

/**
 * The placeholder of a story's picture: a frame with a disc and a slope, the usual sign for
 * "a picture goes here", centred in the picture's box at one size whatever the box's. It is
 * drawn in the colour of its place and is decorative: the headline says what the story is.
 */
export function StoryArtwork() {
  return (
    <svg
      className="mac-stocks-story-picture"
      width="40"
      height="32"
      viewBox="0 0 40 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4 0h32a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4zm0 3a1 1 0 0 0-1 1v24a1 1 0 0 0 1 1h32a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm7.500 4a3.500 3.500 0 1 1 0 7 3.500 3.500 0 0 1 0-7zM6 26l8-9 5 5 6.500-8L34 26z"
      />
    </svg>
  );
}
