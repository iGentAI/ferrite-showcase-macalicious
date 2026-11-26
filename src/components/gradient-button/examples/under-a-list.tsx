import {
  GradientButton,
  GradientButtonFiller,
  GradientButtonGroup,
} from "macalicious/gradient-button";
import { type KeyboardEvent, useId, useRef, useState } from "react";

const border = "1px solid var(--mac-color-list-border)";

/**
 * The usual arrangement: the bar is attached to the bottom of a bordered list, starts at its
 * left edge, and a filler cell continues it to the right edge. The list is plain markup here:
 * it keeps the focus itself and the arrow keys move the selection.
 */
export default function UnderAList() {
  const listId = useId();
  const nextId = useRef(3);
  const [items, setItems] = useState([
    { id: 1, name: "iCloud" },
    { id: 2, name: "Exchange" },
  ]);
  const [selected, setSelected] = useState(0);

  function moveSelection(event: KeyboardEvent) {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0 || items.length === 0) return;
    event.preventDefault();
    const next = Math.min(items.length - 1, Math.max(0, selected + step));
    setSelected(next);
    // The focus stays on the list, so the browser does not scroll to the option by itself.
    const option = document.getElementById(`${listId}-${items[next]?.id}`);
    option?.scrollIntoView?.({ block: "nearest" });
  }

  return (
    <div style={{ width: 200, font: "var(--mac-font-body)" }}>
      <div
        role="listbox"
        aria-label="Accounts"
        aria-activedescendant={items[selected] ? `${listId}-${items[selected].id}` : undefined}
        tabIndex={0}
        onKeyDown={moveSelection}
        style={{
          height: 80,
          overflow: "auto",
          border,
          borderBottom: 0,
          background: "var(--mac-color-control-background)",
        }}
      >
        {items.map((item, index) => (
          // biome-ignore lint/a11y/useFocusableInteractive: the listbox keeps the focus and names the active option with aria-activedescendant
          // biome-ignore lint/a11y/useKeyWithClickEvents: the listbox keeps the focus and handles the arrow keys
          <div
            key={item.id}
            id={`${listId}-${item.id}`}
            role="option"
            aria-selected={index === selected}
            onClick={() => setSelected(index)}
            style={{
              padding: "2px 6px",
              background:
                index === selected
                  ? "var(--mac-color-selected-content-background-unemphasized)"
                  : undefined,
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
      <GradientButtonGroup aria-label="Edit accounts" style={{ display: "flex" }}>
        <GradientButton
          glyph="add"
          aria-label="Add an account"
          onClick={() => {
            const id = nextId.current++;
            setItems([...items, { id, name: `Account ${id}` }]);
            setSelected(items.length);
          }}
        />
        <GradientButton
          glyph="remove"
          aria-label="Remove the selected account"
          disabled={items.length === 0}
          onClick={() => {
            setItems(items.filter((_, index) => index !== selected));
            setSelected(Math.max(0, selected - 1));
          }}
        />
        <GradientButtonFiller />
      </GradientButtonGroup>
    </div>
  );
}
