import { Stocks } from "../stocks";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Stocks.png, 2520 x 1830 px, i.e.
 * 1260 x 915 pt: the 1148 x 803 pt window at (56, 38) with its shadow around it, over the white
 * matte the comparison sets behind the capture's transparent margin.
 *
 * The capture shows the app as the demo opens: Business News chosen, the ten symbols of a
 * finished session and a feed whose lead story spans the column.
 */
export default function VisualWindowLight() {
  return (
    <div style={{ width: 1260, height: 915, background: "white", position: "relative" }}>
      <Stocks style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
