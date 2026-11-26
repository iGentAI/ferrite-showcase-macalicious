import { ImageWell } from "macalicious/image-well";

// Original artwork for the example: a drawn landscape, not a photograph.
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="119" height="74" viewBox="0 0 119 74"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#27356b"/><stop offset="1" stop-color="#d98a6a"/></linearGradient></defs><path fill="url(#s)" d="M0 0h119v74H0z"/><circle cx="86" cy="30" r="9" fill="#ffe2a8"/><path fill="#1c2340" d="m0 52 28-18 22 16 20-12 49 22v14H0z"/><path fill="#101528" d="m0 62 40-12 38 14 41-10v20H0z"/></svg>',
)}`;

export default function Basic() {
  return (
    <ImageWell
      aria-label="Desktop picture"
      defaultSrc={PICTURE}
      style={{ width: 138, height: 88 }}
      onImageChange={(file) => console.info(file ? `New picture: ${file.name}` : "Cleared")}
    />
  );
}
