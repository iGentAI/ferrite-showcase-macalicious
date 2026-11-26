"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type ComponentProps, type CSSProperties, type ReactNode, useId } from "react";
import { cn } from "../../lib/cn";
import "./siri.tokens.css";
import "./siri.css";

/** One bar of the waveform: its share of the level, and where in the cycle it starts. */
const bar = (shape: number, delay: number) => (
  <span
    className="mac-siri-wave-bar"
    style={{ "--_shape": shape, animationDelay: `${delay}s` } as CSSProperties}
  />
);

export interface SiriProps extends ComponentProps<"div"> {
  /**
   * Text at the top of the window: the request as it was understood, or Siri's own prompt
   * ("What can I help you with?").
   */
  prompt?: ReactNode;
  /**
   * Whether Siri is listening. The orb at the bottom gives way to a waveform and its button
   * is announced as pressed.
   * @default false
   */
  listening?: boolean;
  /**
   * Input level from 0 to 1 while listening: the height of the waveform. Values outside the
   * range are clamped.
   * @default 0.5
   */
  level?: number;
  /**
   * Whether the waveform moves by itself while listening. Turn it off to draw each bar at
   * exactly the height `level` gives it, when the application supplies a live level.
   * @default true
   */
  animated?: boolean;
  /** Called by the orb, to start or stop listening. */
  onListen?: () => void;
  /** Called by the close button, and by Escape while the keyboard focus is in the window. */
  onClose?: () => void;
  /** Called by the help button. Without it there is no help button. */
  onHelp?: () => void;
  /**
   * Accessible name of the close button.
   * @default "Close"
   */
  closeLabel?: string;
  /**
   * Accessible name of the help button.
   * @default "Help"
   */
  helpLabel?: string;
  /**
   * Accessible name of the orb's button.
   * @default "Listen"
   */
  listenLabel?: string;
  /**
   * Accessible name of the scrolling region that holds the prompt and the results.
   * @default "Results"
   */
  resultsLabel?: string;
}

/**
 * The Siri window: a dark translucent panel with a close button in its top strip, the request
 * and its results in a scrolling region, and the orb in its bottom strip.
 *
 * It is no assistant: the prompt, the results (the children, normally `SiriCard`s) and the
 * level arrive through props. The root is a `dialog` named "Siri" (set `aria-label` to change
 * the name); `className`, `style`, `ref` and other attributes go to it. The results are a
 * polite live region, so a new answer is announced. The buttons are Base UI's Button.
 */
export function Siri({
  prompt,
  listening = false,
  level = 0.5,
  animated = true,
  onListen,
  onClose,
  onHelp,
  closeLabel = "Close",
  helpLabel = "Help",
  listenLabel = "Listen",
  resultsLabel = "Results",
  className,
  children,
  onKeyDown,
  "aria-label": ariaLabel,
  ...props
}: SiriProps) {
  return (
    <div
      role="dialog"
      aria-label={ariaLabel ?? (props["aria-labelledby"] ? undefined : "Siri")}
      data-listening={listening ? "" : undefined}
      className={cn("mac-siri", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Escape" && !event.defaultPrevented) onClose?.();
      }}
      {...props}
    >
      <BaseButton aria-label={closeLabel} className="mac-siri-close" onClick={onClose}>
        <svg className="mac-siri-close-glyph" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3.4 3.4l5.2 5.2m0-5.2L3.4 8.6" />
        </svg>
      </BaseButton>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and its own layout */}
      <div
        role="group"
        aria-label={resultsLabel}
        aria-live="polite"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable to be scrolled from the keyboard
        tabIndex={0}
        className="mac-siri-results"
      >
        {prompt != null && <p className="mac-siri-prompt">{prompt}</p>}
        {children}
      </div>
      <div className="mac-siri-bottom">
        {onHelp && (
          <BaseButton aria-label={helpLabel} className="mac-siri-help" onClick={onHelp}>
            ?
          </BaseButton>
        )}
        <BaseButton
          aria-label={listenLabel}
          aria-pressed={listening}
          className="mac-siri-orb"
          onClick={onListen}
        >
          {listening ? (
            <span
              className="mac-siri-wave"
              data-animated={animated ? "" : undefined}
              style={{ "--_level": Math.min(Math.max(level, 0), 1) || 0 } as CSSProperties}
              aria-hidden="true"
            >
              {bar(0.4, 0)}
              {bar(0.7, -0.5)}
              {bar(1, -0.15)}
              {bar(0.7, -0.65)}
              {bar(0.4, -0.3)}
            </span>
          ) : (
            <span className="mac-siri-orb-art" aria-hidden="true" />
          )}
        </BaseButton>
      </div>
    </div>
  );
}

export interface SiriCardProps extends Omit<ComponentProps<"article">, "title"> {
  /** Title of the result, shown in upper case in the 26 pt header band. It names the card. */
  title?: ReactNode;
  /** Icon of the app that answers, in a 14 pt box before the title. Decorative. */
  icon?: ReactNode;
}

/**
 * One result in the Siri window (a "snippet"): a light card with a header band and, under
 * it, the children. The card is light in both appearances.
 *
 * The root is an `<article>` named by the title; `className`, `style`, `ref` and other
 * attributes go to it. `--mac-siri-card-glow` adds a tint over its fill.
 */
export function SiriCard({ title, icon, className, children, ...props }: SiriCardProps) {
  const titleId = useId();
  const titled = title != null && title !== false;
  return (
    <article
      aria-labelledby={titled ? titleId : undefined}
      className={cn("mac-siri-card", className)}
      {...props}
    >
      {titled && (
        <div className="mac-siri-card-header">
          {icon != null && (
            <span className="mac-siri-card-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span id={titleId} className="mac-siri-card-title">
            {title}
          </span>
        </div>
      )}
      {children}
    </article>
  );
}
