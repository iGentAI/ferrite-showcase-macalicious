import { IconView } from "macalicious/icon-view";

const COUNT = 5000;

const label = (index: number) => `Item ${index + 1}`;

// Stand-in artwork: a rounded tile whose hue follows the index.
const renderIcon = (index: number) => (
  <svg viewBox="0 0 64 64" width="64" height="64" style={{ color: `hsl(${index * 37} 55% 58%)` }}>
    <title>Tile</title>
    <rect x="5" y="5" width="54" height="54" rx="12" fill="currentColor" />
  </svg>
);

/**
 * Five thousand items: only the rows in view (and a few beyond) are in the document. Typing
 * "item 2500" goes there; Shift and Command extend the selection.
 */
export default function Large() {
  return (
    <IconView
      aria-label="Items"
      count={COUNT}
      renderIcon={renderIcon}
      getItemLabel={label}
      defaultValue={[0]}
      style={{ width: 600, height: 360 }}
    />
  );
}
