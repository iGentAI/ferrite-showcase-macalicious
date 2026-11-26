"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import {
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "../../lib/cn";
import {
  ColorContext,
  type ColorState,
  hexToHsva,
  hsvaToHex,
  useColorState,
} from "../../lib/color-value";
import { useControlled } from "../../lib/use-controlled";
import { APPLE_COLORS, ColorPalette, CRAYON_COLORS } from "../color-palette";
import { ColorSliders, ColorSlidersChannel } from "../color-sliders";
import { ColorWell, type ColorWellProps } from "../color-well";
import { ColorSpectrum, ColorWheel } from "../color-wheel";
import { TitleBar } from "../title-bar";
import { Window, WindowBody, type WindowProps } from "../window";
import { WindowControls } from "../window-controls";
import "./color-panel.tokens.css";
import "./color-panel.css";

/** The pickers of the panel's toolbar, in its order. */
export type ColorPanelMode = "wheel" | "sliders" | "palettes" | "image" | "pencils";

/* The toolbar: mode, name, and a glyph drawn for this library on a 16 pt grid, stroked. */
const MODES: [ColorPanelMode, string, string][] = [
  [
    "wheel",
    "Color Wheel",
    "M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zm0 0v13M2.4 4.75l11.2 6.5m-11.2 0l11.2-6.5",
  ],
  ["sliders", "Color Sliders", "M1.5 4h13m-13 4h13m-13 4h13M5 2.5v3m6 1v3m-4 1v3"],
  ["palettes", "Color Palettes", "M2 2.5h12v11H2zm0 3.7h12m-12 3.6h12M6 2.5v11m4-11v11"],
  ["image", "Image Palettes", "M1.5 3h13v10h-13zm0 8l3.5-3.5 3 3 2-2 3.5 3.5"],
  ["pencils", "Pencils", "M2.5 13.5l.9-3.4 7.2-7.2 2.5 2.5-7.2 7.2zm6.9-9.4l2.5 2.5"],
];

const EYEDROPPER = "M9.5 3.5l3 3M10.2 5.8l-6 6-1.9.6.6-1.9 6-6m1-2.7l1.6-1.6 2.3 2.3-1.6 1.6";

interface EyeDropperWindow {
  EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
}

/* Whether the browser can pick a colour from the screen: never while rendering on the server. */
const subscribe = () => () => {};
const canSample = () => "EyeDropper" in window;
const cannotSample = () => false;

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" />
    </svg>
  );
}

export interface ColorPanelProps
  extends Omit<WindowProps, "defaultValue" | "onChange" | "variant" | "fullScreen" | "title"> {
  /** The colour, when controlled, as `#rrggbb` or `#rrggbbaa`. Use it with `onValueChange`. */
  value?: string;
  /**
   * The colour the panel starts with, when uncontrolled.
   * @default "#000000"
   */
  defaultValue?: string;
  /**
   * Called with the new colour as lower-case `#rrggbb`, or `#rrggbbaa` when it is not opaque
   * (only with `showsAlpha`). Like a continuous NSColorPanel, it is called while a slider or
   * the wheel's marker is dragged.
   */
  onValueChange?: (value: string) => void;
  /** The picker shown, when controlled. Use it with `onModeChange`. */
  mode?: ColorPanelMode;
  /**
   * The picker shown at first, when uncontrolled.
   * @default "wheel"
   */
  defaultMode?: ColorPanelMode;
  /** Called with the picker the user chose in the toolbar. */
  onModeChange?: (mode: ColorPanelMode) => void;
  /**
   * Whether the panel has the opacity slider (NSColorPanel.showsAlpha). Without it every
   * colour the panel reports is opaque.
   * @default false
   */
  showsAlpha?: boolean;
  /**
   * The panel's title.
   * @default "Colors"
   */
  title?: ReactNode;
  /**
   * The window controls. Pass `null` for none.
   * @default the usual three; the close button calls `onClose`
   */
  controls?: ReactNode;
  /** Called when the close button is activated. */
  onClose?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Frame width: a number of points or any CSS length.
   * @default 228
   */
  width?: number | string;
}

