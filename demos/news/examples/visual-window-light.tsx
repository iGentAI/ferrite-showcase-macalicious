import { News } from "../news";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-News.png, 2668 x 1908 px, i.e.
 * 1334 x 954 pt: the 1222 x 842 pt window at (56, 38) with its shadow around it, over the white
 * matte the comparison sets behind the capture's transparent margin.
 *
 * The stories are the demo's own: the captures' photographs, publisher logos and channel icons
 * are masked in every comparison, and the headlines are invented.
 */
export default function VisualWindowLight() {
  return (
    <div style={{ width: 1334, height: 954, background: "white", position: "relative" }}>
      <News style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
