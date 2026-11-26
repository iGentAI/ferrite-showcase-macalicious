import type { ContactAction } from "./contacts-data";

/*
 * Original stand-in drawings for the meanings the library's System Image does not have: the
 * four services of a card, a web address and a search. Apple's glyphs are not reproduced: each
 * is a simple shape drawn for this demo in `currentColor`. The plus, the share arrow and the
 * silhouette are the library's (`SystemImage`: `add`, `share`, `user`).
 */

/**
 * The glyph of an action, on a 13 pt grid: a speech bubble, a handset, a camera, an envelope,
 * a compass for a web address and a lens for a search.
 */
export function ActionGlyph({ action }: { action: ContactAction }) {
  return (
    <svg viewBox="0 0 13 13" width="13" height="13" aria-hidden="true" focusable="false">
      {action === "message" ? (
        <path
          fill="currentColor"
          d="M6.5 2C3.6 2 1.25 3.85 1.25 6.15c0 1.3.75 2.45 1.95 3.2-.1.7-.45 1.3-.95 1.75 1.1-.05 2-.45 2.65-1.05.5.15 1.05.2 1.6.2 2.9 0 5.25-1.85 5.25-4.1S9.4 2 6.5 2Z"
        />
      ) : action === "call" ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          d="M3.4 3.1c.2 3.6 2.9 6.3 6.5 6.5"
        />
      ) : action === "video" ? (
        <g fill="currentColor">
          <rect x="1" y="3.25" width="7.5" height="6.5" rx="1.5" />
          <path d="M9.25 5.6 12 3.9v5.2L9.25 7.4Z" />
        </g>
      ) : action === "mail" ? (
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M1 3h11v7H1Zm1.5 1 4 3.4 4-3.4Zm-.6.75v4.3l2.55-2.15Zm9.2 0L8.55 6.9l2.55 2.15ZM4.2 7.5 2.4 9h8.2L8.8 7.5 6.5 9.4Z"
        />
      ) : action === "open" ? (
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="6.5" cy="6.5" r="5" />
          <path d="M8.9 4.1 7.3 7.3 4.1 8.9l1.6-3.2Z" fill="currentColor" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="1.25">
          <circle cx="5.5" cy="5.5" r="3.75" />
          <path d="m8.3 8.3 3.2 3.2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
