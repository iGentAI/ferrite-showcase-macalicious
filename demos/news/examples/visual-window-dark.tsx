import { News } from "../news";
import { darkEdition } from "../news-data";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Dark-News.png, 2738 x 1908 px, i.e.
 * 1369 x 954 pt: the window at (56, 38) with its shadow around it, over the white matte the
 * comparison sets behind the capture's transparent margin.
 *
 * The Dark Aqua capture was taken a day later in a window 35 pt wider, 1257 x 842 pt, with a
 * sidebar of 234 pt: the demo is given that width and `darkEdition`.
 */
export default function VisualWindowDark() {
  return (
    <div style={{ width: 1369, height: 954, background: "white", position: "relative" }}>
      <News
        edition={darkEdition}
        width={1257}
        style={{ position: "absolute", left: 56, top: 38 }}
      />
    </div>
  );
}
