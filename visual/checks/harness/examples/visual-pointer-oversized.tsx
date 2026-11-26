/**
 * Fixture for the harness's own checks (harness.visual.json): a block larger than the browser
 * window, whatever its size, that changes colour while the pointer is over it.
 *
 * Its comparison declares no size, so nothing sizes the window for it, and the capture covers
 * every point of the window. A pointer parked anywhere inside the window, a corner included,
 * would be over the block; the runner takes it out of the window, so the block must be drawn
 * at rest.
 *
 * The colours are fixed, not tokens: the check is about the runner, not about an appearance.
 */
export default function VisualPointerOversized() {
  return (
    <>
      <style>{`
        #pointer-probe-oversized {
          width: calc(100vw + 100px);
          height: calc(100vh + 100px);
          background: #1e6e32;
        }
        #pointer-probe-oversized:hover { background: #c81e1e; }
      `}</style>
      <div id="pointer-probe-oversized" />
    </>
  );
}
