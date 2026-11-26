"use client";

import {
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentProps,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import "./image-well.tokens.css";
import "./image-well.css";

export interface ImageWellProps extends Omit<ComponentProps<"div">, "onChange"> {
  /**
   * Address of the image, when controlled; `null` for an empty well. Use it with
   * `onImageChange`: the well then shows what you pass and never an image of its own.
   */
  src?: string | null;
  /**
   * Address of the image the well starts with, when uncontrolled. The well then shows a
   * dropped, pasted or chosen file by itself, and empties itself on Delete.
   */
  defaultSrc?: string;
  /**
   * Text alternative of the image. It is also the well's accessible name when there is no
   * `aria-label` or `aria-labelledby`.
   * @default ""
   */
  alt?: string;
  /**
   * Called with the image file that was dropped on the well, pasted into it or chosen in the
   * file dialog, and with `null` when Delete or Backspace clears it.
   */
  onImageChange?: (file: File | null) => void;
  /**
   * Whether the image can be replaced and cleared (NSImageView.isEditable). An editable well
   * is a button: it takes keyboard focus, accepts a dropped or pasted image file, opens the
   * file dialog when activated and clears on Delete. A well that is not editable only shows
   * its image in the frame.
   * @default true
   */
  editable?: boolean;
  /**
   * File types the well takes, as in `<input type="file" accept>`: MIME types, with `*` for a
   * whole group, and file name extensions, separated by commas.
   * @default "image/*"
   */
  accept?: string;
  /**
   * Disables an editable well: it leaves the tab order and ignores drops, pastes and keys, and
   * its image is dimmed.
   * @default false
   */
  disabled?: boolean;
  /**
   * Frame around the image (NSImageView.imageFrameStyle). `"bezel"` is the recessed well with
   * the 2 pt ring; `"photo"` a thin outline with a drop shadow; `"groove"` an etched line;
   * `"button"` a raised bezel; `"none"` no frame.
   * @default "bezel"
   */
  frame?: "bezel" | "photo" | "groove" | "button" | "none";
  /**
   * How the image fits the well (NSImageView.imageScaling). `"proportionally-down"` shrinks a
   * larger image and never enlarges a smaller one; `"proportionally-up-or-down"` always fits
   * it; `"axes-independently"` stretches it to the well; `"none"` shows it at its own size,
   * cropped by the well.
   * @default "proportionally-down"
   */
  scaling?: "proportionally-down" | "proportionally-up-or-down" | "axes-independently" | "none";
  /** Shown while the well has no image: a placeholder, or an inline SVG in place of a file. */
  children?: ReactNode;
}

/** Whether a file matches an `accept` list: "image/*", "image/png", ".png". */
function accepts(file: File, accept: string) {
  // As for the native input, an empty list restricts nothing.
  if (accept.trim() === "") return true;
  return accept.split(",").some((entry) => {
    const type = entry.trim().toLowerCase();
    if (type.startsWith(".")) return file.name.toLowerCase().endsWith(type);
    if (type.endsWith("/*")) return file.type.startsWith(type.slice(0, -1));
    return type !== "" && file.type === type;
  });
}

/**
 * A Catalina image well (NSImageView with a frame, editable): shows one image in a bezel and
 * takes a new one by drag and drop, paste or the file dialog.
 *
 * An editable well has `role="button"` and needs an accessible name: `aria-label`,
 * `aria-labelledby` or the image's `alt`. It accepts every `<div>` attribute. The library
 * ships no artwork: supply your own images.
 */
export function ImageWell({
  src: srcProp,
  defaultSrc,
  alt = "",
  onImageChange,
  editable = true,
  accept = "image/*",
  disabled = false,
  frame = "bezel",
  scaling = "proportionally-down",
  className,
  children,
  onClick,
  onKeyDown,
  onKeyUp,
  onBlur,
  onPaste,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  ...props
}: ImageWellProps) {
  const [ownSrc, setOwnSrc] = useState<string | null>(defaultSrc ?? null);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Space went down on the well, which has not lost focus or stopped taking input since.
  const spaceDown = useRef(false);
  // The object URL of a file the uncontrolled well is showing; released when it is replaced
  // and when the well unmounts.
  const objectUrl = useRef<string | null>(null);
  const release = () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: releases the last object URL on unmount only
  useEffect(() => release, []);

  const src = srcProp !== undefined ? srcProp : ownSrc;
  const hasImage = src != null && src !== "";
  const empty = !hasImage && (children == null || children === false);
  const active = editable && !disabled;
  // A drag that was over the well when it stopped taking drops is no longer a drop target.
  if (dragOver && !active) setDragOver(false);
  // Nor does a Space that was down then act when the well takes input again. Cleared when
  // the change is committed: a render React abandons leaves the press as it was.
  useLayoutEffect(() => {
    if (!active) spaceDown.current = false;
  }, [active]);

  const commit = (file: File | null) => {
    onImageChange?.(file);
    if (srcProp !== undefined) return;
    release();
    if (file) objectUrl.current = URL.createObjectURL(file);
    setOwnSrc(objectUrl.current);
  };
  const take = (files: FileList | null | undefined) => {
    const file = files && Array.from(files).find((candidate) => accepts(candidate, accept));
    if (file) commit(file);
    return Boolean(file);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (active && !event.defaultPrevented) input.current?.click();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!active || event.defaultPrevented || event.target !== event.currentTarget) return;
    // Like a button: Return acts when it goes down, Space when it comes back up, and both
    // act through a click on the well, so that onClick hears of it and can refuse it.
    if (event.key === "Enter") event.currentTarget.click();
    else if (event.key === " ") spaceDown.current = true;
    else if ((event.key === "Delete" || event.key === "Backspace") && !empty) commit(null);
    else return;
    event.preventDefault();
  };
  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyUp?.(event);
    if (event.key !== " ") return;
    const pressed = spaceDown.current;
    spaceDown.current = false;
    if (pressed && active && !event.defaultPrevented && event.target === event.currentTarget) {
      event.currentTarget.click();
    }
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    onBlur?.(event);
    if (event.target === event.currentTarget) spaceDown.current = false;
  };
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    onPaste?.(event);
    if (active && !event.defaultPrevented && take(event.clipboardData.files)) {
      event.preventDefault();
    }
  };
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    (event.type === "dragenter" ? onDragEnter : onDragOver)?.(event);
    if (!active || event.defaultPrevented || !event.dataTransfer.types.includes("Files")) return;
    // Without this the browser refuses the drop.
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    onDragLeave?.(event);
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    onDrop?.(event);
    setDragOver(false);
    if (!active || event.defaultPrevented) return;
    event.preventDefault();
    take(event.dataTransfer.files);
  };
  const handleChoose = (event: ChangeEvent<HTMLInputElement>) => {
    // The dialog may close after the well was disabled.
    if (active) take(event.target.files);
    // So that choosing the same file again is a change.
    event.target.value = "";
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the element is a button whenever it acts on input (editable); otherwise its handlers only pass the event to the consumer's
    <div
      role={editable ? "button" : undefined}
      tabIndex={active ? 0 : undefined}
      aria-disabled={editable && disabled ? true : undefined}
      // The name of the button when the well shows no image to carry it.
      {...(editable && alt && !props["aria-labelledby"] ? { "aria-label": alt } : undefined)}
      data-frame={frame}
      data-scaling={scaling}
      data-editable={editable ? "" : undefined}
      data-empty={empty ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-drag-over={dragOver && active ? "" : undefined}
      {...props}
      className={cn("mac-image-well", className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={handleBlur}
      onPaste={handlePaste}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {hasImage ? (
        <img className="mac-image-well-image" src={src} alt={alt} draggable={false} />
      ) : (
        children
      )}
      {editable && (
        <input
          ref={input}
          type="file"
          hidden
          tabIndex={-1}
          accept={accept}
          disabled={disabled}
          // The click that opens the dialog is the well's own doing: it must not reach the
          // well's onClick, or anyone else's, as a second click.
          onClick={(event) => event.stopPropagation()}
          onChange={handleChoose}
        />
      )}
    </div>
  );
}
