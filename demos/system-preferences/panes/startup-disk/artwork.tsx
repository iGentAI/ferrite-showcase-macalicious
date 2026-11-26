/*
 * Stand-ins for the volume icons: original drawings on the 28 x 30.5 pt box of Apple's artwork.
 * An external volume is a gold enclosure on a grey foot, an internal one a grey drive with a
 * platter.
 */
export function DiskArtwork({ kind }: { kind: "external" | "internal" }) {
  return (
    <svg width="28" height="30.5" viewBox="0 0 28 30.5" aria-hidden="true" focusable="false">
      {kind === "external" ? (
        <>
          <path d="M1 25.5h26v2.5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill="#b9b9b9" />
          <path d="M5 .5h18a2 2 0 0 1 2 2l2 23H1l2-23a2 2 0 0 1 2-2z" fill="#f5a800" />
          <path d="M5 .5h18a2 2 0 0 1 2 2l.3 3H2.7l.3-3a2 2 0 0 1 2-2z" fill="#fbc02d" />
          <path d="M1.4 21h25.2l.4 4.5H1z" fill="#d9d9d9" />
          <circle cx="22.5" cy="27.7" r="0.9" fill="#6fcf6f" />
        </>
      ) : (
        <>
          <path d="M1 25.5h26v2.5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill="#55585a" />
          <path d="M5 .5h18a2 2 0 0 1 2 2l2 23H1l2-23a2 2 0 0 1 2-2z" fill="#6d7275" />
          <circle cx="13" cy="12" r="8.5" fill="#585c5f" stroke="#868b8e" />
          <circle cx="13" cy="12" r="2" fill="#9a9fa2" />
          <path d="M22 20.5 15 13.5" stroke="#a8adb0" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="22.5" cy="27.7" r="0.9" fill="#8fd98f" />
        </>
      )}
    </svg>
  );
}
