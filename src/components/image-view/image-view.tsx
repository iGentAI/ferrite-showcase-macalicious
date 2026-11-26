import type {
  ComponentProps,
  CSSProperties,
  DOMAttributes,
  ReactEventHandler,
  ReactNode,
  Ref,
} from "react";
import { cn } from "../../lib/cn";
import "./image-view.tokens.css";
import "./image-view.css";

/*
 * Event handlers. The four image events below go to the `<img>` in every form that has one.
 * Every other handler goes to the rendered element, which is the `<img>` of a bitmap and the
 * `<span>` of a template or a monogram, so its `currentTarget` is typed as an HTMLElement.
 */
export interface ImageViewProps
  extends Omit<ComponentProps<"img">, "ref" | keyof DOMAttributes<HTMLImageElement>>,
    Omit<
      DOMAttributes<HTMLElement>,
      | "children"
      | "dangerouslySetInnerHTML"
      | "onLoad"
      | "onLoadCapture"
      | "onError"
      | "onErrorCapture"
    > {
  /**
   * Address of the image. Without it (and without `srcSet`) the view shows its children
   * instead: the initials of a monogram, or an inline SVG.
   */
  src?: string;
  /**
   * Text alternative. Leave it empty for a decorative image, which is then hidden from
   * assistive technology. `aria-label` and `aria-labelledby` name the image too, in every
   * form; one that is empty or only white space counts as not given.
   * @default ""
   */
  alt?: string;
  /**
   * How the image fits a view of another size (NSImageView.imageScaling).
   * `"proportionally-down"` shrinks a larger image and never enlarges a smaller one;
   * `"proportionally-up-or-down"` always fits it; `"axes-independently"` stretches it to the
   * view; `"none"` shows it at its own size, cropped by the view.
   * @default "proportionally-down"
   */
  scaling?: "proportionally-down" | "proportionally-up-or-down" | "axes-independently" | "none";
  /**
   * `"circle"` cuts the view to a circle, as for a user picture.
   * @default "none"
   */
  mask?: "none" | "circle";
  /**
   * Treats the image as a template (NSImage.isTemplate): only its alpha channel is used, and
   * it is drawn in the text colour of its surroundings, so one glyph works in both
   * appearances. Needs `src`, and a size from `width` and `height` or from CSS. The image is
   * read as a CSS mask, which the browser fetches with CORS: an image from another origin
   * must be served with `Access-Control-Allow-Origin`, or nothing is drawn. The mask is
   * fetched as soon as the view is styled, so `loading="lazy"` does not defer a template.
   * @default false
   */
  template?: boolean;
  /**
   * Draws the image dimmed and without colour, as in a disabled row.
   * @default false
   */
  disabled?: boolean;
  /**
   * Called when the image has loaded. The event's `currentTarget` is the `<img>`, in a
   * template too. A monogram has no image and never calls it.
   */
  onLoad?: ReactEventHandler<HTMLImageElement>;
  /** `onLoad` in the capture phase. */
  onLoadCapture?: ReactEventHandler<HTMLImageElement>;
  /**
   * Called when the image fails to load. The event's `currentTarget` is the `<img>`, in a
   * template too. A monogram has no image and never calls it.
   */
  onError?: ReactEventHandler<HTMLImageElement>;
  /** `onError` in the capture phase. */
  onErrorCapture?: ReactEventHandler<HTMLImageElement>;
  /** Shown when there is no `src` or `srcSet`: initials for a monogram, or an inline SVG. */
  children?: ReactNode;
  /** Ref to the rendered element: an `<img>`, or a `<span>` for a template or a monogram. */
  ref?: Ref<HTMLElement>;
}

/**
 * An image view (NSImageView): shows one image, without a frame, background or shadow of its
 * own. It is not interactive.
 *
 * A bitmap is a plain `<img>` and accepts every `<img>` attribute (`srcSet`, `loading`,
 * `decoding` and so on). A template image is a `<span>` the size of the view around an
 * `<img>`, and a monogram a `<span>` with `role="img"`. The library ships no artwork: supply
 * your own images.
 */
export function ImageView({
  src,
  alt = "",
  scaling = "proportionally-down",
  mask = "none",
  template = false,
  disabled = false,
  className,
  children,
  ref,
  srcSet,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: ImageViewProps) {
  const shared = {
    "data-scaling": scaling,
    "data-mask": mask,
    "data-disabled": disabled ? "" : undefined,
    className: cn("mac-image-view", className),
  };
  // The name goes on the element that has the image role. An <img> with an empty alt is
  // decorative whatever else names it, so a named one leaves the empty alt out. A label that
  // is empty or only white space names nothing, and counts as no label.
  const label = ariaLabel?.trim() ? ariaLabel : undefined;
  const labelledBy = ariaLabelledBy?.trim() ? ariaLabelledBy : undefined;
  const named = label != null || labelledBy != null;
  const altText = named && !alt ? undefined : alt;

  // A bitmap: anything with a source that is not a template. A template needs `src` for its
  // mask, so one that has only `srcSet` is shown as the bitmap it names.
  if (src != null ? !template : Boolean(srcSet)) {
    return (
      <img
        ref={ref as Ref<HTMLImageElement>}
        src={src}
        srcSet={srcSet}
        alt={altText}
        aria-label={label}
        aria-labelledby={labelledBy}
        draggable={false}
        {...shared}
        {...props}
      />
    );
  }

  // A template and a monogram are a span the size of the view: width and height become CSS.
  // The image events belong to the <img>: they do not bubble, so on the span they would never
  // be called, and their handlers expect an image as `currentTarget`.
  const {
    width,
    height,
    style,
    sizes: _sizes,
    useMap: _useMap,
    loading,
    decoding,
    crossOrigin,
    referrerPolicy,
    fetchPriority,
    onLoad,
    onLoadCapture,
    onError,
    onErrorCapture,
    ...rest
  } = props;
  const view = {
    ref: ref as Ref<HTMLSpanElement>,
    ...shared,
    ...(rest as ComponentProps<"span">),
    style: { width, height, ...style },
  };

  if (src != null) {
    // The <img> inside gives the template its natural size, so that it can scale down without
    // ever scaling up, and its alternative text. Its own pixels are not shown: the stylesheet
    // fills its box with the text colour and masks that with the same image. It is the element
    // with the image role, so its role and every ARIA attribute go to it and none stays on the
    // span.
    const aria: Record<string, unknown> = {};
    for (const key in view) {
      if (key === "role" || key.startsWith("aria-")) {
        aria[key] = (view as Record<string, unknown>)[key];
        delete (view as Record<string, unknown>)[key];
      }
    }
    return (
      <span data-kind="template" {...view}>
        <img
          className="mac-image-view-template"
          src={src}
          alt={altText}
          {...aria}
          aria-label={label}
          aria-labelledby={labelledBy}
          draggable={false}
          loading={loading}
          decoding={decoding}
          crossOrigin={crossOrigin}
          referrerPolicy={referrerPolicy}
          fetchPriority={fetchPriority}
          onLoad={onLoad}
          onLoadCapture={onLoadCapture}
          onError={onError}
          onErrorCapture={onErrorCapture}
          style={{ "--_src": `url(${JSON.stringify(src)})` } as CSSProperties}
        />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label ?? (alt || undefined)}
      aria-labelledby={labelledBy}
      aria-hidden={alt || named ? undefined : true}
      data-kind="monogram"
      {...view}
    >
      <span className="mac-image-view-initials">{children}</span>
    </span>
  );
}
