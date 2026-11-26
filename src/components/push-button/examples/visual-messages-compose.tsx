import { PushButton } from "macalicious/push-button";

/* A stand-in for Messages' compose glyph, 18 x 18 pt: a sheet and a pen. */
function Compose() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M8.5 4.5h-5v10h10v-5" strokeWidth="1.2" />
      <path d="M7.5 10.5l1-3 6-6 2 2-6 6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Visual comparison target: the compose button beside the search field of Messages, a compact
 * push button around one image.
 *
 * Reference crop (2x pixels) w=84 h=60, that is 42 x 30 pt of the conversation list's material:
 * x=1186 y=143 in the Aqua capture, x=1198 y=135 in the Dark Aqua one. The bezel is 33 pt wide
 * and 21 pt high, one point higher than a regular push button's (Messages sets the height), 4.5
 * pt from the crop's left and 5 pt from its top, so the button's box (34 x 22 pt) starts 4 pt
 * in and 4.5 pt down. The
 * list is vibrant in the captures; the fills here are the colours measured beside the button
 * (#d8d1c5 in Aqua, #2e3033 in Dark Aqua). The glyph is Messages' own artwork: the comparisons
 * mask it.
 */
export default function VisualMessagesCompose() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        boxSizing: "border-box",
        width: 42,
        height: 30,
        padding: "4.5px 0 0 4px",
        background: "light-dark(#d8d1c5, #2e3033)",
      }}
    >
      <PushButton compact aria-label="Compose" style={{ height: 22 }}>
        <Compose />
      </PushButton>
    </div>
  );
}
