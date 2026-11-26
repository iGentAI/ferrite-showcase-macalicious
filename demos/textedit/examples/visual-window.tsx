import { TextEdit } from "../textedit";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Text-Edit.png, 1472 x 1298 px,
 * i.e. 736 x 649 pt: the 624 x 537 pt window at (56, 38) with its shadow around it, over the
 * white matte the comparison sets behind the capture's transparent margin.
 */
export default function VisualWindow() {
  return (
    <div style={{ width: 736, height: 649, background: "white", position: "relative" }}>
      <TextEdit style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
