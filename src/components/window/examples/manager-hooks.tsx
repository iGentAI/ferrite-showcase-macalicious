import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { type PointerEvent, useEffect, useRef, useState } from "react";

type Frame = { id: string; title: string; x: number; y: number };

/**
 * What a window manager does with the hooks: it owns which window is key, their order and
 * their positions. Press a window to make it key; drag one by its title bar; close removes it.
 * The windows themselves hold no state.
 */
export default function ManagerHooks() {
  const [frames, setFrames] = useState<Frame[]>([
    { id: "a", title: "First", x: 24, y: 20 },
    { id: "b", title: "Second", x: 150, y: 70 },
  ]);
  const key = frames.at(-1)?.id;

  const raise = (id: string) =>
    setFrames((all) => [...all.filter((f) => f.id !== id), ...all.filter((f) => f.id === id)]);

  // How to end the drag of each window that is being dragged.
  const drags = useRef(new Map<string, () => void>());
  // Drags end with the manager.
  useEffect(() => {
    const dragging = drags.current;
    return () => {
      for (const end of [...dragging.values()]) end();
    };
  }, []);

  const startDrag = (id: string, event: PointerEvent<HTMLDivElement>) => {
    const bar = event.currentTarget;
    const pointer = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    const origin = frames.find((f) => f.id === id);
    if (!origin) return;
    // One drag per window: a second finger on the bar takes the drag over.
    drags.current.get(id)?.();
    bar.setPointerCapture(pointer);
    // The bar hears every pointer that is over it; the drag follows the one that started it.
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointer) return;
      setFrames((all) =>
        all.map((f) =>
          f.id === id
            ? { ...f, x: origin.x + e.clientX - start.x, y: origin.y + e.clientY - start.y }
            : f,
        ),
      );
    };
    // A drag also ends when the browser cancels the pointer or takes the capture away.
    const ends = ["pointerup", "pointercancel", "lostpointercapture"] as const;
    const stop = (e?: globalThis.PointerEvent) => {
      if (e && e.pointerId !== pointer) return;
      bar.removeEventListener("pointermove", move);
      for (const type of ends) bar.removeEventListener(type, stop);
      // Ended from outside (taken over, window closed), the drag still holds its pointer.
      if (bar.hasPointerCapture(pointer)) bar.releasePointerCapture(pointer);
      drags.current.delete(id);
    };
    bar.addEventListener("pointermove", move);
    for (const type of ends) bar.addEventListener(type, stop);
    drags.current.set(id, () => stop());
  };

  return (
    <div style={{ position: "relative", width: "100%", height: 260, overflow: "hidden" }}>
      {frames.map((frame) => (
        <Window
          key={frame.id}
          state={frame.id === key ? "key" : "inactive"}
          width={240}
          height={130}
          style={{ position: "absolute", left: frame.x, top: frame.y }}
          onPointerDownCapture={() => raise(frame.id)}
          onFocusCapture={() => raise(frame.id)}
        >
          <TitleBar
            title={frame.title}
            controls={
              <WindowControls
                zoomDisabled
                minimizeDisabled
                onClose={() => {
                  drags.current.get(frame.id)?.();
                  setFrames((all) => all.filter((f) => f.id !== frame.id));
                }}
              />
            }
            onDragRegionPointerDown={(event) => startDrag(frame.id, event)}
          />
          <WindowBody style={{ padding: 20, display: "grid", placeItems: "end" }}>
            <PushButton variant="primary">OK</PushButton>
          </WindowBody>
        </Window>
      ))}
    </div>
  );
}
