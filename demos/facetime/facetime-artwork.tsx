import type { ComponentProps } from "react";

/*
 * Every drawing here is original artwork. The reference captures show a person in front of a
 * camera, and FaceTime's glyphs are Apple's: none of them is reproduced, and the picture is
 * not imitated either.
 */

/** What the placeholder picture is, for assistive technology. */
export const CAMERA_PLACEHOLDER_DESCRIPTION =
  "Illustrated placeholder for the camera preview: a painted portrait of a fictional woman at home.";

/* The generated picture for the camera preview: an original painterly illustration of an
   invented person, plainly not a photograph and not anyone real. */
const CAMERA_ART: string | undefined = Object.values(
  import.meta.glob<string>("./art/camera.webp", { eager: true, query: "?url", import: "default" }),
)[0];

/**
 * The camera's picture: the generated illustration, cropped to cover the box, or the abstract
 * placeholder when there is none. Decorative; the element around it names the picture.
 */
export function CameraPicture({ className }: { className?: string }) {
  if (!CAMERA_ART) return <CameraPlaceholder className={className} />;
  return (
    <img
      className={className}
      src={CAMERA_ART}
      alt=""
      draggable={false}
      style={{ objectFit: "cover" }}
    />
  );
}

/**
 * The placeholder for the camera's picture, 390 by 585 units: five flat shapes on a flat
 * field. It stands where the camera preview would be and depicts nothing. No shape, no place
 * and no tone of it comes from the picture in the reference captures; the tones are the
 * demo's own (`--mac-facetime-placeholder-*`).
 *
 * It fills the box it is given and is cropped to it; it is decorative, and the element around
 * it names the picture.
 */
export function CameraPlaceholder(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 390 585"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect className="mac-facetime-placeholder-field" width="390" height="585" />
      <path className="mac-facetime-placeholder-band" d="M0 150L390 30V170L0 290Z" />
      <circle className="mac-facetime-placeholder-disc" cx="118" cy="430" r="92" />
      <rect className="mac-facetime-placeholder-block" x="252" y="300" width="84" height="84" />
      <path className="mac-facetime-placeholder-wedge" d="M230 585L390 430V585Z" />
    </svg>
  );
}

/* The glyphs of the two kinds of call, drawn with currentColor. */

/** A camera seen from the side: a body and the cone of its lens. For FaceTime Video. */
export function VideoGlyph() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true" focusable="false">
      <rect x="0" y="0.5" width="10.5" height="10" rx="2" fill="currentColor" />
      <path d="M11.5 4L16 1.25v8.5L11.5 7z" fill="currentColor" />
    </svg>
  );
}

/** A letter i in a ring. For a recent call's info button. */
export function InfoGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" />
      <circle cx="7" cy="4" r="1" fill="currentColor" />
      <rect x="6.2" y="6" width="1.6" height="4.5" fill="currentColor" />
    </svg>
  );
}

/** A telephone handset, tilted. For FaceTime Audio. */
export function AudioGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path
        d="M3.3 1.1l2 2.3-1.3 1.6c.9 1.9 2.4 3.4 4.3 4.3l1.6-1.3 2.3 2-1.2 1.9c-.4.6-1.1.9-1.8.7C5 11.6 2.1 8.7 1.1 4.5c-.2-.7.1-1.4.7-1.8z"
        fill="currentColor"
      />
    </svg>
  );
}
