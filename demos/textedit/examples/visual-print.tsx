import { TextEdit } from "../textedit";

/*
 * A sheet's material shows what is behind its window, not the window: in the captures that is
 * the desktop picture, sky at the left and rock at the right, and a part of it without much
 * colour between them. The demo has no desktop, and a page's backdrop filter sees the window
 * too. So a stand-in for the picture lies between the window and the sheet: three flat colours
 * that the library's sheet material composites to what the captures show at the sheet's left
 * end, middle and right end (10-15-Catalina-Light-Print.png and 10-15-Catalina-Dark-Print.png,
 * rows y=12 and y=350 of the sheet).
 */
const SKY = "light-dark(#529ada, #54acff)";
const PLAIN = "light-dark(#f6f6f6, #3c3c3c)";
const ROCK = "light-dark(#5d4f36, #283444)";
const DESKTOP = `linear-gradient(to right, ${SKY} 130px, ${PLAIN} 258px, ${PLAIN} 630px, ${ROCK} 740px)`;

/**
 * Visual comparison target: the Print sheet on TextEdit's document window, as in
 * 10-15-Catalina-Light-Print.png and 10-15-Catalina-Dark-Print.png, where the window is about
 * 460 pt wide and the sheet, 756 pt, hangs from under its format bar. The comparisons capture
 * the sheet (`.mac-sheet`): 756 x 419 pt, at x=141 y=204 in the Aqua capture and x=55 y=174 in
 * the Dark Aqua one. They open the Presets menu first, as in the captures.
 */
export default function VisualPrint() {
  return (
    <div style={{ position: "relative", width: 796, height: 520 }}>
      <TextEdit
        defaultDialog="print"
        width={460}
        height={500}
        style={{ position: "absolute", left: 168, top: 0 }}
      />
      <div
        style={{
          position: "absolute",
          zIndex: 1,
          left: -20,
          top: 48,
          width: 836,
          height: 500,
          background: DESKTOP,
        }}
      />
    </div>
  );
}
