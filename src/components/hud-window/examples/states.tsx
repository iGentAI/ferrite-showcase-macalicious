import { HudWindow, HudWindowButton } from "macalicious/hud-window";

const glyph = (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M0 0l14 7-14 7z" fill="currentColor" />
  </svg>
);

/** A key and an inactive panel, and the states of a glyph button pinned with `data-force`. */
export default function States() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "start" }}>
      <HudWindow title="Key" onClose={() => {}} style={{ width: 150 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <HudWindowButton aria-label="Play">{glyph}</HudWindowButton>
          <HudWindowButton aria-label="Play, pressed" data-force="pressed">
            {glyph}
          </HudWindowButton>
          <HudWindowButton aria-label="Play, focused" data-force="focus">
            {glyph}
          </HudWindowButton>
          <HudWindowButton aria-label="Play, disabled" disabled>
            {glyph}
          </HudWindowButton>
        </div>
      </HudWindow>
      <HudWindow state="inactive" title="Inactive" onClose={() => {}} style={{ width: 150 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <HudWindowButton aria-label="Play">{glyph}</HudWindowButton>
        </div>
      </HudWindow>
    </div>
  );
}
