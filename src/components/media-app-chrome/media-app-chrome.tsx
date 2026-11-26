"use client";

import { Slider as BaseSlider } from "@base-ui/react/slider";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import type { ComponentProps, CSSProperties, ReactNode, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./media-app-chrome.tokens.css";
import "./media-app-chrome.css";

export interface MediaAppChromeProps extends ComponentProps<"div"> {
  /**
   * Which app's colours and metrics are drawn. `"music"`: a playback bar with a vertical
   * gradient. `"podcasts"`: a flat bar, stronger glyphs and the volume group closer to the
   * display.
   * @default "music"
   */
  variant?: "music" | "podcasts";
  /**
   * Width of the sidebar column in points: 220 in Music, 260 in Podcasts. The divider is drawn
   * on the pane's side of it.
   * @default 220
   */
  sidebarWidth?: number;
}

/**
 * The window layout of Catalina's media players (Music, Podcasts): a full-height sidebar and,
 * beside it, a 55 pt playback bar over the content pane. Put it in a `Window`, with a
 * `MediaAppChromeSidebar`, a `MediaAppChromeBar` and a `MediaAppChromePane` as its children.
 */
export function MediaAppChrome({
  variant = "music",
  sidebarWidth = 220,
  className,
  style,
  ...props
}: MediaAppChromeProps) {
  return (
    <div
      data-variant={variant}
      className={cn("mac-media-app-chrome", className)}
      style={
        { "--mac-media-app-chrome-sidebar-width": `${sidebarWidth}px`, ...style } as CSSProperties
      }
      {...props}
    />
  );
}

export interface MediaAppChromeSidebarProps extends ComponentProps<"div"> {
  /** The window controls, placed 10 pt from the edge and centred on the playback bar. */
  controls?: ReactNode;
  /** The search field, placed under the window controls with 10 pt side insets. */
  search?: ReactNode;
  /**
   * The surface behind the controls and the search field: the vibrant sidebar material or the
   * same surface as captured over a neutral window. Give the `Sidebar` below the same value.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
}

/** The sidebar column: window controls and search field, then its children (a `Sidebar`). */
export function MediaAppChromeSidebar({
  controls,
  search,
  material = "translucent",
  className,
  children,
  ...props
}: MediaAppChromeSidebarProps) {
  return (
    <div className={cn("mac-media-app-chrome-sidebar", className)} {...props}>
      <div className="mac-media-app-chrome-header" data-material={material}>
        <div className="mac-media-app-chrome-window-controls">{controls}</div>
        {search}
      </div>
      {children}
    </div>
  );
}

export interface MediaAppChromeBarProps extends Omit<BaseToolbar.Root.Props, "ref"> {
  /** Ref to the rendered toolbar element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The playback bar, built on Base UI's Toolbar: a `MediaAppChromeTransport`, a
 * `MediaAppChromeDisplay` and a `MediaAppChromeControls` in three columns. Needs an `aria-label`.
 */
export function MediaAppChromeBar({ className, ...props }: MediaAppChromeBarProps) {
  return (
    <BaseToolbar.Root className={withClassName("mac-media-app-chrome-bar", className)} {...props} />
  );
}

export interface MediaAppChromeTransportProps extends ComponentProps<"div"> {}

/** The transport buttons, centred before the display: a group named "Playback". */
export function MediaAppChromeTransport({ className, ...props }: MediaAppChromeTransportProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; these are command buttons
    <div
      role="group"
      aria-label="Playback"
      className={cn("mac-media-app-chrome-transport", className)}
      {...props}
    />
  );
}

export interface MediaAppChromeDisplayProps extends ComponentProps<"div"> {}

/** The middle column of the bar: holds a `NowPlayingLcd`. */
export function MediaAppChromeDisplay({ className, ...props }: MediaAppChromeDisplayProps) {
  return <div className={cn("mac-media-app-chrome-display", className)} {...props} />;
}

export interface MediaAppChromeControlsProps extends ComponentProps<"div"> {}

/** The trailing column: a `MediaAppChromeVolume`, then buttons pinned to the edge. */
export function MediaAppChromeControls({ className, ...props }: MediaAppChromeControlsProps) {
  return <div className={cn("mac-media-app-chrome-controls", className)} {...props} />;
}

/* Original drawings in the measured glyph boxes. */
const LINE = { fill: "none", stroke: "currentColor" } as const;
const ROUND = { stroke: "currentColor", strokeLinejoin: "round" } as const;
const ARROW = (
  <>
    <path d="M9 3.15a8.1 8.1 0 1 1-6.2 2.9" strokeWidth="1.8" {...LINE} />
    <path d="M9.6 0v6.4l-5-3.2z" />
  </>
);
const GLYPHS = {
  previous: [20, 12, <path key="" d="M9.5 1v10L1 6zM19.5 1v10L11 6z" {...ROUND} />],
  next: [20, 12, <path key="" d="M.5 1 9 6 .5 11zM10.5 1 19 6l-8.5 5z" {...ROUND} />],
  // 4 pt into its box: optically centred.
  play: [22, 20, <path key="" d="M4.75 1 20.75 10l-16 9z" strokeWidth="1.5" {...ROUND} />],
  pause: [22, 20, <path key="" d="M4.5 1.5h4v17h-4zM13.5 1.5h4v17h-4z" {...ROUND} />],
  "skip-back": [18, 20, ARROW],
  "skip-forward": [
    18,
    20,
    <g key="" transform="matrix(-1 0 0 1 18 0)">
      {ARROW}
    </g>,
  ],
  output: [
    15,
    15,
    <>
      <circle cx="7.5" cy="12.5" r="2" />
      <path
        d="M3.9 9.3a5 5 0 1 1 7.2 0M1.6 11.4a7.3 7.3 0 1 1 11.8 0"
        strokeWidth="1.3"
        {...LINE}
      />
    </>,
  ],
  lyrics: [
    15,
    14,
    <>
      <path
        d="M2.6.6h9.8a2 2 0 0 1 2 2v5.8a2 2 0 0 1-2 2H7.6l-3 2.7v-2.7h-2a2 2 0 0 1-2-2V2.6a2 2 0 0 1 2-2z"
        strokeWidth="1.2"
        {...LINE}
      />
      <path d="M4.3 4.2h2.2v2.4H4.3zM8.5 4.2h2.2v2.4H8.5z" />
    </>,
  ],
  info: [
    14,
    14,
    <path
      key=""
      fillRule="evenodd"
      d="M7 0a7 7 0 1 1 0 14A7 7 0 0 1 7 0zm-.8 3v1.7h1.6V3zm0 3v5h1.6V6z"
    />,
  ],
  "up-next": [
    14,
    9.5,
    <path
      key=""
      d="M0 0h2v1.5H0zm3.5 0H14v1.5H3.5zM0 4h2v1.5H0zm3.5 0H14v1.5H3.5zM0 8h2v1.5H0zm3.5 0H14v1.5H3.5z"
    />,
  ],
  speaker: [
    13,
    12,
    <>
      <path d="M0 4h2.3L6 .6v10.8L2.3 8H0z" />
      <path
        d="M7.6 4a2.8 2.8 0 0 1 0 4M9.3 2.4a5 5 0 0 1 0 7.2M11 .8a7.3 7.3 0 0 1 0 10.4"
        strokeWidth=".9"
        {...LINE}
      />
    </>,
  ],
} as const;

function glyph(name: keyof typeof GLYPHS, seconds?: number) {
  const [width, height, drawing] = GLYPHS[name];
  return (
    <svg
      className="mac-media-app-chrome-glyph"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="currentColor"
      aria-hidden="true"
    >
      {drawing}
      {seconds === undefined ? null : (
        <text x="9" y="14.1" fontSize="7.8" fontWeight="700" textAnchor="middle">
          {seconds}
        </text>
      )}
    </svg>
  );
}

export interface MediaAppChromeButtonProps extends Omit<BaseToolbar.Button.Props, "ref"> {
  /**
   * One of the built-in glyphs, original drawings in the measured boxes: the transport set of
   * Music (`previous`, `play`, `pause`, `next`) and of Podcasts (`skip-back`, `skip-forward`),
   * `output` for the audio-output button after the volume slider, and `lyrics`, `info` and
   * `up-next` for the trailing buttons. Without it the button shows its children.
   */
  glyph?:
    | "previous"
    | "play"
    | "pause"
    | "next"
    | "skip-back"
    | "skip-forward"
    | "output"
    | "lyrics"
    | "info"
    | "up-next";
  /**
   * Number drawn inside a `skip-back` or `skip-forward` glyph, as Podcasts shows 15 and 30 once
   * an episode is loaded.
   */
  seconds?: number;
  /** Ref to the rendered button. */
  ref?: Ref<HTMLElement>;
}

/**
 * A borderless glyph button, for use in a `MediaAppChromeBar` only. Needs an `aria-label`;
 * pass `aria-pressed` for a toggle.
 */
export function MediaAppChromeButton({
  glyph: name,
  seconds,
  className,
  children,
  ...props
}: MediaAppChromeButtonProps) {
  return (
    <BaseToolbar.Button
      className={withClassName("mac-media-app-chrome-button", className)}
      {...(props as BaseToolbar.Button.Props)}
    >
      {name ? glyph(name, seconds) : children}
    </BaseToolbar.Button>
  );
}

export interface MediaAppChromeVolumeProps
  extends Omit<
    BaseSlider.Root.Props<number>,
    "ref" | "children" | "className" | "style" | "orientation" | "thumbAlignment"
  > {
  /**
   * Accessible name of the slider.
   * @default "Volume"
   */
  "aria-label"?: string;
  /** What follows the slider, 5 pt after it: the audio-output button. */
  children?: ReactNode;
  /** Class of the root element. */
  className?: string;
  /** Style of the root element. */
  style?: CSSProperties;
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The volume group: a speaker glyph, Base UI's Slider (it takes its props) and, as children,
 * the audio-output button.
 */
export function MediaAppChromeVolume({
  "aria-label": ariaLabel = "Volume",
  children,
  className,
  style,
  ref,
  ...props
}: MediaAppChromeVolumeProps) {
  return (
    <div ref={ref} className={cn("mac-media-app-chrome-volume", className)} style={style}>
      {glyph("speaker")}
      <BaseSlider.Root className="mac-media-app-chrome-slider" {...props}>
        <BaseSlider.Control className="mac-media-app-chrome-slider-control">
          <BaseSlider.Track className="mac-media-app-chrome-slider-track">
            <BaseSlider.Indicator className="mac-media-app-chrome-slider-level" />
            <BaseSlider.Thumb className="mac-media-app-chrome-slider-knob" aria-label={ariaLabel} />
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
      {children}
    </div>
  );
}

export interface MediaAppChromePaneProps extends ComponentProps<"div"> {}

/** The scrolling content pane under the bar. */
export function MediaAppChromePane({ className, ...props }: MediaAppChromePaneProps) {
  return <div className={cn("mac-media-app-chrome-pane", className)} {...props} />;
}
