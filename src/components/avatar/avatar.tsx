"use client";

import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import type { CSSProperties, ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./avatar.tokens.css";
import "./avatar.css";

export interface AvatarProps extends Omit<BaseAvatar.Root.Props, "children" | "ref"> {
  /**
   * Address of the person's picture. While it loads, when it fails and without it the avatar
   * shows its children, or the silhouette.
   */
  src?: string;
  /**
   * The person's name. It names the avatar for assistive technology, whatever it shows.
   * Without it (and without an `aria-label`) the avatar is decoration and is hidden from
   * assistive technology.
   */
  alt?: string;
  /**
   * The disc's diameter in points. Find My's list has 29.
   * @default 29
   */
  size?: number;
  /** Initials, shown when there is no picture. Without them the avatar draws a silhouette. */
  children?: ReactNode;
  /**
   * Called when the picture's loading status changes: `"loading"`, `"loaded"` or `"error"`
   * (Base UI's `Avatar.Image`). Not called without `src`.
   */
  onLoadingStatusChange?: BaseAvatar.Image.Props["onLoadingStatusChange"];
  /** Ref to the root element. */
  ref?: Ref<HTMLSpanElement>;
}

/**
 * A person's picture in a disc, as in the People list of Find My: the picture when it has
 * loaded, else initials, else a silhouette, on a grey disc that is the same in both
 * appearances. The silhouette is drawn for this library and is not Apple's.
 *
 * Built on Base UI's Avatar, which shows the fallback until the picture has loaded and when it
 * cannot be loaded. Other props, `ref` included, go to the root `<span>`.
 */
export function Avatar({
  src,
  alt,
  size = 29,
  onLoadingStatusChange,
  className,
  style,
  children,
  ...props
}: AvatarProps) {
  // Named by alt, or by a label of the caller's; else decoration.
  const named = Boolean(alt || props["aria-label"] || props["aria-labelledby"]);
  const diameter = { "--mac-avatar-size": `${size}px` } as CSSProperties;
  return (
    <BaseAvatar.Root
      role={named ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={named ? undefined : true}
      {...props}
      className={withClassName("mac-avatar", className)}
      // Base UI's style may be a function of the avatar's state: the diameter joins its result.
      style={
        typeof style === "function"
          ? (state) => ({ ...diameter, ...style(state) })
          : { ...diameter, ...style }
      }
    >
      {src ? (
        <BaseAvatar.Image
          className="mac-avatar-image"
          src={src}
          alt=""
          onLoadingStatusChange={onLoadingStatusChange}
        />
      ) : null}
      <BaseAvatar.Fallback className="mac-avatar-fallback">
        {children ?? (
          <svg
            className="mac-avatar-glyph"
            viewBox="0 0 29 29"
            aria-hidden="true"
            focusable="false"
          >
            <ellipse cx="14.5" cy="11.65" rx="4.8" ry="5.05" />
            <ellipse cx="14.5" cy="23.25" rx="8.6" ry="3.7" />
          </svg>
        )}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
