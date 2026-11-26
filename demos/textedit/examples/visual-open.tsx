import { useState } from "react";
import { TextEdit } from "../textedit";

/**
 * Visual comparison target: TextEdit's Open panel on the Documents folder, 914 x 615 pt, as in
 * 10-15-Catalina-Light-Finder-Open.png and 10-15-Catalina-Dark-Finder-Open.png (crop x=112
 * y=76 w=1828 h=1230). The comparison selects "512 Pixels" first, as in the captures.
 *
 * The panel is a window of its own: it is rendered into the box around the document's window
 * and centred on it, so the box has the panel's size and the document lies behind it.
 */
export default function VisualOpen() {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setBox} style={{ position: "relative", width: 930, height: 631 }}>
      <TextEdit
        defaultDialog="open"
        panelContainer={box}
        style={{ position: "absolute", left: 153, top: 47 }}
      />
    </div>
  );
}
