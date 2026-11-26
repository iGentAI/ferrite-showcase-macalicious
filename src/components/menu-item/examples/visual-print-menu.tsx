import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { useState } from "react";

/**
 * The Presets pop-up menu of the Print sheet (Print screenshots): a detached menu in the
 * 13 pt font of a regular pop-up button, 244 x 122 pt, with the current preset checked. The
 * box is the menu's own rectangle over the sheet's fill; the comparison hovers "Black and
 * White".
 */
export default function VisualPrintMenu() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={{
        position: "relative",
        width: 244,
        height: 122,
        overflow: "hidden",
        background: "light-dark(#ececec, #2a2b2d)",
      }}
    >
      <Menu defaultOpen modal={false}>
        <MenuTrigger
          aria-label="Presets"
          style={{
            position: "absolute",
            left: 0,
            top: -10,
            width: 244,
            height: 10,
            padding: 0,
            border: 0,
            background: "none",
          }}
        />
        <MenuPopup size="regular" container={stage} collisionPadding={0} style={{ width: 244 }}>
          <MenuRadioGroup defaultValue="default">
            <MenuRadioItem value="default">Default Settings</MenuRadioItem>
            <MenuRadioItem value="last">Last Used Settings</MenuRadioItem>
            <MenuSeparator />
            <MenuRadioItem value="mono" data-testid="mono">
              Black and White
            </MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem>Save Current Settings as Preset…</MenuItem>
          <MenuItem>Show Presets…</MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
