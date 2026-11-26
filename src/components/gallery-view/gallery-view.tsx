"use client";

import {
  type ComponentProps,
  type CSSProperties,
  memo,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { cn } from "../../lib/cn";
import { isSystemArrow } from "../../lib/system-arrows";
import { type TypeSelectState, typeSelect } from "../../lib/type-select";
import { useControlled } from "../../lib/use-controlled";
import { useVirtualRange } from "../../lib/use-virtual-range";
import { ScrollView } from "../scroll-view";
import "./gallery-view.tokens.css";
import "./gallery-view.css";

export interface GalleryViewProps extends Omit<ComponentProps<"div">, "defaultValue"> {
  /** Number of items. */
  count: number;
  /**
   * Renders the large preview of the item at `index`. It is centred in the area above the
   * strip; give it `max-width: 100%` and `max-height: 100%` to fit that area. Give the
   * function a new identity when what it reads changes: the preview is rendered again only
   * when the selected index, its label or this function changes.
   */
  renderPreview: (index: number) => ReactNode;
  /**
   * Renders the thumbnail of the item at `index`, at most 48 x 48 pt: a picture, not a
   * control. Only the thumbnails in
   * view are rendered. Keep the function's identity stable (`useCallback`) so that a
   * selection change re-renders only the thumbnails it touches, and give it a new identity
   * when what it reads changes: a thumbnail is rendered again only when its index, label,
   * selection, the number of items or this function changes.
   */
  renderThumbnail: (index: number) => ReactNode;
  /**
   * The name of the item at `index`: the accessible name of its thumbnail and of the
   * preview, and what type-select matches.
   */
  getItemLabel: (index: number) => string;
  /**
   * The id of the item at `index`, which is what the selection holds.
   * @default the index itself
   */
  getItemId?: (index: number) => string | number;
  /** Id of the selected item, in an array of one (empty for none). Controlled. */
  value?: (string | number)[];
  /** The selection at first, when the view keeps its own. */
  defaultValue?: (string | number)[];
  /** Called with the new selection, an array of one id, when another item is selected. */
  onValueChange?: (value: (string | number)[]) => void;
  /** Called with the item's index on a double click, and on Return for the selected item. */
  onItemAction?: (index: number) => void;
  /**
   * Content of the pane beside the gallery (Finder's Preview pane with the file's details
   * and Quick Actions): 250 pt wide after a 1 pt divider. Without it there is no pane.
   */
  inspector?: ReactNode;
  /**
   * Side of a thumbnail's square in points; the strip grows with it.
   * @default 54
   */
  thumbnailSize?: number;
}

// Between thumbnails and under them, and the strip's inset before the first, in points.
const GAP = 8;
const INSET = 8;
const byIndex = (index: number): string | number => index;

// One thumbnail. Memoised, so a selection change re-renders only the two it touches.
const Item = memo(function Item(props: {
  id: string;
  index: number;
  count: number;
  selected: boolean;
  label: string;
  render: (index: number) => ReactNode;
  itemId: string | number;
}) {
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the listbox keeps focus and names the current option with aria-activedescendant
    <div
      role="option"
      id={props.id}
      aria-label={props.label}
      aria-selected={props.selected}
      aria-setsize={props.count}
      aria-posinset={props.index + 1}
      data-index={props.index}
      data-item-id={props.itemId}
      className="mac-gallery-view-item"
    >
      {props.render(props.index)}
    </div>
  );
});

// The preview. Memoised, so scrolling the strip does not render it again.
const Stage = memo(function Stage(props: {
  id: string;
  index: number;
  label: string | undefined;
  render: (index: number) => ReactNode;
}) {
  return (
    <figure id={props.id} aria-label={props.label} className="mac-gallery-view-stage">
      {props.index >= 0 && props.render(props.index)}
    </figure>
  );
});

/**
 * A gallery view (Finder's): a large preview of the selected item above a horizontally
 * scrolling strip of thumbnails, of which only those in view are rendered. The root is a
 * `group` and the strip its `listbox`; both take `aria-label`. Other props, `ref` included,
 * go to the root element.
 */
