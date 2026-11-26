import { ScrollArea } from "@base-ui/react/scroll-area";
import type { CSSProperties } from "react";
import { cn, withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./scroll-view.tokens.css";
import "./scroll-view.css";

export interface ScrollViewProps extends ScrollArea.Root.Props {
  /**
   * `"overlay"` scroll bars float over the content, take no space and show only while
   * scrolling. `"legacy"` scroll bars are always visible beside the content, as with
   * "Show scroll bars: Always" in General preferences (NSScroller.Style).
   * @default "overlay"
   */
  scrollerStyle?: "overlay" | "legacy";
  /**
   * Knob colour of overlay scroll bars: `"dark"` for light content, `"light"` for dark
   * content, `"default"` to follow the appearance (NSScrollView.scrollerKnobStyle).
   * @default "default"
   */
  knobStyle?: "default" | "dark" | "light";
  /**
   * Scroll bar size: a 15 pt track at `"regular"`, 11 pt at `"small"` and `"mini"`.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Which way the content scrolls.
   * @default "vertical"
   */
  axis?: "vertical" | "horizontal" | "both";
  /**
   * Props for the scrolling element (the viewport), which holds the children: `ref`,
   * `onScroll`, `tabIndex`, `aria-*`. Read `scrollTop` from it and scroll with it.
   */
  viewportProps?: Omit<ScrollArea.Viewport.Props, "className" | "style" | "children"> & {
    className?: string;
    style?: CSSProperties;
  };
}

/**
 * A scroll view (NSScrollView): native scrolling with Catalina's scroll bars, on Base UI's
 * Scroll Area. The root is sized by the caller (`style`, `className`); the children are
 * rendered inside the viewport. Root props, `ref` included, go to the root element.
 */
export function ScrollView({
  scrollerStyle = "overlay",
  knobStyle = "default",
  size = "regular",
  axis = "vertical",
  viewportProps,
  className,
  children,
  ...props
}: ScrollViewProps) {
  // The other axis is clipped. Base UI sets `overflow: scroll` inline; this replaces it.
  const overflow =
    axis === "both" ? "scroll" : axis === "vertical" ? "hidden scroll" : "scroll hidden";
  return (
    <ScrollArea.Root
      data-scroller-style={scrollerStyle}
      data-knob-style={knobStyle}
      data-size={size}
      className={withClassName("mac-scroll-view", className)}
      {...props}
    >
      <ScrollArea.Viewport
        {...viewportProps}
        className={cn("mac-scroll-view-viewport", viewportProps?.className)}
        style={{ overflow, ...viewportProps?.style }}
      >
        {children}
      </ScrollArea.Viewport>
      {axis !== "horizontal" && (
        <ScrollArea.Scrollbar className="mac-scroll-view-scroller">
          <ScrollArea.Thumb className="mac-scroll-view-knob" />
        </ScrollArea.Scrollbar>
      )}
      {axis !== "vertical" && (
        <ScrollArea.Scrollbar orientation="horizontal" className="mac-scroll-view-scroller">
          <ScrollArea.Thumb className="mac-scroll-view-knob" />
        </ScrollArea.Scrollbar>
      )}
      {axis === "both" && <ScrollArea.Corner className="mac-scroll-view-corner" />}
    </ScrollArea.Root>
  );
}
