import {
  MediaAppChrome,
  MediaAppChromeBar,
  MediaAppChromeButton,
  MediaAppChromeControls,
  MediaAppChromeTransport,
  MediaAppChromeVolume,
} from "macalicious/media-app-chrome";

function Bar({ label, force }: { label: string; force?: string }) {
  return (
    <MediaAppChrome sidebarWidth={0} style={{ width: 420, height: 55 }}>
      <MediaAppChromeBar
        aria-label={label}
        style={{ gridTemplateColumns: "130px 0 minmax(0, 1fr)", borderInlineStartWidth: 0 }}
      >
        <MediaAppChromeTransport>
          <MediaAppChromeButton glyph="previous" aria-label="Previous" disabled />
          <MediaAppChromeButton glyph="pause" aria-label="Pause" data-force={force} />
          <MediaAppChromeButton glyph="next" aria-label="Next" />
        </MediaAppChromeTransport>
        <MediaAppChromeControls style={{ paddingInlineStart: 20 }}>
          <MediaAppChromeVolume defaultValue={60}>
            <MediaAppChromeButton glyph="output" aria-label="Audio output" />
          </MediaAppChromeVolume>
          <MediaAppChromeButton glyph="lyrics" aria-label="Lyrics" aria-pressed="true" />
          <MediaAppChromeButton glyph="up-next" aria-label="Up Next" aria-pressed="false" />
        </MediaAppChromeControls>
      </MediaAppChromeBar>
    </MediaAppChrome>
  );
}

/**
 * The bar's states: a disabled button, a toggle that is on (Lyrics), then the play button
 * pressed and with keyboard focus, and the bar in an inactive window.
 */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Bar label="Key window" />
      <Bar label="Pressed" force="pressed" />
      <Bar label="Keyboard focus" force="focus" />
      <div data-window-state="inactive">
        <Bar label="Inactive window" />
      </div>
    </div>
  );
}
