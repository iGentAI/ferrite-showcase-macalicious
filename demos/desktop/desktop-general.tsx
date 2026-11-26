"use client";

import { ColorSwatch, ColorSwatchPicker, ThumbnailSwatch } from "macalicious/color-swatch-picker";
import { Label } from "macalicious/label";
import { ACCENTS, type Accent, type Appearance } from "macalicious/lib/appearance";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { createContext, use, useId } from "react";
import type { DesktopApp } from "./desktop-apps";

/** The settings of the desktop that its General preferences change. */
export interface DesktopSettings {
  /** Aqua, Dark Aqua, or the operating system's choice. */
  appearance: Appearance;
  /** The accent colour. */
  accent: Accent;
  /** Switch the appearance of the page. */
  setAppearance: (appearance: Appearance) => void;
  /** Switch the accent colour of the page. */
  setAccent: (accent: Accent) => void;
}

/** The desktop's settings, for the windows on it. `null` outside a desktop. */
export const DesktopSettingsContext = createContext<DesktopSettings | null>(null);

const APPEARANCES: readonly Appearance[] = ["light", "dark", "auto"];

const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** A drawing of a window in an appearance, for its thumbnail: original, not Apple's picture. */
function AppearancePicture({ appearance }: { appearance: Appearance }) {
  const light = { paper: "#f5f5f5", bar: "#d8d8d8", ink: "#b9b9b9" };
  const dark = { paper: "#2b2b2d", bar: "#3d3d40", ink: "#6a6a6e" };
  const left = appearance === "dark" ? dark : light;
  const right = appearance === "light" ? light : dark;
  return (
    <svg viewBox="0 0 67 44" width="67" height="44" aria-hidden="true">
      <rect width="34" height="44" fill={left.paper} />
      <rect x="33.5" width="33.5" height="44" fill={right.paper} />
      <rect width="34" height="9" fill={left.bar} />
      <rect x="33.5" width="33.5" height="9" fill={right.bar} />
      <rect x="7" y="16" width="22" height="4" rx="2" fill={left.ink} />
      <rect x="7" y="25" width="16" height="4" rx="2" fill={left.ink} />
      <rect x="38" y="16" width="22" height="4" rx="2" fill={right.ink} />
      <rect x="38" y="25" width="16" height="4" rx="2" fill={right.ink} />
    </svg>
  );
}

/**
 * The General preferences of this desktop, as one window: the appearance and the accent
 * colour, which apply to the whole page. Its root is the library's `Window`, and it takes the
 * props a managed window's `render` form supplies, like the demo applications.
 */
export function GeneralPreferences({
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  ...windowProps
}: ManagedWindowRenderProps) {
  const settings = use(DesktopSettingsContext);
  const id = useId();
  return (
    <Window {...windowProps}>
      <TitleBar
        title="General"
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody className="mac-desktop-shell-general">
        <div className="mac-desktop-shell-row">
          <Label id={`${id}-appearance`}>Appearance:</Label>
          <ColorSwatchPicker
            aria-labelledby={`${id}-appearance`}
            value={settings?.appearance ?? "auto"}
            onValueChange={(value) => settings?.setAppearance(value as Appearance)}
          >
            {APPEARANCES.map((appearance) => (
              <ThumbnailSwatch key={appearance} value={appearance} label={capitalized(appearance)}>
                <AppearancePicture appearance={appearance} />
              </ThumbnailSwatch>
            ))}
          </ColorSwatchPicker>
        </div>
        <div className="mac-desktop-shell-row">
          <Label id={`${id}-accent`}>Accent color:</Label>
          <ColorSwatchPicker
            aria-labelledby={`${id}-accent`}
            value={settings?.accent ?? "blue"}
            onValueChange={(value) => settings?.setAccent(value as Accent)}
          >
            {ACCENTS.map((accent) => (
              <ColorSwatch key={accent} value={accent} aria-label={capitalized(accent)} />
            ))}
          </ColorSwatchPicker>
        </div>
      </WindowBody>
    </Window>
  );
}

/**
 * The desktop's own System Preferences: the General pane alone. It is hosted like a demo
 * application, and gives way to a System Preferences demo when `demos/` has one.
 */
export const generalApp: DesktopApp = {
  id: "system-preferences",
  name: "System Preferences",
  component: GeneralPreferences,
  defaultSize: { width: 500, height: 230 },
  resizable: false,
  menus: ["System Preferences", "Edit", "View", "Window", "Help"],
};
