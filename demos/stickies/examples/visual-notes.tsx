import { Stickies } from "../stickies";
import { defaultStickies } from "../stickies-data";

// Where the captures have the notes on the 1680 x 1050 pt screen.
const CAPTURED = [
  { x: 48, y: 281 },
  { x: 69, y: 303 },
];

const notes = defaultStickies.map((note, index) => ({
  ...note,
  frame: { ...note.frame, ...CAPTURED[index] },
}));

/**
 * Visual comparison target: the two notes of the Stickies screenshots, as the app lays them
 * out on a screen of the captured size.
 *
 * Reference crop (2x pixels) x=96 y=562 w=746 h=564, that is 373 x 282 pt from (48, 281): the
 * box around both notes. The blue note (355 x 268 pt) is behind, so its top 22 pt and left
 * 21 pt show; the yellow note (352 x 260 pt) is in front at (21, 22). Two corners of the box
 * are desktop picture, for which the demo has a stand-in: 18 x 22 pt at the top right and
 * 21 x 14 pt at the bottom left. The comparisons mask them.
 *
 * In the Aqua capture Stickies is frontmost and the yellow note is key. In the Dark Aqua
 * capture Finder is frontmost: the comparison renders the page as an inactive window, and no
 * note has a title strip.
 */
export default function VisualNotes() {
  return (
    <div style={{ position: "relative", width: 373, height: 282, overflow: "hidden" }}>
      <Stickies
        defaultNotes={notes}
        style={{ position: "absolute", left: -48, top: -281, width: 1680, height: 1050 }}
      />
    </div>
  );
}
