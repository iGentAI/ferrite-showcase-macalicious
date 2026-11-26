import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the plain 22 pt title bar of Finder's Get Info window, with a
 * proxy icon before a title too long to be centred.
 *
 * Reference crop x=112 y=76 w=530 h=44 (265 x 22 pt): the whole bar. The document icon is
 * artwork and the title is set in the fallback font, so both are masked in the tight
 * comparison; the icon here is a plain stand-in.
 */
export default function VisualPlain() {
  return (
    <div
      style={{
        position: "relative",
        width: 265,
        height: 22,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={265} height={200} style={{ position: "absolute" }}>
        <TitleBar
          title="Aqua and Bondi.pdf Info"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 1.5h6l3 3v10h-9z" fill="white" stroke="gray" />
            </svg>
          }
          controls={<WindowControls />}
        />
      </Window>
    </div>
  );
}
