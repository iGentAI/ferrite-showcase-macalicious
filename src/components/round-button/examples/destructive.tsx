import { RoundButton } from "macalicious/round-button";

const bar = { width: 8, height: 2, borderRadius: 0.5, background: "currentColor" } as const;

/**
 * The destructive variant: a row that can be removed, as a field of a Contacts card being
 * edited, and the variant's states. Pressed and keyboard focus are pinned with `data-force`.
 */
export default function Destructive() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <RoundButton variant="destructive" size="mini" aria-label="Remove phone">
        <span aria-hidden="true" style={bar} />
      </RoundButton>
      <RoundButton
        variant="destructive"
        size="mini"
        aria-label="Remove, pressed"
        data-force="pressed"
      >
        <span aria-hidden="true" style={bar} />
      </RoundButton>
      <RoundButton
        variant="destructive"
        size="mini"
        aria-label="Remove, focused"
        data-force="focus"
      >
        <span aria-hidden="true" style={bar} />
      </RoundButton>
      <RoundButton variant="destructive" size="mini" aria-label="Remove, disabled" disabled>
        <span aria-hidden="true" style={bar} />
      </RoundButton>
      <RoundButton variant="destructive" aria-label="Remove, regular size">
        <span aria-hidden="true" style={bar} />
      </RoundButton>
    </div>
  );
}
