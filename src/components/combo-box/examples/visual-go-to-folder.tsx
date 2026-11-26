import { ComboBox, ComboBoxItem } from "macalicious/combo-box";

/**
 * The combo box of Finder's Go to Folder dialog (Finder-Go-To-Folder, crop 148,202,786,50):
 * 388 pt wide, with the keyboard, on the dialog's background. The box is 393 x 25 pt: the
 * control's edge is 2.5 pt inside it on every side, which is the width of the focus ring.
 */
export default function VisualGoToFolder() {
  return (
    <div
      style={{
        width: 393,
        height: 25,
        padding: 2.5,
        boxSizing: "border-box",
        lineHeight: 0,
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <ComboBox
        aria-label="Go to the folder"
        defaultValue="~/Documents/"
        data-force="focus"
        style={{ width: 388 }}
      >
        <ComboBoxItem>~/Documents/</ComboBoxItem>
        <ComboBoxItem>~/Library/</ComboBoxItem>
      </ComboBox>
    </div>
  );
}
