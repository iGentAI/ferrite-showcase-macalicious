import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";

export default function Basic() {
  return (
    <ContextualMenu>
      <ContextualMenuTrigger
        style={{
          display: "grid",
          placeItems: "center",
          width: 260,
          height: 120,
          border: "1px dashed var(--mac-color-separator)",
          color: "var(--mac-color-label)",
          font: "var(--mac-font-body)",
        }}
      >
        Control-click or right-click here
      </ContextualMenuTrigger>
      <ContextualMenuPopup>
        <MenuItem>New Folder</MenuItem>
        <MenuSeparator />
        <MenuItem>Get Info</MenuItem>
        <MenuItem disabled>Paste Item</MenuItem>
        <MenuSeparator />
        <MenuItem>Clean Up</MenuItem>
        <MenuItem>Show View Options</MenuItem>
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}
