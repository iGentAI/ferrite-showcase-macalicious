import { SmartSearchField } from "macalicious/smart-search-field";
import { useEffect, useRef, useState } from "react";

const swatch = (good: boolean) => ({
  width: 20,
  height: 20,
  background: good ? "var(--mac-color-system-green)" : "var(--mac-color-system-red)",
});

/**
 * Fixture for the two keys the field keeps to itself, checked in a real browser by
 * `smart-search-field.visual.json`: the field inside a form inside a native modal dialog. The
 * comparisons capture the dialog, so a dialog that Escape dismissed fails its comparison.
 *
 * 260 x 62 pt. The field is x 20 to 180. The first square (x 190 to 210, y 21 to 41) turns
 * green when the field's `onSubmit` ran; the second (x 220 to 240) is green until the form
 * around the field is submitted.
 */
export default function VisualKeys() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [fieldSubmitted, setFieldSubmitted] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    // jsdom, where the examples' baseline tests run, has no modal dialogs.
    if (!element || typeof element.showModal !== "function") return;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <div style={{ width: 260, height: 62 }}>
      <dialog
        ref={dialog}
        aria-label="Open Location"
        style={{
          inset: "0 auto auto 0",
          boxSizing: "border-box",
          width: 260,
          height: 62,
          margin: 0,
          border: 0,
          padding: 0,
          background: "var(--mac-color-window-background)",
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setFormSubmitted(true);
          }}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: 20 }}
        >
          <SmartSearchField
            defaultValue="example.com"
            onSubmit={() => setFieldSubmitted(true)}
            style={{ width: 160 }}
          />
          <span style={swatch(fieldSubmitted)} />
          <span style={swatch(!formSubmitted)} />
        </form>
      </dialog>
    </div>
  );
}