export function GalleryView({
  count,
  renderPreview,
  renderThumbnail,
  getItemLabel,
  getItemId = byIndex,
  value: controlled,
  defaultValue,
  onValueChange,
  onItemAction,
  inspector,
  thumbnailSize = 54,
  className,
  style,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...props
}: GalleryViewProps) {
  const [value, setValue] = useControlled(controlled, defaultValue ?? [], onValueChange);
  const typed = useRef<TypeSelectState>({ text: "", time: 0 });
  const id = useId();
  const pitch = thumbnailSize + GAP;
  const [start, end, viewport, onScroll] = useVirtualRange(count, pitch, {
    horizontal: true,
    offset: INSET,
  });
  const selected = value[0];
  // Looked up on every render: the items can be reordered behind the same `getItemId`.
  let index = -1;
  if (selected !== undefined)
    for (let at = 0; index < 0 && at < count; at++) if (getItemId(at) === selected) index = at;

  // Keep the selected thumbnail in view and rendered: the strip can name only a rendered
  // one. When the selection changes, and when the keyboard focus arrives.
  const show = () => {
    const view = document.getElementById(id);
    if (!view || index < 0) return;
    const sign = getComputedStyle(view).direction === "rtl" ? -1 : 1;
    const now = Math.abs(view.scrollLeft);
    const left = index * pitch;
    const next = Math.min(left, Math.max(now, left + pitch + INSET - view.clientWidth));
    if (next !== now) view.scrollLeft = sign * next;
    onScroll();
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the selected item changes
  useEffect(show, [id, index]);

  // The index of the thumbnail an event happened on, in this view's strip; -1 for none. A
  // press or a double click on a control inside a thumbnail, on its label or in editable
  // text is its own. Content marked contenteditable="false" is the thumbnail's.
  const itemOf = (target: EventTarget) => {
    const element = target as HTMLElement;
    return element.closest('[role="listbox"]')?.id === id &&
      !element.closest(
        "button,input,select,textarea,a,label,[contenteditable]:not([contenteditable=false])",
      )
      ? Number(element.closest<HTMLElement>("[data-index]")?.dataset.index ?? -1)
      : -1;
  };

  const items: ReactNode[] = [];
  for (let at = start; at < end; at++) {
    const key = getItemId(at);
    items.push(
      <Item
        // Ids are told apart by type too, as the selection does: 1 is not "1".
        key={typeof key + key}
        id={`${id}-${at}`}
        index={at}
        itemId={key}
        count={count}
        selected={at === index}
        label={getItemLabel(at)}
        render={renderThumbnail}
      />,
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: the group names a preview and a listbox; a fieldset is for form controls
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      {...props}
      style={{ ...style, "--_thumbnail": `${thumbnailSize}px` } as CSSProperties}
      className={cn("mac-gallery-view", className)}
      onMouseDown={(event) => {
        props.onMouseDown?.(event);
        const at = itemOf(event.target);
        if (at >= 0 && !event.button && !event.defaultPrevented) setValue([getItemId(at)]);
      }}
      onDoubleClick={(event) => {
        props.onDoubleClick?.(event);
        const at = itemOf(event.target);
        if (at >= 0 && !event.defaultPrevented) onItemAction?.(at);
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        const target = event.target as HTMLElement;
        if (target.id !== id || event.defaultPrevented || !count || isSystemArrow(event)) return;
        // The next thumbnail is to the right, or to the left when the strip runs leftwards.
        const forward = getComputedStyle(target).direction === "rtl" ? -1 : 1;
        const steps: Record<string, number> = {
          ArrowRight: forward,
          ArrowLeft: -forward,
          Home: -count,
          End: count,
        };
        const step = steps[event.key];
        let next = -1;
        if (step) next = Math.max(0, Math.min(count - 1, index + step));
        else if (event.key === "Enter") {
          if (index >= 0 && onItemAction) {
            onItemAction(index);
            event.preventDefault();
          }
        } else next = typeSelect(typed.current, event, count, getItemLabel, index);
        if (next < 0) return;
        event.preventDefault();
        setValue([getItemId(next)]);
      }}
    >
      <div className="mac-gallery-view-main">
        <Stage
          id={`${id}p`}
          index={index}
          label={index < 0 ? undefined : getItemLabel(index)}
          render={renderPreview}
        />
        <ScrollView
          axis="horizontal"
          className="mac-gallery-view-strip"
          viewportProps={{
            ref: viewport,
            onScroll,
            onFocus: (event) => event.currentTarget.matches(":focus-visible") && show(),
            id,
            role: "listbox",
            tabIndex: 0,
            "aria-orientation": "horizontal",
            "aria-label": label,
            "aria-labelledby": labelledBy,
            "aria-controls": `${id}p`,
            "aria-activedescendant": index >= start && index < end ? `${id}-${index}` : undefined,
            className: "mac-gallery-view-list",
          }}
        >
          <div
            className="mac-gallery-view-items"
            style={{ width: count * pitch + INSET, paddingInlineStart: INSET + start * pitch }}
          >
            {items}
          </div>
        </ScrollView>
      </div>
      {inspector != null && <div className="mac-gallery-view-inspector">{inspector}</div>}
    </div>
  );
}
