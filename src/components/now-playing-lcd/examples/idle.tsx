import { NowPlayingLcd } from "macalicious/now-playing-lcd";

/** An original mark for the idle display: a record. Catalina shows the Apple logo here. */
function Record() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm0 8a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"
      />
    </svg>
  );
}

/** Nothing loaded: the placeholder in the well and, as children, a mark of your own. */
export default function Idle() {
  return (
    <div style={{ display: "grid", gap: 12, width: 400 }}>
      <NowPlayingLcd>
        <Record />
      </NowPlayingLcd>
      <NowPlayingLcd variant="podcasts">
        <Record />
      </NowPlayingLcd>
    </div>
  );
}
