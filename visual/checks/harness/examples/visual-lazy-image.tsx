/**
 * Fixture for the harness's own checks (harness.visual.json): an image marked loading="lazy"
 * far below the window. Its comparison declares no size, so the window stays small and the
 * image stays off screen, where the browser does not load it. The capture reaches it all the
 * same, so the harness page asks for it before it reports the example ready; the check reads
 * the image's colour.
 *
 * The colours are fixed, not tokens: the check is about the runner, not about an appearance.
 */
const IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#1e3cc8"/></svg>',
)}`;

export default function VisualLazyImage() {
  return (
    <div style={{ width: 40, background: "#1e6e32" }}>
      <div style={{ height: 6000 }} />
      <img src={IMAGE} alt="" loading="lazy" width={40} height={20} style={{ display: "block" }} />
    </div>
  );
}
