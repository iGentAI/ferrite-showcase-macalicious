import { Placard, PlacardButton, PlacardLabel } from "macalicious/placard";
import { useState } from "react";

const PAGES = 12;

/** Page buttons and a page count. The arrowheads are drawn for this example. */
export default function Pages() {
  const [page, setPage] = useState(3);
  return (
    <Placard aria-label="Pages">
      <PlacardButton
        aria-label="Previous Page"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        <svg width="5" height="7" viewBox="0 0 5 7" aria-hidden="true">
          <path d="M5 0v7L0 3.5z" fill="currentColor" />
        </svg>
      </PlacardButton>
      <PlacardLabel aria-live="polite">
        Page {page} of {PAGES}
      </PlacardLabel>
      <PlacardButton
        aria-label="Next Page"
        disabled={page === PAGES}
        onClick={() => setPage(page + 1)}
      >
        <svg width="5" height="7" viewBox="0 0 5 7" aria-hidden="true">
          <path d="M0 0v7l5-3.5z" fill="currentColor" />
        </svg>
      </PlacardButton>
    </Placard>
  );
}
