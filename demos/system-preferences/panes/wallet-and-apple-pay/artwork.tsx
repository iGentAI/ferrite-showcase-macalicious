import { PlaceholderPicture } from "../placeholder";

/*
 * The pane's pictures: a placeholder in place of Apple's photograph of a MacBook Pro at a
 * checkout, and original drawings in place of the Apple Pay mark and the privacy emblem. All
 * three are decorative: the text beside them says what they show.
 */

/** The picture of the pane, 320 x 260 pt: a placeholder where the capture has a photograph. */
export function LaptopArtwork() {
  return <PlaceholderPicture width={320} height={260} />;
}

/**
 * In place of the Apple Pay mark, 88 x 37 pt: a payment card and the word "Pay", in the label
 * colour as the mark is black in Aqua and light grey in Dark Aqua.
 */
export function PayMark() {
  return (
    <svg
      width="88"
      height="37"
      viewBox="0 0 88 37"
      aria-hidden="true"
      focusable="false"
      style={{ color: "var(--mac-color-label)", fontFamily: "var(--mac-font-family-system)" }}
    >
      <path
        d="M4 5h23a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4zM0 11v4h31v-4zM4 20v3h9v-3z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <text x="36" y="28" fontSize="30" fontWeight="500" fill="currentColor">
        Pay
      </text>
    </svg>
  );
}

/** One figure of the emblem: a head and a body with an arm held out to the other figure. */
function Figure() {
  return (
    <path d="M5.4 0a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8zM1.2 20c-.2-5 .3-9 1.6-11.2 1.2-1.6 4-1.6 5.2 0 1 1.4 1.4 4.2 3.2 5.6l1.3 1v2.4l-3-.9V20z" />
  );
}

/**
 * The privacy emblem, 25 x 20 pt: two figures shaking hands, the first in the secondary and the
 * second in the tertiary label colour.
 */
export function PrivacyEmblem() {
  return (
    <svg width="25" height="20" viewBox="0 0 25 20" aria-hidden="true" focusable="false">
      <g style={{ fill: "var(--mac-color-label-secondary)" }}>
        <Figure />
      </g>
      <g
        style={{ fill: "var(--mac-color-label-tertiary)" }}
        transform="translate(25 0) scale(-1 1)"
      >
        <Figure />
      </g>
    </svg>
  );
}
