import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";
import { StorePillButton } from "macalicious/store-pill-button";
import type { CSSProperties } from "react";

const apps = [
  ["App One", "A short line about it", "Get", "In-App Purchases"],
  ["App Two", "Launcher and organizer", "$14.99", ""],
  ["App Three", "Notes at the side", "$19.99", ""],
  ["App Four", "Calm sounds for a quiet working day", "Get", ""],
  ["App Five", "A long campaign", "$49.99", "In-App Purchases"],
  ["App Six", "Build and explore", "$59.99", "In-App Purchases"],
  ["App Seven", "The writing app", "Get", ""],
  ["App Eight", "Productivity", "$89.99", ""],
  ["App Nine", "Another edition", "$44.99", ""],
];

/**
 * Visual comparison target: the App Store's lockup list, from 9 pt above the section's line
 * to the end of its second row, across the content column.
 *
 * Reference crop (2x pixels) x=634 y=1310 w=1890 h=400, i.e. 945 x 200 pt: the line at y 9,
 * the header, then three columns of 301 pt with 20 pt between them (943 pt: the list ends
 * 2 pt before the column does, hence the padding) and rows of 69 pt. The
 * App Store's header is not TV's, so its values are set here through the documented
 * variables: 20.5 pt Semibold title, 15.5 pt action, the store's line and dark link colours.
 * Icons and text are stand-ins and are masked in the comparisons.
 */
export default function VisualLockups() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        overflow: "hidden",
        width: 945,
        height: 200,
        paddingTop: 9,
        background: "light-dark(#ffffff, #1e1f22)",
      }}
    >
      <CardGrid
        title="Apps and Games We Love Right Now"
        action={<CardGridAction href="#apps-and-games">See All</CardGridAction>}
        columns={3}
        separator
        style={
          {
            paddingRight: 2,
            "--mac-card-grid-margin": "0px",
            "--mac-card-grid-row-gap": "0px",
            "--mac-card-grid-header-padding": "11px 3.5px 8px 2px",
            "--mac-card-grid-title-font":
              "var(--mac-font-weight-semibold) 20.5px / 25px var(--mac-font-family-system)",
            "--mac-card-grid-action-font":
              "var(--mac-font-weight-regular) 15.5px / 21px var(--mac-font-family-system)",
            "--mac-card-grid-title": "var(--mac-color-label)",
            "--mac-card-grid-action": "light-dark(#027aff, #0884ff)",
            "--mac-card-grid-separator": "var(--mac-color-grid)",
          } as CSSProperties
        }
      >
        {apps.map(([title, subtitle, offer, caption]) => (
          <CardGridCard
            key={title}
            variant="lockup"
            title={title}
            subtitle={subtitle}
            artwork={
              <span style={{ borderRadius: 11, background: "var(--mac-color-system-gray)" }} />
            }
            accessory={
              <StorePillButton aria-label={`${offer}, ${title}`} caption={caption || undefined}>
                {offer}
              </StorePillButton>
            }
          />
        ))}
      </CardGrid>
    </div>
  );
}
