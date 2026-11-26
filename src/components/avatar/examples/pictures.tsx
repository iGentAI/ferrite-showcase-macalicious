import { Avatar } from "macalicious/avatar";
import { PushButton } from "macalicious/push-button";
import { type CSSProperties, useState } from "react";

const caption: CSSProperties = { font: "var(--mac-font-control-small)" };
const cell: CSSProperties = { display: "grid", gap: 6, justifyItems: "center" };

/* Pictures drawn here, as data URLs: the library ships no artwork. */
const picture = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>`,
  )}`;
const FIRST = picture("#5ac8fa", "#5856d6");
const SECOND = picture("#34c759", "#ffcc00");
/** Not an image: the browser reports an error and the avatar keeps its initials. */
const BROKEN = "data:image/png;base64,AAAA";

/**
 * A picture that loads, one that cannot be loaded, and one whose address changes: the initials
 * stand in until a picture has loaded, and stay when it fails. Each cell carries its avatar's
 * loading status in `data-avatar-status`. `next` is the address Next Picture changes to;
 * `removable` adds No Picture, which takes the third avatar's address away.
 */
export default function Pictures({
  next = SECOND,
  removable = false,
}: {
  next?: string;
  removable?: boolean;
}) {
  const [src, setSrc] = useState<string | undefined>(FIRST);
  const [status, setStatus] = useState<Record<string, string>>({});
  const track = (id: string) => (value: string) =>
    setStatus((current) => ({ ...current, [id]: value }));
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "end" }}>
      <div style={cell} data-avatar-status={status.loads}>
        <Avatar
          id="loads"
          alt="Aqua Bondi"
          size={40}
          src={FIRST}
          onLoadingStatusChange={track("loads")}
        >
          AB
        </Avatar>
        <span style={caption}>Loads</span>
      </div>
      <div style={cell} data-avatar-status={status.fails}>
        <Avatar
          id="fails"
          alt="Xavier Young"
          size={40}
          src={BROKEN}
          onLoadingStatusChange={track("fails")}
        >
          XY
        </Avatar>
        <span style={caption}>Fails</span>
      </div>
      <div style={cell} data-avatar-status={status.changes}>
        <Avatar
          id="changes"
          alt="Casey Dune"
          size={40}
          src={src}
          onLoadingStatusChange={track("changes")}
        >
          CD
        </Avatar>
        <span style={caption}>Changes</span>
      </div>
      <PushButton id="next" onClick={() => setSrc(next)}>
        Next Picture
      </PushButton>
      {removable ? (
        <PushButton id="remove" onClick={() => setSrc(undefined)}>
          No Picture
        </PushButton>
      ) : null}
    </div>
  );
}
