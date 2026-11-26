/*
 * Stand-in picture for the Software Update pane: an original drawing in place of Apple's gear
 * icon. It is decorative: the title under it names the pane.
 */

/** A cog wheel with three spokes on a dark disc with a pale rim, 112 pt across. */
export function GearPicture() {
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true" focusable="false">
      <circle cx="56" cy="56" r="56" fill="#8e9ba6" />
      <circle cx="56" cy="56" r="54" fill="#d3dbe1" />
      <circle cx="56" cy="56" r="50" fill="#3b3d40" />
      <circle cx="56" cy="56" r="48" fill="#4d4f52" />
      {/* Twenty-four teeth: a dashed ring around the wheel's rim. */}
      <circle
        cx="56"
        cy="56"
        r="37"
        fill="none"
        stroke="#b4b6b8"
        strokeWidth="8"
        strokeDasharray="4.843 4.843"
      />
      <circle cx="56" cy="56" r="30.5" fill="none" stroke="#b4b6b8" strokeWidth="7" />
      <path
        d="M56 56h28M56 56l-14 24.25M56 56l-14-24.25"
        fill="none"
        stroke="#b4b6b8"
        strokeWidth="7"
      />
      <circle cx="56" cy="56" r="7" fill="#c9cbcd" />
      <circle cx="56" cy="56" r="2.5" fill="#4d4f52" />
    </svg>
  );
}
