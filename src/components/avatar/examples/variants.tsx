import { Avatar } from "macalicious/avatar";
import type { CSSProperties } from "react";

const caption: CSSProperties = { font: "var(--mac-font-control-small)" };
const cell: CSSProperties = { display: "grid", gap: 6, justifyItems: "center" };

/* A picture drawn here, as a data URL: the library ships no artwork. */
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ac8fa"/><stop offset="1" stop-color="#5856d6"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>',
)}`;

/** What an avatar shows: the silhouette, initials or a picture; and other sizes. */
export default function Variants() {
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "end" }}>
      <div style={cell}>
        <Avatar alt="Me" />
        <span style={caption}>Silhouette</span>
      </div>
      <div style={cell}>
        <Avatar alt="Stephen Hackett">SH</Avatar>
        <span style={caption}>Initials</span>
      </div>
      <div style={cell}>
        <Avatar alt="Aqua Bondi" src={PICTURE}>
          AB
        </Avatar>
        <span style={caption}>Picture</span>
      </div>
      <div style={cell}>
        <Avatar alt="Me" size={20} />
        <span style={caption}>20 pt</span>
      </div>
      <div style={cell}>
        <Avatar alt="Stephen Hackett" size={48}>
          SH
        </Avatar>
        <span style={caption}>48 pt</span>
      </div>
    </div>
  );
}