/**
 * The Colors panel (NSColorPanel): a utility window with a toolbar of five pickers (colour
 * wheel, sliders, palettes, image palettes and pencils), an optional opacity slider, and at
 * the bottom the current colour and an eyedropper that picks a colour from the screen where
 * the browser can.
 *
 * It is a `Window` and takes its props; it holds one colour, `value` or `defaultValue`, and
 * reports every change with `onValueChange`. The toolbar is a tab list built on Base UI's
 * Tabs. Place it yourself, or let a `ColorPanelWell` open it under a colour well.
 */
export function ColorPanel({
  value,
  defaultValue = "#000000",
  onValueChange,
  mode,
  defaultMode = "wheel",
  onModeChange,
  showsAlpha = false,
  title = "Colors",
  onClose,
  // Only `undefined` takes the usual three; `null` is no controls.
  controls = (
    <WindowControls
      onClose={onClose}
      minimizeDisabled
      zoomDisabled
      title="A panel closes; it does not minimize or go full screen"
    />
  ),
  width = 228,
  className,
  "aria-labelledby": labelledBy,
  ...props
}: ColorPanelProps) {
  const [[h, s, v, a], setColor] = useColorState(value, defaultValue, onValueChange);
  const [shown, setShown] = useControlled(mode, defaultMode, onModeChange);
  const sampling = useSyncExternalStore(subscribe, canSample, cannotSample);
  const alpha = showsAlpha ? a : 1;
  const hex = hsvaToHex([h, s, v, 1]);
  // The picker shown edits the panel's colour itself, hue and all; the opacity is the
  // panel's own. Only the picker reads this, and it renders whenever the panel does.
  const shared: ColorState = [
    [h, s, v, alpha],
    (next) => setColor([next[0], next[1], next[2], alpha]),
  ];
  // A palette and the eyedropper give a colour by its hex value.
  const pick = (next: string) => shared[1](hexToHsva(next));
  const pencils = shown === "pencils";
  return (
    <BaseTabs.Root
      value={shown}
      onValueChange={setShown}
      render={
        <Window
          variant="panel"
          width={width}
          className={cn("mac-color-panel", className)}
          // A popup that renders the panel passes the key without a value, which would take
          // the window's own name, its title, away.
          {...(labelledBy ? { "aria-labelledby": labelledBy } : null)}
          {...props}
        />
      }
    >
      <TitleBar variant="unified" title={title} controls={controls}>
        <BaseTabs.List aria-label="Color pickers" className="mac-color-panel-modes">
          {MODES.map(([id, name, glyph]) => (
            <BaseTabs.Tab
              key={id}
              value={id}
              aria-label={name}
              title={name}
              className="mac-color-panel-mode"
            >
              <Glyph d={glyph} />
            </BaseTabs.Tab>
          ))}
        </BaseTabs.List>
      </TitleBar>
      <WindowBody className="mac-color-panel-body">
        <BaseTabs.Panel value={shown} className="mac-color-panel-picker">
          <ColorContext value={shared}>
            {shown === "wheel" ? (
              <ColorWheel />
            ) : shown === "image" ? (
              <ColorSpectrum />
            ) : shown === "sliders" ? (
              <ColorSliders />
            ) : (
              <ColorPalette
                aria-label={pencils ? "Pencils" : "Apple"}
                variant={pencils ? "pencils" : "list"}
                colors={pencils ? CRAYON_COLORS : APPLE_COLORS}
                value={hex}
                onValueChange={pick}
              />
            )}
          </ColorContext>
        </BaseTabs.Panel>
        {showsAlpha && (
          <ColorSlidersChannel
            name="Opacity"
            max={100}
            value={a * 100}
            onValueChange={(n) => setColor([h, s, v, n / 100])}
          />
        )}
        <div className="mac-color-panel-footer">
          <button
            type="button"
            className="mac-color-panel-eyedropper"
            aria-label="Pick a color from the screen"
            disabled={!sampling}
            // Enabled only where the browser has an EyeDropper. Leaving its picker with Escape
            // rejects: the colour stays.
            onClick={() =>
              new (window as EyeDropperWindow as Required<EyeDropperWindow>).EyeDropper()
                .open()
                .then((result) => pick(result.sRGBHex), subscribe)
            }
          >
            <Glyph d={EYEDROPPER} />
          </button>
          <span
            role="img"
            aria-label={`Current color ${hex}${alpha < 1 ? `, opacity ${Math.round(alpha * 100)}%` : ""}`}
            className="mac-color-panel-swatch"
            style={{ color: hsvaToHex([h, s, v, alpha]) }}
          />
        </div>
        {!sampling && (
          <p className="mac-color-panel-eyedropper-reason">
            This browser cannot pick from the screen.
          </p>
        )}
      </WindowBody>
    </BaseTabs.Root>
  );
}

