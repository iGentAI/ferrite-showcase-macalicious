import { useId } from "react";

/**
 * The flat backdrop the chrome is checked over, in place of the demo's movie frame (generated
 * artwork, which is not compared): a gradient from #30353d to #5d6672 over the top 540 of 827
 * units, and one flat neutral grey, #707070, from there down, where the floating controller
 * lies. Over these known colours the title bar's and the controller's materials have colours
 * that can be computed, and the pixel checks in quicktime-player.visual.json hold them.
 */
export function CheckBackdrop() {
  // Gradient ids are shared by a page; two backdrops on it must not use each other's.
  const id = `qt-backdrop-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg viewBox="0 0 1470 827" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="540">
          <stop offset="0" stopColor="#30353d" />
          <stop offset="1" stopColor="#5d6672" />
        </linearGradient>
      </defs>
      <rect width="1470" height="827" fill={`url(#${id})`} />
      <rect y="540" width="1470" height="287" fill="#707070" />
    </svg>
  );
}
