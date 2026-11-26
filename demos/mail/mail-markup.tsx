"use client";

import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useEffect, useRef, useState } from "react";
import { servedByDesktopApp, sessionFetch } from "../desktop/desktop-server";
import {
  clampPoint,
  drawMarks,
  handleAt,
  handlesOf,
  LINE_HEIGHT,
  MARKUP_LIMITS,
  type Mark,
  type MarkStyle,
  markAt,
  markFont,
  moved,
  newMarkId,
  type Point,
  PREVIEW_SIGNATURES_URL,
  placeSignature,
  resized,
  type Signature,
  shapeBetween,
  signaturesFromServer,
} from "../preview/preview-markup";

/** The inks of the pen, each a token of `mail.tokens.css`. */
const INKS = [
  ["Red", "--mac-mail-markup-red"],
  ["Blue", "--mac-mail-markup-blue"],
  ["Black", "--mac-mail-markup-black"],
] as const;

type InkToken = (typeof INKS)[number][1];

/** The tools of the sheet, as Preview's markup draws them. */
const TOOLS = [
  ["select", "Select"],
  ["sketch", "Sketch"],
  ["rect", "Rectangle"],
  ["oval", "Oval"],
  ["line", "Line"],
  ["arrow", "Arrow"],
  ["text", "Text"],
] as const;

type Tool = (typeof TOOLS)[number][0];

/** Where on the picture a point of its element as shown lies, however large it is drawn. */
export function picturePoint(
  at: { clientX: number; clientY: number },
  box: { left: number; top: number; width: number; height: number },
): Point {
  return clampPoint([
    (at.clientX - box.left) / Math.max(1, box.width),
    (at.clientY - box.top) / Math.max(1, box.height),
  ]);
}

/** How wide a line is on a picture of this size, as a share of its width: a large one shows it as well. */
const lineWidth = (picture: { width: number; height: number }) =>
  Math.max(3, Math.round(Math.max(picture.width, picture.height) / 200)) /
  Math.max(1, picture.width);

/** How large text is on a picture of this size, as a share of its width: never too small to read. */
const textSize = (picture: { width: number }) => Math.max(0.03, 14 / Math.max(1, picture.width));

/** What a tool draws from a press to where the pointer is now; a sketch adds to the line it has. */
export function markBetween(
  tool: Exclude<Tool, "text" | "select">,
  from: Point,
  to: Point,
  style: { color: string; stroke: number },
  sketched: Mark | null = null,
): Mark {
  if (tool !== "sketch") return shapeBetween(tool, from, to, style);
  return {
    id: sketched?.id ?? newMarkId(),
    kind: "sketch",
    ...style,
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    // Twice over at first, so that a press alone leaves a dot.
    points: sketched ? [...(sketched.points ?? []), to] : [from, to],
  };
}

/** A text typed at `at`, or nothing when nothing was typed. */
export function textAt(
  at: Point,
  text: string,
  style: { color: string; stroke: number },
  size: number,
  box: { w: number; h: number } = { w: 0, h: 0 },
): Mark | null {
  const words = text.trim();
  if (!words) return null;
  return {
    id: newMarkId(),
    kind: "text",
    ...style,
    x: at[0],
    y: at[1],
    w: box.w,
    h: box.h,
    text: words.slice(0, MARKUP_LIMITS.text),
    size,
  };
}

/**
 * The box of a text on a picture, so that it can be chosen and scaled by its corners; `across` is the
 * width of a line as a share of the picture's width.
 */
export function textBoxOn(
  picture: { width: number; height: number },
  text: string,
  size: number,
  across: (line: string) => number,
): { w: number; h: number } {
  const lines = text.trim().split("\n");
  return {
    w: Math.max(...lines.map(across)),
    h: (lines.length * size * picture.width * LINE_HEIGHT) / Math.max(1, picture.height),
  };
}

/** A press with the Select tool: on the chosen mark's handle, or on a mark. */
export interface MarkPress {
  mark: Mark;
  from: Point;
  /** The handle held, or `null` for the mark being moved whole. */
  handle: number | null;
}

/** What a press at `at` takes, within `reach` of it: the chosen mark's handle comes first. */
export function pressOn(
  marks: readonly Mark[],
  chosen: string | null,
  at: Point,
  reach: number,
): MarkPress | null {
  const current = marks.find((mark) => mark.id === chosen);
  const handle = current ? handleAt(current, at, reach) : null;
  if (current && handle !== null) return { mark: current, from: at, handle };
  const hit = markAt(marks, at, reach);
  return hit ? { mark: hit, from: at, handle: null } : null;
}

