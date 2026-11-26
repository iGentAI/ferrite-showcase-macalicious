/**
 * Fixture for the harness's own checks (harness.visual.json): a block at the example's top
 * left corner, which is the page origin, that changes colour while the pointer is over it.
 *
 * A pointer that has never moved rests at the origin. The runner takes it out of the window
 * before the capture, so the block must be drawn at rest; the companion check hovers it
 * with an action and expects the other colour, which proves that the block can tell.
 *
 * The colours are fixed, not tokens: the check is about the runner, not about an appearance.
 */
export default function VisualPointer() {
  return (
    <>
      <style>{`
        #pointer-probe { width: 40px; height: 20px; background: #1e6e32; }
        #pointer-probe:hover { background: #c81e1e; }
      `}</style>
      <div id="pointer-probe" />
    </>
  );
}