export interface ColorPanelWellProps
  extends Omit<ColorWellProps, "value" | "defaultValue" | "onValueChange" | "active"> {
  /** The colour, when controlled, as `#rrggbb` or `#rrggbbaa`. Use it with `onValueChange`. */
  value?: string;
  /**
   * The colour the well starts with, when uncontrolled.
   * @default "#000000"
   */
  defaultValue?: string;
  /** Called with the new colour whenever the panel changes it. */
  onValueChange?: (value: string) => void;
  /** Props for the panel the well opens, such as `showsAlpha` or `defaultMode`. */
  panel?: Omit<ColorPanelProps, "value" | "defaultValue" | "onValueChange" | "onClose">;
  /**
   * Element the panel is rendered into.
   * @default document.body
   */
  container?: BasePopover.Portal.Props["container"];
}

/**
 * A colour well that opens the Colors panel under itself, in place of the browser's colour
 * chooser: a `ColorWell` and a `ColorPanel` joined by Base UI's Popover. A click on the well,
 * Return or Space opens the panel and closes it again; the well is drawn active while its
 * panel is open. A click outside the panel, Escape or the panel's close button also closes it
 * and returns the focus to the well.
 *
 * It takes the props of `ColorWell`, which needs an accessible name. The well shows the colour
 * without its opacity.
 */
export function ColorPanelWell({
  value,
  defaultValue = "#000000",
  onValueChange,
  panel,
  container,
  onClick,
  onKeyDown,
  ...props
}: ColorPanelWellProps) {
  const [color, setColor] = useControlled(value, defaultValue, onValueChange);
  const [open, setOpen] = useState(false);
  // The well's element, kept from the event that opened the panel.
  const well = useRef<HTMLElement | null>(null);
  // Cancelling the event keeps the browser's own chooser closed. A handler of the consumer's
  // that cancels it first keeps the panel closed too.
  const toggle = (event: SyntheticEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    well.current = event.currentTarget;
    setOpen(!open);
  };
  return (
    <BasePopover.Root
      open={open}
      onOpenChange={(next, { event }) => {
        // A press on the well, or the focus going to it, is the well's own business: its
        // click closes the panel, and closing it here as well would open it again. Escape
        // closes it wherever the focus is.
        const from = event as Event & { relatedTarget?: EventTarget | null };
        if (
          next ||
          from?.type === "keydown" ||
          (from?.target !== well.current && from?.relatedTarget !== well.current)
        )
          setOpen(next);
      }}
    >
      <ColorWell
        {...props}
        readOnly
        value={color.slice(0, 7)}
        active={open}
        // No aria-expanded: a colour input has no role that takes it, and the accessibility
        // checks reject it there.
        aria-haspopup="dialog"
        onClick={(event) => {
          onClick?.(event);
          toggle(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "Enter" || event.key === " ") {
            // One press, one toggle: a key that is held down repeats.
            if (event.repeat) event.preventDefault();
            else toggle(event);
          }
        }}
      />
      <BasePopover.Portal container={container}>
        <BasePopover.Positioner
          anchor={well}
          side="bottom"
          align="start"
          sideOffset={6}
          className="mac-color-panel-positioner"
        >
          <BasePopover.Popup
            finalFocus={well}
            render={
              <ColorPanel
                {...panel}
                value={color}
                onValueChange={setColor}
                onClose={() => setOpen(false)}
              />
            }
          />
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
