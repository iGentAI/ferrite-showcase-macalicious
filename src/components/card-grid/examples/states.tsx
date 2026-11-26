import { CardGrid, CardGridCard } from "macalicious/card-grid";
import type { CSSProperties } from "react";

const art = (
  <span
    style={{
      background: "linear-gradient(160deg, var(--mac-color-system-teal), var(--mac-color-label))",
    }}
  />
);

/**
 * The states of a card that is a button. Pressed and focused are transient, so this gallery
 * pins them with the `data-force` preview attribute; in an application they come from :active
 * and :focus-visible.
 */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 8, width: 560, maxWidth: "100%" }}>
      <CardGrid
        aria-label="States in the key window"
        columns={4}
        style={{ paddingBottom: 12, "--mac-card-grid-margin": "4px" } as CSSProperties}
      >
        <CardGridCard render={<button type="button" />} title="Normal" artwork={art} />
        <CardGridCard
          render={<button type="button" />}
          data-force="pressed"
          title="Pressed"
          artwork={art}
        />
        <CardGridCard
          render={<button type="button" />}
          data-force="focus"
          title="Keyboard focus"
          artwork={art}
        />
        <CardGridCard render={<button type="button" disabled />} title="Disabled" artwork={art} />
      </CardGrid>
      <div data-window-state="inactive">
        <CardGrid
          aria-label="States in a window that is not key"
          columns={4}
          style={{ paddingBottom: 0, "--mac-card-grid-margin": "4px" } as CSSProperties}
        >
          <CardGridCard
            render={<button type="button" />}
            data-force="focus"
            title="Focus, window not key"
            artwork={art}
          />
        </CardGrid>
      </div>
    </div>
  );
}
