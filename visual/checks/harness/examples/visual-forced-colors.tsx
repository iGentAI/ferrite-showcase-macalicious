/**
 * Fixture for the harness's own checks (harness.visual.json): a block with one colour, and
 * another one while the browser is in a forced-colours mode. `forced-color-adjust: none` keeps
 * the browser from replacing the colour, so the check reads which rule applied.
 *
 * The colours are fixed, not tokens: the check is about the runner, not about an appearance.
 */
export default function VisualForcedColors() {
  return (
    <>
      <style>{`
        #forced-colors-probe {
          width: 40px;
          height: 20px;
          forced-color-adjust: none;
          background: #1e6e32;
        }
        @media (forced-colors: active) {
          #forced-colors-probe { background: #1e3cc8; }
        }
      `}</style>
      <div id="forced-colors-probe" />
    </>
  );
}
