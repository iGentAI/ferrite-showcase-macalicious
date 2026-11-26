"use client";

import { BorderedList } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { type KeyboardEvent, type PointerEvent, useId, useRef, useState } from "react";
import { usePreference } from "../../pane";
import { movedTo, TODAY_OFF, TODAY_ORDER, TODAY_STARTS_OFF, todayWidgets } from "./today-widgets";

const ROW_HEIGHT = 32;
const NONE: readonly string[] = [];

/**
 * The Today category on the served desktop: the widgets of Notification Center, in its order. Drag a
 * row, or press Option-Up or Option-Down on it, to move it; the checkbox turns a widget off.
 */
export function TodayExtensions() {
  const [order, setOrder] = usePreference<readonly string[]>(TODAY_ORDER, NONE);
  const [off, setOff] = usePreference<readonly string[]>(TODAY_OFF, TODAY_STARTS_OFF);
  const titleId = useId();
  const widgets = todayWidgets(order, off);
  const ids = widgets.map((widget) => widget.id as string);
  // The drag under way: the row, where it started, and where it would land.
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null);
  const start = useRef(0);
  const shown = drag
    ? movedTo(ids, drag.id, drag.to).flatMap((id) => widgets.filter((widget) => widget.id === id))
    : widgets;

  const press = (event: PointerEvent<HTMLUListElement>) => {
    const target = event.target as Element;
    if (target.closest("input, button, label, [role='checkbox']")) return;
    const id = target.closest<HTMLElement>("li")?.dataset.widget;
    if (!id) return;
    // The list, not the row: a row that moves in the document would lose the pointer.
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = event.clientY;
    setDrag({ id, to: ids.indexOf(id) });
  };
  const move = (event: PointerEvent<HTMLUListElement>) => {
    if (!drag) return;
    const steps = Math.round((event.clientY - start.current) / ROW_HEIGHT);
    const to = Math.max(0, Math.min(ids.length - 1, ids.indexOf(drag.id) + steps));
    if (to !== drag.to) setDrag({ ...drag, to });
  };
  const release = () => {
    if (drag && ids.indexOf(drag.id) !== drag.to) setOrder(movedTo(ids, drag.id, drag.to));
    setDrag(null);
  };
  const keys = (event: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const to = ids.indexOf(id) + (event.key === "ArrowUp" ? -1 : 1);
    if (to >= 0 && to < ids.length) setOrder(movedTo(ids, id, to));
  };

  return (
    <div style={{ padding: 20 }}>
      <Label id={titleId}>Today shows these widgets, in this order. Drag one to move it.</Label>
      <BorderedList style={{ width: 360, marginTop: 12 }}>
        <ul
          aria-labelledby={titleId}
          className="mac-system-preferences-extensions-today"
          onPointerDown={press}
          onPointerMove={move}
          onPointerUp={release}
          onPointerCancel={() => setDrag(null)}
          onLostPointerCapture={() => setDrag(null)}
        >
          {shown.map((widget) => (
            <li
              key={widget.id}
              data-widget={widget.id}
              data-dragging={drag?.id === widget.id ? "" : undefined}
              style={{ height: ROW_HEIGHT }}
              onKeyDown={(event) => keys(event, widget.id)}
            >
              <Checkbox
                checked={widget.on}
                onCheckedChange={(on) =>
                  setOff(on ? off.filter((id) => id !== widget.id) : [...off, widget.id])
                }
              >
                {widget.name}
              </Checkbox>
            </li>
          ))}
        </ul>
      </BorderedList>
    </div>
  );
}
