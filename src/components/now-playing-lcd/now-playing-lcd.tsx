"use client";

import { Progress as BaseProgress } from "@base-ui/react/progress";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import "./now-playing-lcd.tokens.css";
import "./now-playing-lcd.css";

export interface NowPlayingLcdProps extends Omit<ComponentProps<"div">, "title"> {
  /**
   * Title of the item that is loaded, on the first line. Without a title the display is idle
   * and shows its children instead of the two lines and the progress line.
   */
  title?: ReactNode;
  /**
   * Second line: artist and album in a music player (`Artist — Album`), show and date in a
   * podcast player.
   */
  subtitle?: ReactNode;
  /**
   * Artwork of the loaded item, usually an `<img>` with an `alt`. It fills the 44 pt well at
   * the leading end. Without it the well shows the placeholder.
   */
  artwork?: ReactNode;
  /**
   * Glyph shown in the empty artwork well, drawn in `currentColor`. The default is a pair of
   * beamed notes.
   * @default a pair of beamed notes
   */
  placeholder?: ReactNode;
  /**
   * Which app's panel is drawn. `"music"`: a border that is darker along the bottom and, in
   * Dark Aqua, a gradient body. `"podcasts"`: one flat border colour, a flat body and a
   * divider after the artwork well.
   * @default "music"
   */
  variant?: "music" | "podcasts";
  /**
   * Playback position in seconds.
   * @default 0
   */
  elapsed?: number;
  /**
   * Length of the loaded item in seconds. The progress line and the time labels are only
   * rendered when it is a finite number greater than zero and a title is set, so a live stream
   * (`Infinity`) or an unknown length (`NaN`) shows the two lines of text alone.
   */
  duration?: number;
  /**
   * Called with the new position in seconds while the progress line is dragged or moved with
   * the arrow keys. Setting it turns the progress line into a slider; without it the line is
   * a progress bar that cannot be operated.
   */
  onSeek?: (seconds: number) => void;
  /** Called with the final position in seconds when a drag or a key press ends. */
  onSeekCommitted?: (seconds: number) => void;
  /**
   * Accessible name of the progress line.
   * @default "Playback position"
   */
  seekLabel?: string;
}

/** Seconds as `m:ss`, or `h:mm:ss` from an hour on. */
function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

const NOTES = (
  <svg viewBox="0 0 20 26" width="19.5" height="26" fill="currentColor" aria-hidden="true">
    <path d="M6.5 4.4 19.5 1.5v18.2a4 3.3 0 1 1-1.8-2.7V7.2L8.3 9.3v12.9a4 3.3 0 1 1-1.8-2.7z" />
  </svg>
);

/**
 * The now-playing display of a media player's playback bar (the "LCD" of Music and Podcasts):
 * an artwork well, then either an idle mark or the title and subtitle of the loaded item over
 * a thin progress line.
 *
 * The root is a `group` named "Now Playing" (override it with `aria-label`). Its children are
 * the idle content, centred in the body; pass your own mark. The progress line is Base UI's
 * Slider when `onSeek` is set and its Progress otherwise. The display is as wide as its
 * container and 45 pt tall.
 */
export function NowPlayingLcd({
  title,
  subtitle,
  artwork,
  placeholder = NOTES,
  variant = "music",
  elapsed = 0,
  duration,
  onSeek,
  onSeekCommitted,
  seekLabel = "Playback position",
  className,
  children,
  ...props
}: NowPlayingLcdProps) {
  const playing = title != null && title !== false;
  const length = playing && duration !== undefined && Number.isFinite(duration) ? duration : 0;
  const at = Math.min(length, Math.max(0, Number.isFinite(elapsed) ? elapsed : 0));
  const valueText = `${clock(at)} of ${clock(length)}`;
  const hasArtwork = artwork != null && artwork !== false;

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this groups a readout
    <div
      role="group"
      aria-label="Now Playing"
      data-variant={variant}
      data-state={playing ? "playing" : "idle"}
      className={cn("mac-now-playing-lcd", className)}
      {...props}
    >
      <div className="mac-now-playing-lcd-artwork" data-empty={hasArtwork ? undefined : ""}>
        {hasArtwork ? artwork : placeholder}
      </div>
      <div className="mac-now-playing-lcd-body">
        {playing ? (
          <>
            <div className="mac-now-playing-lcd-title">{title}</div>
            <div className="mac-now-playing-lcd-subtitle">{subtitle}</div>
          </>
        ) : (
          <div className="mac-now-playing-lcd-idle">{children}</div>
        )}
        {length > 0 ? (
          <>
            <span className="mac-now-playing-lcd-time" aria-hidden="true">
              {clock(at)}
            </span>
            <span className="mac-now-playing-lcd-time" data-remaining="" aria-hidden="true">
              -{clock(length - at)}
            </span>
            {onSeek ? (
              <BaseSlider.Root
                className="mac-now-playing-lcd-progress"
                value={at}
                min={0}
                max={length}
                step={1}
                largeStep={15}
                onValueChange={(value) => onSeek(value)}
                onValueCommitted={(value) => onSeekCommitted?.(value)}
              >
                <BaseSlider.Control className="mac-now-playing-lcd-control">
                  <BaseSlider.Track className="mac-now-playing-lcd-track">
                    <BaseSlider.Indicator className="mac-now-playing-lcd-elapsed" />
                    <BaseSlider.Thumb
                      className="mac-now-playing-lcd-knob"
                      aria-label={seekLabel}
                      aria-valuetext={valueText}
                    />
                  </BaseSlider.Track>
                </BaseSlider.Control>
              </BaseSlider.Root>
            ) : (
              <BaseProgress.Root
                className="mac-now-playing-lcd-progress"
                value={at}
                min={0}
                max={length}
                aria-label={seekLabel}
                aria-valuetext={valueText}
              >
                <BaseProgress.Track className="mac-now-playing-lcd-track">
                  <BaseProgress.Indicator className="mac-now-playing-lcd-elapsed" />
                </BaseProgress.Track>
              </BaseProgress.Root>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
