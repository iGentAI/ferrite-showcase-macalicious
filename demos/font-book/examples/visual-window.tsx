import { FontBook } from "../font-book";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Font-Book.png and of its Dark
 * Aqua twin, 2258 x 1430 px, i.e. 1129 x 715 pt: the 1017 x 603 pt window at (56, 38) with its
 * shadow around it, over the white matte the comparison sets behind the capture's transparent
 * margin.
 *
 * Both captures show the demo as it opens: All Fonts, the font list at its end with Zapf
 * Dingbats expanded and its Regular selected, the Sample view at 42 pt. The font list has the
 * keyboard focus in the captures, which the comparisons give it with a click on the selected
 * row.
 */
export default function VisualWindow() {
  return (
    <div style={{ width: 1129, height: 715, background: "white", position: "relative" }}>
      <FontBook style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
