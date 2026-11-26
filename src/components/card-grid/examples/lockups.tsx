import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";
import { StorePillButton } from "macalicious/store-pill-button";
import type { CSSProperties } from "react";

const apps = [
  ["App One", "A short line about it", "Get", "In-App Purchases", "var(--mac-color-system-blue)"],
  ["App Two", "Launcher and organizer", "$14.99", "", "var(--mac-color-system-orange)"],
  ["App Three", "Calm sounds for a quiet working day", "Get", "", "var(--mac-color-system-teal)"],
  ["App Four", "A long campaign", "$49.99", "In-App Purchases", "var(--mac-color-system-red)"],
];

/**
 * Lockups as in the App Store: rows of 69 pt, so the list has no row gap, and each row has an
 * offer button as its accessory. The header takes the App Store's sizes through the section's
 * variables.
 */
export default function Lockups() {
  return (
    <CardGrid
      title="Apps We Love Right Now"
      action={<CardGridAction href="#apps">See All</CardGridAction>}
      columns={2}
      separator
      style={
        {
          width: 640,
          maxWidth: "100%",
          "--mac-card-grid-row-gap": "0px",
          "--mac-card-grid-header-padding": "11px 0 8px",
          "--mac-card-grid-title-font":
            "var(--mac-font-weight-semibold) 20.5px / 25px var(--mac-font-family-system)",
          "--mac-card-grid-action-font":
            "var(--mac-font-weight-regular) 15.5px / 21px var(--mac-font-family-system)",
          "--mac-card-grid-separator": "var(--mac-color-grid)",
        } as CSSProperties
      }
    >
      {apps.map(([title, subtitle, offer, caption, color]) => (
        <CardGridCard
          key={title}
          variant="lockup"
          title={title}
          subtitle={subtitle}
          artwork={
            <span
              style={{
                borderRadius: 11,
                background: `linear-gradient(${color}, var(--mac-color-system-indigo))`,
              }}
            />
          }
          accessory={
            <StorePillButton aria-label={`${offer}, ${title}`} caption={caption || undefined}>
              {offer}
            </StorePillButton>
          }
        />
      ))}
    </CardGrid>
  );
}
