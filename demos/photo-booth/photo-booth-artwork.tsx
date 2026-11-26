import type { ComponentProps } from "react";
import room from "./art/room.webp";
import type { PhotoBoothEffect } from "./photo-booth-data";

/** What the camera's picture shows, for assistive technology. */
export const SCENE_DESCRIPTION = "The camera's picture of an empty, lamp-lit living room";

/**
 * The camera's picture: an original generated photograph of an empty living room. Photo Booth
 * shows the camera, and the reference captures show a person in a room; neither is reproduced
 * or imitated, and no one is in the picture. An effect's filter and transform are applied to the
 * drawing, which fills the box it is given and is cropped to it.
 *
 * It is decorative: the element around it names the picture.
 */
export function Scene({
  effect,
  style,
  ...props
}: ComponentProps<"svg"> & { effect: PhotoBoothEffect }) {
  return (
    <svg
      viewBox="0 0 236 156"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      style={{ filter: effect.filter, transform: effect.transform, ...style }}
      {...props}
    >
      <rect width="236" height="156" fill="var(--mac-photo-booth-placeholder-field)" />
      <rect y="104" width="236" height="52" fill="var(--mac-photo-booth-placeholder-band)" />
      <path d="M28 104 74 36l46 68Z" fill="var(--mac-photo-booth-placeholder-shape)" />
      <rect
        x="132"
        y="58"
        width="46"
        height="46"
        rx="6"
        fill="var(--mac-photo-booth-placeholder-accent)"
      />
      <circle cx="196" cy="34" r="14" fill="var(--mac-photo-booth-placeholder-mark)" />
      <image href={room} width="236" height="156" preserveAspectRatio="xMidYMid slice" />
    </svg>
  );
}
