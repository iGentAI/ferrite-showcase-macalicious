import { ImageButton } from "macalicious/image-button";

/* A stand-in icon drawn for this example; the library ships no artwork. */
export default function Basic() {
  return (
    <ImageButton label="General">
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
        <rect x="1" y="1" width="30" height="30" rx="5" fill="#6aa6d8" />
        <path d="M8 11h16M8 16h16M8 21h10" stroke="#ffffff" strokeWidth="2" />
      </svg>
    </ImageButton>
  );
}
