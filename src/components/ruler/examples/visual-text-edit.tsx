import { Ruler } from "macalicious/ruler";

/**
 * One ruler strip of a TextEdit window. The window is `width` + 2 pt wide: the captures
 * leave out its first and last point, which hold the window's edge highlight in Dark Aqua.
 * The tail indent is at the end of the text container, 10 pt less than the window.
 */
function Strip({ name, width }: { name: string; width: number }) {
  return (
    <div data-visual={name} style={{ position: "relative", overflow: "hidden", width, height: 32 }}>
      <Ruler
        style={{ position: "absolute", left: -1, width: width + 2 }}
        markers={[
          { type: "first-line-indent", position: 0 },
          { type: "head-indent", position: 0 },
          { type: "left", position: 72 },
          { type: "left", position: 144 },
          { type: "left", position: 216 },
          { type: "left", position: 288 },
          { type: "left", position: 360 },
          { type: "tail-indent", position: width - 8 },
        ]}
      />
    </div>
  );
}

/**
 * Visual comparison target: the ruler of TextEdit's document window, which starts at image
 * y=172 and is 64 px high in both captures. The two windows differ in width, so the example
 * holds one strip for each: `light` for 10-15-Catalina-Light-Text-Edit.png (crop x=114
 * y=172 w=1244 h=64, 622 x 32 pt) and `dark` for 10-15-Catalina-Dark-TextEdit.png (crop x=114
 * y=172 w=1190 h=64, 595 x 32 pt).
 */
export default function VisualTextEdit() {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Strip name="light" width={622} />
      <Strip name="dark" width={595} />
    </div>
  );
}
