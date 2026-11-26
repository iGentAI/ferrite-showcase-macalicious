import { RoundButton } from "macalicious/round-button";

/**
 * Visual comparison target: the remove button of a field on a Contacts card that is being
 * edited, the destructive variant at the mini size.
 *
 * Reference crop (2x pixels) x=920 y=317 w=50 h=50, that is 25 x 25 pt of the card (#ffffff)
 * around the first disc: 14 pt across (x 930..957, y 328..355), 5 pt from the crop's left and
 * 5.5 pt from its top, so the button's 15 pt box starts 4.5 pt in and 5 pt down. The white bar is 8 x 2 pt.
 */
export default function VisualContactsRemove() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 25,
        height: 25,
        padding: "5px 0 0 4.5px",
        lineHeight: 0,
        background: "light-dark(#ffffff, #1e1f20)",
      }}
    >
      <RoundButton variant="destructive" size="mini" aria-label="Remove phone">
        <span
          aria-hidden="true"
          style={{ width: 8, height: 2, borderRadius: 0.5, background: "currentColor" }}
        />
      </RoundButton>
    </div>
  );
}
