import { Stocks } from "../stocks";
import { darkMarket } from "../stocks-data";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Dark-Stocks.png, 2520 x 1830 px, i.e.
 * 1260 x 915 pt: the 1148 x 803 pt window at (56, 38) with its shadow around it, over the white
 * matte the comparison sets behind the capture's transparent margin.
 *
 * The Dark Aqua capture was taken on another day: its prices differ, its session is less than
 * half over, and the lead story of its feed has the text beside the picture. The demo shows
 * that market when it is given `darkMarket`.
 */
export default function VisualWindowDark() {
  return (
    <div style={{ width: 1260, height: 915, background: "white", position: "relative" }}>
      <Stocks market={darkMarket} style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
