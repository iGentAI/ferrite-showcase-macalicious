import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";

export default function Basic() {
  return (
    <PullDownButton title="PDF">
      <MenuItem>Open in Preview</MenuItem>
      <MenuItem>Save as PDF</MenuItem>
      <MenuItem>Save as PostScript</MenuItem>
      <MenuSeparator />
      <MenuItem>Save to iCloud Drive</MenuItem>
      <MenuItem>Send in Mail</MenuItem>
    </PullDownButton>
  );
}
