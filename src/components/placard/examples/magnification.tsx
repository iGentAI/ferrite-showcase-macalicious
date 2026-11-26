import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuRadioGroup, MenuRadioItem } from "macalicious/menu-item";
import { Placard, PlacardButton } from "macalicious/placard";
import { ScrollView } from "macalicious/scroll-view";
import { useState } from "react";

const lines = Array.from({ length: 30 }, (_, index) => `Line ${index + 1}`);

/**
 * A magnification pop-up at the bottom left of a scrolling document. The placard shares the
 * bottom row with a strip in the scroll bar's track colour; the document scrolls above it.
 */
export default function Magnification() {
  const [zoom, setZoom] = useState("100");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 280,
        height: 180,
        border: "1px solid var(--mac-color-list-border)",
      }}
    >
      <ScrollView
        role="region"
        aria-label="Document"
        scrollerStyle="legacy"
        style={{
          flex: 1,
          minHeight: 0,
          background: "var(--mac-color-control-background)",
          color: "var(--mac-color-text)",
          font: "var(--mac-font-body)",
          fontSize: `${(13 * Number(zoom)) / 100}px`,
        }}
      >
        {lines.map((line) => (
          <div key={line} style={{ padding: "2px 8px" }}>
            {line}
          </div>
        ))}
      </ScrollView>
      <div style={{ display: "flex", background: "var(--mac-placard-fill)" }}>
        <Placard aria-label="View">
          <Menu>
            <MenuTrigger render={<PlacardButton popUp>{zoom}%</PlacardButton>} />
            <MenuPopup sideOffset={2}>
              <MenuRadioGroup value={zoom} onValueChange={setZoom}>
                <MenuRadioItem value="75">75%</MenuRadioItem>
                <MenuRadioItem value="100">100%</MenuRadioItem>
                <MenuRadioItem value="150">150%</MenuRadioItem>
                <MenuRadioItem value="200">200%</MenuRadioItem>
              </MenuRadioGroup>
            </MenuPopup>
          </Menu>
        </Placard>
      </div>
    </div>
  );
}
