import { useState } from "react";

/**
 * Fixture for the harness's own checks (harness.visual.json): three lazy images far below the
 * window, each put on the page by the load handler of the one before. The first one loads only
 * once the harness page asks for it, so the others do not exist yet when the page first looks
 * for images. The page waits twice for each capture (before it reports the example ready, and
 * after the runner's actions), so a page that looks once per wait loads two of them and
 * captures the example with the third never asked for. The check reads the three colours.
 *
 * The colours are fixed, not tokens: the check is about the runner, not about an appearance.
 */
const COLORS = ["#1e3cc8", "#c81e3c", "#c8a01e"];

const image = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="${fill}"/></svg>`,
  )}`;

export default function VisualChainedImage() {
  const [count, setCount] = useState(1);
  return (
    <div style={{ width: 40, height: 6100, background: "#1e6e32" }}>
      <div style={{ height: 6000 }} />
      {COLORS.slice(0, count).map((color, index) => (
        <img
          key={color}
          src={image(color)}
          alt=""
          loading="lazy"
          width={40}
          height={20}
          style={{ display: "block", marginBottom: 10 }}
          onLoad={() => setCount((shown) => Math.max(shown, index + 2))}
        />
      ))}
    </div>
  );
}
