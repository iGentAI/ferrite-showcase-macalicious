import { TextEdit } from "../textedit";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Dark-TextEdit.png, 1418 x 1238 px,
 * i.e. 709 x 619 pt: the window is 597 x 507 pt in this capture, at (56, 38) with its shadow
 * around it, over a white matte.
 */
export default function VisualWindowDark() {
  return (
    <div style={{ width: 709, height: 619, background: "white", position: "relative" }}>
      <TextEdit width={597} height={507} style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
