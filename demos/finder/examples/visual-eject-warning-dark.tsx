import { FinderEjectWarning } from "../finder-dialogs";

/**
 * Visual comparison target: 10-15-Catalina-Dark-Finder-Eject-Warning.png, as
 * visual-eject-warning. This capture names the disk “USB KEY”, and its first line ends before
 * “or” where the fallback font, a little narrower, ends it after “turning”: the text is as the
 * notification sets it, and the masked comparison leaves it out.
 */
export default function VisualEjectWarningDark() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        overflow: "hidden",
        width: 382,
        height: 101,
        padding: "18px 0 0 19px",
        background: "#ffffff",
      }}
    >
      <FinderEjectWarning material="opaque" disk="USB KEY" />
    </div>
  );
}
