import { MailPreferences } from "../mail-preferences";

/**
 * Visual comparison target: the whole frame of Mail's Preferences on the General pane.
 * Reference crop (2x pixels) x=112 y=76 w=1100 h=1082, i.e. 550 x 541 pt, over the capture's
 * transparent margin (matte white).
 */
export default function VisualPreferences() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 550,
        height: 541,
        background: "var(--mac-mail-visual-matte)",
      }}
    >
      <MailPreferences animated={false} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
