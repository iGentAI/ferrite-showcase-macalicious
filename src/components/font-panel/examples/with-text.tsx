import { FontPanel } from "macalicious/font-panel";
import {
  applyRichTextFormat,
  FONT_FAMILIES,
  keepRichTextSelection,
  type RichTextFormat,
  type RichTextSelectionKeeper,
  readRichTextFormat,
} from "macalicious/lib/rich-text";
import { RichTextView } from "macalicious/text-view";
import { useEffect, useRef, useState } from "react";

/**
 * A Fonts panel acting on a rich text view: select some text, then choose a family, a
 * typeface, a size, an underline or a colour. The panel follows the insertion point, and the
 * text gets its selection back before each change, whatever the panel's controls did with it.
 */
export default function WithText() {
  const view = useRef<HTMLDivElement>(null);
  const keeper = useRef<RichTextSelectionKeeper>(null);
  const [format, setFormat] = useState<RichTextFormat>();
  useEffect(() => {
    const node = view.current;
    if (!node) return;
    const kept = keepRichTextSelection(node);
    keeper.current = kept;
    const read = () => {
      // While a control of the panel has the focus, the panel shows the text it will act on.
      const selection = document.getSelection();
      const inside = selection?.anchorNode ? node.contains(selection.anchorNode) : false;
      if (inside) setFormat(readRichTextFormat(node));
    };
    read();
    document.addEventListener("selectionchange", read);
    return () => {
      document.removeEventListener("selectionchange", read);
      kept.dispose();
    };
  }, []);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ height: 60, border: "1px solid var(--mac-color-separator)" }}>
        <RichTextView
          ref={view}
          aria-label="Text"
          style={{ font: "12px / 14px Helvetica, Arial, sans-serif" }}
        >
          <div>Select some of this text and give it another font.</div>
        </RichTextView>
      </div>
      <FontPanel
        families={FONT_FAMILIES}
        value={format}
        onFontChange={(change) => {
          const node = view.current;
          if (!node) return;
          keeper.current?.restore();
          applyRichTextFormat(node, change);
          setFormat(readRichTextFormat(node));
        }}
      />
    </div>
  );
}
