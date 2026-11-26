import { Home } from "../home";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Home.png and of its Dark Aqua
 * twin, 2052 x 1760 px, i.e. 1026 x 880 pt: the 914 x 768 pt window at (56, 38) with its shadow
 * around it, over the white matte the comparison sets behind the capture's transparent margin.
 *
 * Both captures show the Home tab as the demo opens: the same eleven accessories and five
 * scenes, three of the accessories and one scene on.
 */
export default function VisualWindow() {
  return (
    <div style={{ width: 1026, height: 880, background: "white", position: "relative" }}>
      <Home style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
