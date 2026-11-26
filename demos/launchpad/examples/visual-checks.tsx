import { CatalinaLaunchpad } from "../launchpad";

/**
 * State check target: the whole 1680 by 1050 pt screen with Launchpad showing, over a flat mid
 * grey, #808080, in place of the demo's picture. Over a flat grey the result of every layer
 * can be computed from the library's tokens (blur and saturation leave it as it is), so the
 * checks pin where things are: Launchpad's scrim is #545454 everywhere, and the edges of the
 * search field, of the placeholders in the grid's corners, of the page dots and of the Dock
 * are looked for at the points the Launchpad captures have them.
 */
export default function VisualChecks() {
  return (
    <CatalinaLaunchpad
      defaultOpen
      picture={<div style={{ background: "#808080" }} />}
      style={{ width: 1680, height: 1050 }}
    />
  );
}