/** The mark a press holds, with the pointer now at `to`. */
export const heldTo = (press: MarkPress, to: Point): Mark =>
  press.handle === null
    ? moved(press.mark, to[0] - press.from[0], to[1] - press.from[1])
    : resized(press.mark, press.handle, to);

/** How near a press has to be, in points of the sheet, to take a mark or a handle. */
const REACH = 8;

/**
 * Marks up a picture attached to a New Message: the pen, shapes, text and the signatures kept by
 * Preview, in one of three inks. Select chooses a mark, to move it, resize it by its handles or
 * delete it; Undo takes back each change. Done hands back the picture with its marks drawn into it,
 * as a PNG.
 */
export function MailMarkup({
  picture,
  name,
  onDone,
  onCancel,
}: {
  picture: Blob;
  name: string;
  onDone: (marked: Blob) => void;
  onCancel: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ink, setInk] = useState<InkToken>("--mac-mail-markup-red");
  const [tool, setTool] = useState<Tool>("sketch");
  const [marks, setMarks] = useState<readonly Mark[]>([]);
  const [earlier, setEarlier] = useState<readonly (readonly Mark[])[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<readonly Signature[]>([]);
  const pressed = useRef<MarkPress | null>(null);
  const [held, setHeld] = useState<Mark | null>(null);
  const drawing = useRef<{ from: Point; mark: Mark | null } | null>(null);
  const [typing, setTyping] = useState<{ at: Point; style: MarkStyle } | null>(null);
  const typed = useRef("");

  useEffect(() => {
    const url = URL.createObjectURL(picture);
    const loaded = new Image();
    loaded.onload = () => setImage(loaded);
    loaded.onerror = () => setFailed(true);
    loaded.src = url;
    return () => URL.revokeObjectURL(url);
  }, [picture]);

  useEffect(() => {
    if (!servedByDesktopApp()) return;
    let open = true;
    sessionFetch(PREVIEW_SIGNATURES_URL)
      .then((reply) => (reply.ok ? reply.json() : null))
      .then((stored) => {
        if (open) setSignatures(signaturesFromServer(stored) ?? []);
      })
      .catch(() => {
        if (open) setSignatures([]);
      });
    return () => {
      open = false;
    };
  }, []);

  const change = (next: readonly Mark[]) => {
    setEarlier((list) => [...list, marks]);
    setMarks(next);
  };
  const shown = held ? marks.map((mark) => (mark.id === held.id ? held : mark)) : marks;
  const current = shown.find((mark) => mark.id === chosen) ?? null;

  const draw = (all: readonly Mark[]) => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context || !image) return;
    context.drawImage(image, 0, 0);
    drawMarks(context, all, element.width, element.height);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: `draw` reads what these name
  useEffect(() => {
    const element = canvas.current;
    if (!element || !image) return;
    element.width = image.naturalWidth;
    element.height = image.naturalHeight;
    draw(shown);
  }, [image, marks, held]);

  const styleNow = (element: HTMLCanvasElement): MarkStyle => ({
    color: getComputedStyle(element).getPropertyValue(ink),
    stroke: lineWidth(element),
  });
  const endTyping = (keep: boolean) => {
    const element = canvas.current;
    if (typing && keep && element) {
      const size = textSize(element);
      const context = element.getContext("2d");
      if (context) context.font = markFont(undefined, size * element.width);
      const mark = textAt(
        typing.at,
        typed.current,
        typing.style,
        size,
        textBoxOn(element, typed.current, size, (line) =>
          context ? context.measureText(line).width / element.width : line.length * size * 0.6,
        ),
      );
      if (mark) change([...marks, mark]);
    }
    typed.current = "";
    setTyping(null);
  };
  const sign = (signature: Signature) => {
    const element = canvas.current;
    if (!element) return;
    const mark = placeSignature(
      signature,
      [0.5, 0.5],
      0.4,
      element.width / Math.max(1, element.height),
      styleNow(element),
    );
    change([...marks, mark]);
    setChosen(mark.id);
    setTool("select");
  };

  return (
    <div
      role="dialog"
      aria-label={`Markup: ${name}`}
      className="mac-mail-markup"
      onKeyDown={(event) => {
        if (typing || !chosen || (event.key !== "Delete" && event.key !== "Backspace")) return;
        event.preventDefault();
        change(marks.filter((mark) => mark.id !== chosen));
        setChosen(null);
      }}
    >
      <div role="toolbar" aria-label="Markup tools" className="mac-mail-markup-tools">
        {TOOLS.map(([value, title]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tool === value}
            className="mac-mail-markup-tool"
            onClick={() => {
              setTool(value);
              if (value !== "select") setChosen(null);
            }}
          >
            {title}
          </button>
        ))}
        {INKS.map(([title, token]) => (
          <button
            key={token}
            type="button"
            aria-label={title}
            aria-pressed={ink === token}
            className="mac-mail-markup-ink"
            style={{ background: `var(${token})` }}
            onClick={() => setInk(token)}
          />
        ))}
        {signatures.length > 0 ? (
          signatures.map((signature, index) => (
            <button
              key={signature.id}
              type="button"
              className="mac-mail-markup-tool"
              onClick={() => sign(signature)}
            >
              Signature {index + 1}
            </button>
          ))
        ) : (
          <button
            type="button"
            disabled
            className="mac-mail-markup-tool"
            title="No signatures yet: make one in Preview, with Sign in its markup bar."
          >
            Signature
          </button>
        )}
        <PushButton
          size="small"
          disabled={earlier.length === 0}
          onClick={() => {
            setMarks(earlier.at(-1) ?? []);
            setEarlier(earlier.slice(0, -1));
          }}
        >
          Undo
        </PushButton>
      </div>
      {failed ? (
        <Label role="alert">This picture could not be read.</Label>
      ) : (
        <div className="mac-mail-markup-stage">
          <canvas
            ref={canvas}
            aria-label="Picture to mark up"
            className="mac-mail-markup-canvas"
            data-tool={tool}
            tabIndex={-1}
            onPointerDown={(event) => {
              if (tool === "text") return;
              const element = event.currentTarget;
              const box = element.getBoundingClientRect();
              const from = picturePoint(event, box);
              if (tool === "select") {
                element.focus();
                const press = pressOn(marks, chosen, from, REACH / Math.max(1, box.width));
                setChosen(press?.mark.id ?? null);
                pressed.current = press;
                if (press) element.setPointerCapture(event.pointerId);
                return;
              }
              element.setPointerCapture(event.pointerId);
              drawing.current = {
                from,
                mark: tool === "sketch" ? markBetween(tool, from, from, styleNow(element)) : null,
              };
              if (drawing.current.mark) draw([...marks, drawing.current.mark]);
            }}
            onPointerMove={(event) => {
              const element = event.currentTarget;
              const to = picturePoint(event, element.getBoundingClientRect());
              if (pressed.current) {
                setHeld(heldTo(pressed.current, to));
                return;
              }
              const drawn = drawing.current;
              if (!drawn || tool === "text" || tool === "select") return;
              drawn.mark = markBetween(tool, drawn.from, to, styleNow(element), drawn.mark);
              draw([...marks, drawn.mark]);
            }}
            onPointerUp={(event) => {
              const press = pressed.current;
              pressed.current = null;
              setHeld(null);
              if (press) {
                const to = picturePoint(event, event.currentTarget.getBoundingClientRect());
                if (to[0] !== press.from[0] || to[1] !== press.from[1]) {
                  const after = heldTo(press, to);
                  change(marks.map((mark) => (mark.id === after.id ? after : mark)));
                }
              }
              const done = drawing.current?.mark;
              drawing.current = null;
              if (done) change([...marks, done]);
            }}
            onClick={(event) => {
              if (tool !== "text") return;
              const element = event.currentTarget;
              setTyping({
                at: picturePoint(event, element.getBoundingClientRect()),
                style: styleNow(element),
              });
            }}
          />
          {current
            ? handlesOf(current).map(([x, y], index) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: a handle is its place in the mark's list
                  key={index}
                  aria-hidden
                  className="mac-mail-markup-handle"
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                />
              ))
            : null}
          {typing ? (
            <input
              // biome-ignore lint/a11y/noAutofocus: the person has just pressed where this field stands
              autoFocus
              aria-label="Text to place on the picture"
              className="mac-mail-markup-text"
              style={{
                left: `${typing.at[0] * 100}%`,
                top: `${typing.at[1] * 100}%`,
                color: typing.style.color,
              }}
              onChange={(event) => {
                typed.current = event.currentTarget.value;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") endTyping(true);
                else if (event.key === "Escape") {
                  event.stopPropagation();
                  endTyping(false);
                }
              }}
              onBlur={() => endTyping(true)}
            />
          ) : null}
        </div>
      )}
      <div className="mac-mail-markup-buttons">
        <PushButton onClick={onCancel}>Cancel</PushButton>
        <PushButton
          variant="primary"
          disabled={marks.length === 0}
          onClick={() => {
            canvas.current?.toBlob((blob) => {
              if (blob) onDone(blob);
              else setFailed(true);
            }, "image/png");
          }}
        >
          Done
        </PushButton>
      </div>
    </div>
  );
}
