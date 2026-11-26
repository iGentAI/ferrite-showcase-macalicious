import { ImageView } from "macalicious/image-view";

// Stand-in artwork drawn for this example; the library ships no images.
const ARTWORK = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7fc4f8"/><stop offset="1" stop-color="#2f6fd6"/>
    </linearGradient></defs>
    <rect width="120" height="120" rx="26" fill="url(#g)"/>
    <circle cx="60" cy="60" r="30" fill="none" stroke="#fff" stroke-width="8"/>
    <path d="M60 38v24l16 10" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
  </svg>`,
)}`;

/** A pane's hero image with its caption, centred in a column. */
export default function Basic() {
  return (
    <figure style={{ display: "grid", gap: 10, justifyItems: "center", margin: 0, width: 160 }}>
      <ImageView src={ARTWORK} alt="" width={117} height={117} />
      <figcaption style={{ font: "var(--mac-font-body-emphasized)" }}>Time Machine</figcaption>
    </figure>
  );
}
