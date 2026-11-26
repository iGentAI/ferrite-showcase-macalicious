import { EditorialCard } from "macalicious/editorial-card";
import type { CSSProperties } from "react";

const art = (
  <span
    style={{
      background:
        "linear-gradient(135deg, var(--mac-color-system-purple), var(--mac-color-system-pink))",
    }}
  />
);

const small = { minHeight: 150, "--mac-editorial-card-radius": "8px" } as CSSProperties;

/**
 * The states of a panel that is a button. Pressed and focused are transient, so this gallery
 * pins them with the `data-force` preview attribute; in an application they come from :active
 * and :focus-visible.
 */
export default function States() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
        width: 560,
        maxWidth: "100%",
      }}
    >
      <EditorialCard render={<button type="button" />} title="Normal" style={small} />
      <EditorialCard
        render={<button type="button" />}
        data-force="pressed"
        title="Pressed"
        style={small}
      />
      <EditorialCard
        render={<button type="button" />}
        data-force="focus"
        title="Keyboard focus"
        style={small}
      />
      <EditorialCard render={<button type="button" disabled />} title="Disabled" style={small} />
      <div data-window-state="inactive">
        <EditorialCard
          render={<button type="button" />}
          data-force="focus"
          title="Focus, window not key"
          style={small}
        />
      </div>
      <EditorialCard eyebrow="Featured" title="With artwork" artwork={art} style={small} />
    </div>
  );
}
