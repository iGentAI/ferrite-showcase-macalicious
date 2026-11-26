import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import "./system-image.tokens.css";
import "./system-image.css";

const line = { fill: "none", stroke: "currentColor" } as const;
const round = { ...line, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const person = (x: number, y: number, rx: number, ry: number, body: string, opacity?: number) => (
  <g opacity={opacity}>
    <ellipse cx={x} cy={y} rx={rx} ry={ry} />
    <path d={body} />
  </g>
);

const INFO_LETTER = "M7.5 3a1 1 0 1 0 0 2 1 1 0 1 0 0-2zM5.5 6h3v5h1v1h-4v-1h1V7h-1z";
const TAG_OUTLINE = "M.5 5 5 .5h10.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5z";
const TAG_HOLE = "M4 4a1 1 0 1 0 0 2 1 1 0 1 0 0-2z";

/*
 * Original drawings on the boxes measured in the reference screenshots: width and height in
 * points, then the drawing. None is Apple's artwork. Where a screenshot shows the image, the
 * comment names it.
 */
const images = {
  // Gradient buttons under a list (Language & Region): 11 pt, 1 pt bars.
  add: [11, 11, <path key="p" d="M0 5h11v1H0zM5 0h1v11H5z" />],
  remove: [11, 11, <path key="p" d="M0 5h11v1H0z" />],
  // The gear of the Network pane's action button, 13 pt.
  action: [
    13,
    13,
    <g key="g" {...line}>
      <circle cx="6.5" cy="6.5" r="3.4" strokeWidth="2.8" />
      <circle cx="6.5" cy="6.5" r="5.5" strokeWidth="2" strokeDasharray="2.3 2.02" />
    </g>,
  ],
  // Console's Share button: 11 x 15 pt.
  share: [11, 15, <path key="p" {...line} d="M4 5.5H.5v9h10v-9H7M5.5.9v8.85M3 3.6 5.5 1 8 3.6" />],
  // Finder's Back and Forward: 7 x 12 pt.
  "go-back": [7, 12, <path key="p" {...round} strokeWidth="1.5" d="M6 .5.75 6l5.5 5.5" />],
  "go-forward": [7, 12, <path key="p" {...round} strokeWidth="1.5" d="M1 .5 6.25 6 .75 11.5" />],
  // The chevron of a toolbar pull-down button: 7 x 4.5 pt.
  "chevron-down": [7, 4.5, <path key="p" {...line} strokeWidth="1.5" d="M.6.8l2.9 2.8L6.4.8" />],
  // Finder's view switcher: 14 x 10 pt (16 for columns).
  "icon-view": [
    14,
    10,
    <path
      key="p"
      {...line}
      d="M.5.5h3v3h-3zM5.5.5h3v3h-3zM10.5.5h3v3h-3zM.5 6.5h3v3h-3zM5.5 6.5h3v3h-3zM10.5 6.5h3v3h-3z"
    />,
  ],
  "list-view": [14, 10, <path key="p" {...line} d="M0 .5h14M0 3.5h14M0 6.5h14M0 9.5h14" />],
  "column-view": [
    16,
    10,
    <g key="g" {...line}>
      <rect x=".5" y=".5" width="15" height="9" rx=".5" />
      <path d="M5.5 1v8M10.5 1v8" />
    </g>,
  ],
  "gallery-view": [
    14,
    10,
    <g key="g" {...line}>
      <rect x=".5" y=".5" width="13" height="6" rx=".5" />
      <path d="M0 9h2M3 9h2M6 9h2M9 9h2M12 9h2" strokeWidth="1.5" />
    </g>,
  ],
  // Finder's Edit Tags button: 17 x 10 pt of ink at x 1017..1050, y 138..157 of the Aqua Home
  // capture (x 1015..1048 in Dark Aqua). A 1 pt outline with a 45 degree point, rounded
  // corners at the back and a 2 pt hole centred 4 pt in. Aqua draws the outline and fills the
  // hole; Dark Aqua fills the tag and cuts the hole out of it (the body and dot parts, see the
  // CSS and the tokens file).
  tag: [
    17,
    10,
    <g key="g">
      <path className="mac-system-image-body" fillRule="evenodd" d={TAG_OUTLINE + TAG_HOLE} />
      <path {...round} d={TAG_OUTLINE} />
      <path className="mac-system-image-dot" d={TAG_HOLE} />
    </g>,
  ],
  // Rotate Left of Quick Look and of the gallery's Preview pane: 16 pt, measured on Quick
  // Look's button (x 2701..2733, y 109..141 of the Aqua capture). A 9 x 7 pt page with a 1 pt
  // outline at the bottom left, an arrowhead 4.5 pt deep and 5 pt across pointing left at its
  // top, and a 1 pt arc from the arrowhead round to the right, down to 11.5 pt. Dark Aqua
  // fills the page.
  "rotate-left": [
    16,
    16,
    <g key="g">
      <rect
        className="mac-system-image-body"
        stroke="currentColor"
        x="1"
        y="8"
        width="9"
        height="7"
        rx=".75"
      />
      <path d="M3 3 7.5.5v5z" />
      <path {...line} d="M7.5 3h1.25a5.25 6.25 0 0 1 5.25 6.25v2.25" />
    </g>,
  ],
  // Safari's sidebar button: 15 x 11 pt.
  sidebar: [
    15,
    11,
    <g key="g" {...line}>
      <rect x=".5" y=".5" width="14" height="10" rx="1" />
      <path d="M5.5 1v9" />
    </g>,
  ],
  // Console's Reload button: 11 x 13 pt.
  refresh: [
    11,
    13,
    <g key="g">
      <path {...line} d="M10.5 7.5a5 4.75 0 1 1-5-4.75" />
      <path d="M5 0v5.5l4.4-2.75z" />
    </g>,
  ],
  // A disc with the letter cut out of it: 15 pt. The letter is measured in Console's toolbar:
  // a 2 pt dot, a 2 pt stem from 6 to 12 pt down, a 1 pt flag at its top left and a 4 pt foot.
  // The letter is drawn again over the hole for a tinted toolbar toggle (see the CSS).
  info: [
    15,
    15,
    <g key="g">
      <path fillRule="evenodd" d={`M7.5 0a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15z${INFO_LETTER}`} />
      <path className="mac-system-image-mark" d={INFO_LETTER} />
    </g>,
  ],
  // The letter in a 16 pt ring with a 1 pt stroke, measured at the end of a Reminders row
  // (x 1580..1611, y 964..995 of the Aqua capture): a 2 pt dot centred 4.5 pt down, a 2 pt
  // stem from 6.5 to 12.5 pt down, a 1 pt flag at its top left and a 4 pt foot.
  "info-outline": [
    16,
    16,
    <g key="g">
      <circle {...line} cx="8" cy="8" r="7.5" />
      <circle cx="8" cy="4.5" r="1" />
      <path d="M6 6.5h3v5h1v1H6v-1h1v-4H6z" />
    </g>,
  ],
  // The search field's clear button: a 14 pt disc with the cross cut out of it.
  "stop-progress": [
    14,
    14,
    <path
      key="p"
      fillRule="evenodd"
      d="M7 0a7 7 0 1 0 0 14A7 7 0 1 0 7 0zM8.91 4.1 9.9 5.09 7.99 7 9.9 8.91 8.91 9.9 7 7.99 5.09 9.9 4.1 8.91 6.01 7 4.1 5.09 5.09 4.1 7 6.01z"
    />,
  ],
  // Reminders' Add List button: a 16 pt disc with the plus cut out of it, 8 pt long and 1.4 pt
  // thick.
  "add-circle": [
    16,
    16,
    <path
      key="p"
      fillRule="evenodd"
      d="M8 0a8 8 0 1 0 0 16A8 8 0 1 0 8 0zM7.3 4h1.4v3.3H12v1.4H8.7V12H7.3V8.7H4V7.3h3.3z"
    />,
  ],
  // The Users table of the Sharing pane: 13 x 13 pt, and 15 x 10.5 pt of ink in a 15 x 11 pt box.
  user: [13, 13, person(6.5, 3.5, 3.1, 3.4, "M0 13a6.5 4.75 0 0 1 13 0z")],
  "user-group": [
    15,
    11,
    <g key="g">
      {person(4.5, 4, 2, 2.5, "M0 10.5C0 8.5 1.5 7 4.3 7c-.7 1-1 2-1.1 3.5z", 0.5)}
      {person(9.5, 3, 2.4, 3, "M4.5 10.5a5.1 3.75 0 0 1 10.2 0z", 0.8)}
    </g>,
  ],
  everyone: [
    15,
    11,
    <g key="g">
      {person(2.25, 3.25, 1.6, 2.1, "M0 10.5V6.75h3.2C2.2 7.6 1.6 9 1.5 10.5z", 0.5)}
      {person(12.75, 3.25, 1.6, 2.1, "M15 10.5V6.75h-3.2c1 .85 1.6 2.25 1.7 3.75z", 0.5)}
      {person(7.5, 2.9, 2.3, 2.9, "M2.5 10.5a5 3.6 0 0 1 10 0z", 0.85)}
    </g>,
  ],
} satisfies Record<string, readonly [width: number, height: number, drawing: ReactNode]>;

/** The name of a system image: see the table on the docs page for the AppKit name of each. */
export type SystemImageName = keyof typeof images;

/** Every system image name, in the order of the docs page. */
export const SYSTEM_IMAGE_NAMES = Object.keys(images) as SystemImageName[];

export interface SystemImageProps extends Omit<ComponentProps<"svg">, "name"> {
  /** Which image to draw. */
  name: SystemImageName;
  /**
   * Multiplies the image's own size, which is the size Catalina draws it at in a regular
   * control. The drawing scales with it.
   * @default 1
   */
  scale?: number;
}

/**
 * One of the standard template images of AppKit (`NSImage.Name`: add, remove, action, share,
 * the view-mode glyphs and so on), redrawn for this library at the size Catalina uses.
 *
 * It is an inline `<svg>` drawn in `currentColor`, so it follows the text colour of the
 * control it is in, in both appearances and when the control is disabled. It is decorative
 * and hidden from assistive technology unless it has an `aria-label`, which makes it an image
 * with that name.
 */
export function SystemImage({ name, scale = 1, className, ...props }: SystemImageProps) {
  const [width, height, drawing] = images[name];
  const named = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: hidden from assistive technology unless named.
    <svg
      data-name={name}
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      role={named ? "img" : undefined}
      aria-hidden={named ? undefined : true}
      focusable={false}
      className={cn("mac-system-image", className)}
      {...props}
    >
      {drawing}
    </svg>
  );
}
