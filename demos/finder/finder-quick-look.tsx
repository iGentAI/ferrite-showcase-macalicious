"use client";

import { cn } from "macalicious/lib/cn";
import {
  MarkupToolbar,
  MarkupToolbarSeparator,
  MarkupToolbarSwatch,
  MarkupToolbarTool,
} from "macalicious/markup-toolbar";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuRadioGroup, MenuRadioItem } from "macalicious/menu-item";
import {
  QuickLookPanel,
  QuickLookPanelButton,
  type QuickLookPanelProps,
} from "macalicious/quick-look-panel";
import { SystemImage } from "macalicious/system-image";
import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { applicationsFor } from "./finder-applications";
import { ItemIcon, pictureBackground } from "./finder-artwork";
import { type FinderNode, resolve } from "./finder-data";
import {
  type Annotation,
  CAPTION_POINTS,
  type CropBox,
  FIGURE_AT,
  type Figure,
  NO_FILL,
  type Shape,
  type Stroke,
} from "./finder-markup";
import "./finder.tokens.css";
import "./finder-panels.css";

/* Stand-in glyphs, drawn for this demo: Quick Look's and Markup's own are Apple artwork. Line
   drawings on a 16 pt box in the colour of the button or the tool. Rotate Left is not here: it
   is the library's rotate-left system image. */
const glyph = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GLYPHS = {
  markup: glyph("M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13zM5.5 11.5L8 4.5l2.5 7M6.4 9h3.2"),
  fullScreen: glyph("M2 6V2h4M14 10v4h-4M2 2l4.5 4.5M14 14l-4.5-4.5"),
  sketch: glyph("M1.5 12.5c2-4 3.5 1.5 5.5-1.5M8.5 9.5l5-7"),
  draw: glyph("M1.5 12.5c1.5-5 4 2 5.5-2s1 2 2 1M10 8l4-5.5"),
  shapes: glyph("M1.5 2.5h8v8h-8zM11 14.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7z"),
  text: glyph("M1.5 2.5h13v11h-13zM5 6h6M8 6v5"),
  highlight: glyph("M4 10l6-8 3 2.5-6 8zM4 10l-1 3 4-.5M1.5 14.5h13"),
  sign: glyph("M1.5 11c3-7 4.5-7 3.5-2s2.5 1 3.5 0 1.5 2 3 .5 1.5 0 3-.5M1.5 14.5h13"),
  textStyle: glyph("M3.5 13.5L8 2.5l4.5 11M5.2 9.5h5.6"),
  crop: glyph("M4.5 1v10.5H15M1 4.5h10.5V15"),
  trim: glyph("M1.5 4.5h13v7h-13zM4.5 2.5v11M11.5 2.5v11"),
  shapeStyle: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1 3.5h14" stroke="currentColor" strokeWidth="1" />
      <path d="M1 7.5h14" stroke="currentColor" strokeWidth="2" />
      <path d="M1 12.5h14" stroke="currentColor" strokeWidth="3" />
    </svg>
  ),
};

/* The widths of the tools, so that the two separators stand where the capture has them, 286
   and 474 pt from the panel's leading edge. */
const width = (points: number): CSSProperties => ({ width: points });
const TOOL = {
  sketch: width(30),
  draw: width(42),
  shapes: width(48),
  text: width(38),
  highlight: width(38),
  sign: width(46),
  style: width(44),
  textStyle: width(39),
  rotate: width(30),
  crop: width(36),
};

/** The freehand tools: a thin line, a thick one, and a wide one that lets the picture through. */
type Pen = "sketch" | "draw" | "highlight";
const PENS: Record<Pen, { label: string; width: number; opacity: number }> = {
  sketch: { label: "Sketch", width: 2, opacity: 1 },
  draw: { label: "Draw", width: 5, opacity: 1 },
  highlight: { label: "Highlight", width: 14, opacity: 0.5 },
};

const SHAPES: readonly [Shape, string][] = [
  ["rectangle", "Rectangle"],
  ["oval", "Oval"],
  ["line", "Line"],
];

/** The colours of the Border Colour and Fill Colour menus. */
const COLORS: readonly [name: string, color: string][] = [
  ["Black", "#000000"],
  ["White", "#ffffff"],
  ["Red", "#ff3b30"],
  ["Yellow", "#ffcc00"],
  ["Green", "#34c759"],
  ["Blue", "#007aff"],
];

/** The sizes of the Text Style menu, in points. */
const TEXT_SIZES: readonly [name: string, points: number][] = [
  ["Small", 12],
  ["Medium", CAPTION_POINTS],
  ["Large", 28],
];

const SIGN_REASON =
  "A signature is written on a trackpad or held up to a camera, which this window cannot take.";
const CROP_REASON = "Only a picture on the drive can be cropped.";
const TRIM_REASON =
  "A browser plays this file but cannot write a shorter copy of it in its format.";

/** The line widths of the Shape Style menu, in points. */
const LINE_WIDTHS: readonly [name: string, width: number][] = [
  ["Thin", 1],
  ["Medium", 3],
  ["Thick", 6],
];

const SHARE_WITH = ["Mail", "Messages", "AirDrop", "Notes"];

/** Lines keep their width in points however the overlay is stretched over the picture. */
const LINE = {
  vectorEffect: "non-scaling-stroke",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Mark({ mark }: { mark: Stroke | Figure | CropBox }) {
  if (mark.type === "crop") {
    const left = Math.min(mark.from[0], mark.to[0]);
    const top = Math.min(mark.from[1], mark.to[1]);
    const right = Math.max(mark.from[0], mark.to[0]);
    const bottom = Math.max(mark.from[1], mark.to[1]);
    return (
      <path
        d={`M0 0H1000V1000H0ZM${left} ${top}H${right}V${bottom}H${left}Z`}
        fillRule="evenodd"
        fill="#000000"
        fillOpacity={0.45}
      />
    );
  }
  if (mark.type === "stroke") {
    // A press without a move is one point: a line to itself, which round ends draw as a dot.
    const [first, ...rest] = mark.points;
    return (
      <path
        d={`M${first}L${rest.length > 0 ? rest.join("L") : first}`}
        fill="none"
        stroke={mark.color}
        strokeWidth={mark.width}
        strokeOpacity={mark.opacity}
        {...LINE}
      />
    );
  }
  const at = FIGURE_AT + mark.offset;
  const paint = { stroke: mark.color, strokeWidth: mark.width, fill: mark.fill, ...LINE };
  if (mark.type === "rectangle") return <rect x={at} y={at} width="300" height="300" {...paint} />;
  if (mark.type === "oval") {
    return <ellipse cx={at + 150} cy={at + 150} rx="150" ry="150" {...paint} />;
  }
  return <line x1={at} y1={at + 300} x2={at + 300} y2={at} {...paint} fill="none" />;
}

/**
 * The shape of a picture as a CSS ratio, from its dimensions: `5120×2880` is `5120 / 2880`.
 * Dimensions are two positive numbers with a multiplication sign or an x between them; a
 * picture without dimensions, or with anything else for them, is drawn 16 to 9.
 */
function ratioOf(dimensions: string | undefined): string {
  const pair = dimensions?.match(/^\s*(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*$/);
  const [width, height] = pair ? [Number(pair[1]), Number(pair[2])] : [0, 0];
  return width > 0 && height > 0 ? `${width} / ${height}` : "16 / 9";
}

/** Where the pointer is on the overlay, in thousandths of its width and height. */
function pointOf(event: PointerEvent<SVGSVGElement>): string {
  const { offsetX, offsetY } = event.nativeEvent;
  const { clientWidth, clientHeight } = event.currentTarget;
  // An environment without layout reports no size and no offset: the point is the origin.
  const unit = (offset: number, size: number) =>
    size > 0 && Number.isFinite(offset)
      ? Math.round(Math.min(1, Math.max(0, offset / size)) * 1000)
      : 0;
  return `${unit(offsetX, clientWidth)} ${unit(offsetY, clientHeight)}`;
}

/** A tool that opens a menu of colours: the menu sets the colour, the swatch shows it. */
function ColorTool({
  label,
  value,
  onValueChange,
  none = false,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (color: string) => void;
  /** Whether the menu offers None, as the fill's does. */
  none?: boolean;
  /** The swatch. */
  children: ReactNode;
}) {
  return (
    <Menu>
      <MenuTrigger render={<MarkupToolbarTool aria-label={label} menu style={TOOL.style} />}>
        {children}
      </MenuTrigger>
      <MenuPopup sideOffset={8}>
        <MenuRadioGroup value={value} onValueChange={(next) => onValueChange(`${next}`)}>
          {none && <MenuRadioItem value={NO_FILL}>None</MenuRadioItem>}
          {COLORS.map(([name, color]) => (
            <MenuRadioItem
              key={name}
              value={color}
              image={<span className="mac-finder-quick-look-chip" style={{ background: color }} />}
            >
              {name}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}

export interface FinderQuickLookProps
  extends Omit<QuickLookPanelProps, "title" | "actions" | "tools" | "children"> {
  /** The file system the item is in. */
  root: FinderNode;
  /** The path of the previewed item. Nothing is rendered when no item is there. */
  path: string;
  /** Whether the panel is in Markup mode, when controlled. Only a picture has Markup. */
  markup?: boolean;
  /**
   * Whether the panel starts in Markup mode, when uncontrolled.
   * @default false
   */
  defaultMarkup?: boolean;
  /** Called when the Markup button turns Markup mode on and when Done turns it off. */
  onMarkupChange?: (markup: boolean) => void;
  /**
   * Called by Rotate Left with the picture's path. The owner turns the picture by changing the
   * item's `rotation`; without it the button is disabled.
   */
  onRotate?: (path: string) => void;
  /** Called by the Open button with the item; without it the button is disabled. */
  onOpen?: (path: string, node: FinderNode) => void;
  /** Called by the full-screen button; without it there is none. */
  onFullScreen?: () => void;
  /**
   * Called when a destination is chosen in the Share menu, with the item's path; without it
   * the button is disabled.
   */
  onShare?: (destination: string, paths: readonly string[]) => void;
  /** The Share menu's rows in place of its destinations, as a drive file's are. */
  shareItems?: ReactNode;
  /**
   * The item's real bytes, for an item of the person's drive: `null` while they load, an `Error`
   * when they could not be read. A picture then shows itself instead of the stand-in, a movie and
   * a sound play, a PDF shows in the browser's viewer and a text file shows its text. Without it
   * the panel shows the demo's stand-ins.
   */
  file?: QuickLookFile | Error | null;
  /** Called by Download with the item's path; the button is there only with it. */
  onDownload?: (path: string) => void;
  /**
   * Called by Done with the picture's annotations and the width in points it was shown at, to save
   * them into the file; a `true` answer lets go of them, since the file now shows them. Without it
   * they last while the panel is open, and Crop and Text Style are dimmed.
   */
  onSaveMarks?: (
    path: string,
    marks: readonly Annotation[],
    shownWidth: number,
  ) => Promise<boolean>;
}

/** A file's bytes as Quick Look shows them: an address in the page, and the start of a text. */
export interface QuickLookFile {
  url: string;
  type: string;
  text?: string;
}

/** The kinds of drive file Quick Look shows the bytes of, beside pictures. */
const PREVIEWED = new Set<FinderNode["kind"]>(["movie", "audio", "pdf", "document"]);

/** What Quick Look shows of a real file that is not a picture. */
function FilePreview({ node, file }: { node: FinderNode; file: QuickLookFile }) {
  switch (node.kind) {
    case "movie":
      // biome-ignore lint/a11y/useMediaCaption: the person's own movie comes with no captions.
      return <video className="mac-finder-quick-look-media" src={file.url} controls />;
    case "audio":
      // biome-ignore lint/a11y/useMediaCaption: the person's own recording comes with no captions.
      return <audio className="mac-finder-quick-look-sound" src={file.url} controls />;
    case "pdf":
      return <iframe className="mac-finder-quick-look-document" title={node.name} src={file.url} />;
    case "document":
      return file.text !== undefined ? (
        <pre className="mac-finder-quick-look-plain">{file.text}</pre>
      ) : null;
    default:
      return null;
  }
}

/**
 * Quick Look of one item: the library's Quick Look panel with the item's name, the actions of
 * the reference screenshot and a preview. A picture is the demo's gradient stand-in, turned as
 * the item's `rotation` says; anything else is its icon.
 *
 * A picture has Markup: the Markup button swaps the title for the library's Markup toolbar and
 * the actions for Done. Sketch, Draw and Highlight draw with the pointer; Shapes and Text add
 * a shape or a text near the middle; Shape Style, Border Colour and Fill Colour set what the
 * next ones are drawn with. The annotations are kept per picture while the panel is open and
 * turn with it. With `onSaveMarks` Done saves them into the file, and Crop and Text Style work.
 *
 * Every other prop goes to the `QuickLookPanel`: `width`, `height`, `state`, `style`, `ref`,
 * `onClose` (the close button and Escape). With a `height` the picture is fitted into the
 * panel; without one the panel is as tall as the picture at the panel's width.
 */
export function FinderQuickLook({
  root,
  path,
  markup,
  defaultMarkup = false,
  onMarkupChange,
  onRotate,
  onOpen,
  onFullScreen,
  onShare,
  shareItems,
  file,
  onDownload,
  onSaveMarks,
  height,
  style,
  className,
  ...props
}: FinderQuickLookProps) {
  const [ownMarkup, setOwnMarkup] = useState(defaultMarkup);
  const [pen, setPen] = useState<Pen | "crop">("sketch");
  const [textSize, setTextSize] = useState(CAPTION_POINTS);
  const overlay = useRef<SVGSVGElement>(null);
  const [border, setBorder] = useState("#000000");
  const [fill, setFill] = useState(NO_FILL);
  const [lineWidth, setLineWidth] = useState(3);
  // The annotations of every picture marked up while the panel is open, by path.
  const [marks, setMarks] = useState<Record<string, readonly Annotation[]>>({});
  // The stroke the pointer is drawing, and the last id given out.
  const drawing = useRef<{ id: number; pointer: number } | null>(null);
  const lastId = useRef(0);
  // The Markup button and Done take each other's place: the one that comes in takes the
  // keyboard focus the other had, once, so that the focus is not lost with the button pressed.
  const swapped = useRef(false);
  const takeFocus = useCallback((element: HTMLElement | null) => {
    if (!element || !swapped.current) return;
    swapped.current = false;
    element.focus();
  }, []);

  const node = resolve(root, path);
  // A stroke ends with the surface it is drawn on: another item, or Markup mode left, takes
  // the overlay away before the pointer is lifted, and the next stroke must not wait for that.
  const surface = `${path}\n${node?.kind}\n${markup ?? ownMarkup}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the surface is what the effect follows; it reads nothing else.
  useEffect(() => {
    drawing.current = null;
  }, [surface]);
  if (!node) return null;

  const picture = node.kind === "image";
  const marking = picture && (markup ?? ownMarkup);
  const annotations = marks[path] ?? [];
  const count = annotations.length;

  const setMarkup = (next: boolean) => {
    swapped.current = true;
    if (markup === undefined) setOwnMarkup(next);
    onMarkupChange?.(next);
  };
  const change = (update: (current: readonly Annotation[]) => readonly Annotation[]) =>
    setMarks((all) => ({ ...all, [path]: update(all[path] ?? []) }));
  const add = (annotation: Annotation) => change((current) => [...current, annotation]);
  const newId = () => {
    lastId.current += 1;
    return lastId.current;
  };
  // Each shape and text stands a little further along than the one before, five to a round.
  const offset = (count % 5) * 40;

  const application = applicationsFor(node.kind)[0];
  const share = (
    <Menu>
      <MenuTrigger
        disabled={!onShare && !shareItems}
        render={<QuickLookPanelButton aria-label="Share" />}
      >
        <SystemImage name="share" />
      </MenuTrigger>
      <MenuPopup sideOffset={6} align="end">
        {shareItems ??
          SHARE_WITH.map((destination) => (
            <MenuItem key={destination} onClick={() => onShare?.(destination, [path])}>
              {destination}
            </MenuItem>
          ))}
      </MenuPopup>
    </Menu>
  );

  const tools = marking ? (
    <MarkupToolbar aria-label="Markup">
      {(["sketch", "draw"] as const).map((name) => (
        <MarkupToolbarTool
          key={name}
          aria-label={PENS[name].label}
          selected={pen === name}
          style={TOOL[name]}
          onClick={() => setPen(name)}
        >
          {GLYPHS[name]}
        </MarkupToolbarTool>
      ))}
      <Menu>
        <MenuTrigger render={<MarkupToolbarTool aria-label="Shapes" menu style={TOOL.shapes} />}>
          {GLYPHS.shapes}
        </MenuTrigger>
        <MenuPopup sideOffset={8}>
          {SHAPES.map(([type, label]) => (
            <MenuItem
              key={type}
              onClick={() =>
                add({ id: newId(), type, offset, color: border, fill, width: lineWidth })
              }
            >
              {label}
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
      <MarkupToolbarTool
        aria-label="Text"
        style={TOOL.text}
        onClick={() =>
          add({
            id: newId(),
            type: "text",
            offset,
            text: "Text",
            color: border,
            ...(textSize === CAPTION_POINTS ? null : { size: textSize }),
          })
        }
      >
        {GLYPHS.text}
      </MarkupToolbarTool>
      <MarkupToolbarTool
        aria-label={PENS.highlight.label}
        selected={pen === "highlight"}
        style={TOOL.highlight}
        onClick={() => setPen("highlight")}
      >
        {GLYPHS.highlight}
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Sign" menu disabled title={SIGN_REASON} style={TOOL.sign}>
        {GLYPHS.sign}
      </MarkupToolbarTool>
      <MarkupToolbarSeparator />
      <Menu>
        <MenuTrigger
          render={<MarkupToolbarTool aria-label="Shape Style" menu style={TOOL.style} />}
        >
          {GLYPHS.shapeStyle}
        </MenuTrigger>
        <MenuPopup sideOffset={8}>
          <MenuRadioGroup value={lineWidth} onValueChange={(next) => setLineWidth(Number(next))}>
            {LINE_WIDTHS.map(([name, points]) => (
              <MenuRadioItem key={name} value={points}>
                {name}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
      <ColorTool label="Border Colour" value={border} onValueChange={setBorder}>
        <MarkupToolbarSwatch variant="border" color={border} />
      </ColorTool>
      <ColorTool label="Fill Colour" value={fill} onValueChange={setFill} none>
        <MarkupToolbarSwatch color={fill === NO_FILL ? undefined : fill} />
      </ColorTool>
      <Menu>
        <MenuTrigger
          disabled={!onSaveMarks}
          render={<MarkupToolbarTool aria-label="Text Style" menu style={TOOL.textStyle} />}
        >
          {GLYPHS.textStyle}
        </MenuTrigger>
        <MenuPopup sideOffset={8}>
          <MenuRadioGroup value={textSize} onValueChange={(next) => setTextSize(Number(next))}>
            {TEXT_SIZES.map(([name, points]) => (
              <MenuRadioItem key={name} value={points}>
                {name}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
      <MarkupToolbarSeparator />
      <MarkupToolbarTool
        aria-label="Rotate Left"
        disabled={!onRotate}
        style={TOOL.rotate}
        onClick={() => onRotate?.(path)}
      >
        <SystemImage name="rotate-left" />
      </MarkupToolbarTool>
      <MarkupToolbarTool
        aria-label="Crop"
        disabled={!onSaveMarks}
        title={onSaveMarks ? undefined : CROP_REASON}
        selected={pen === "crop"}
        style={TOOL.crop}
        onClick={() => setPen("crop")}
      >
        {GLYPHS.crop}
      </MarkupToolbarTool>
    </MarkupToolbar>
  ) : undefined;

  const actions = marking ? (
    <>
      <QuickLookPanelButton
        ref={takeFocus}
        onClick={() => {
          setMarkup(false);
          if (!onSaveMarks || annotations.length === 0) return;
          const saved = annotations;
          void onSaveMarks(path, saved, overlay.current?.clientWidth ?? 0).then((kept) => {
            if (!kept) return;
            change((current) => current.filter((mark) => !saved.includes(mark)));
          });
        }}
      >
        Done
      </QuickLookPanelButton>
      {share}
    </>
  ) : (
    <>
      {picture && (
        <>
          <QuickLookPanelButton
            aria-label="Rotate Left"
            disabled={!onRotate}
            onClick={() => onRotate?.(path)}
          >
            <SystemImage name="rotate-left" />
          </QuickLookPanelButton>
          <QuickLookPanelButton ref={takeFocus} aria-label="Markup" onClick={() => setMarkup(true)}>
            {GLYPHS.markup}
          </QuickLookPanelButton>
        </>
      )}
      {file !== undefined && (node.kind === "movie" || node.kind === "audio") && (
        <QuickLookPanelButton aria-label="Trim" disabled title={TRIM_REASON}>
          {GLYPHS.trim}
        </QuickLookPanelButton>
      )}
      <QuickLookPanelButton disabled={!onOpen} onClick={() => onOpen?.(path, node)}>
        {application ? `Open with ${application}` : "Open"}
      </QuickLookPanelButton>
      {onDownload && (
        <QuickLookPanelButton onClick={() => onDownload(path)}>Download</QuickLookPanelButton>
      )}
      {onFullScreen && (
        <QuickLookPanelButton aria-label="Full Screen" onClick={onFullScreen}>
          {GLYPHS.fullScreen}
        </QuickLookPanelButton>
      )}
      {share}
    </>
  );

  const turns = node.rotation ?? 0;
  const stage = { "--_ratio": ratioOf(node.dimensions) } as CSSProperties;
  const real = file && !(file instanceof Error) ? file : undefined;
  // Only a kind with a preview of its own, and a text file once its text is read; anything
  // else keeps its icon.
  const previewable =
    real !== undefined &&
    !picture &&
    PREVIEWED.has(node.kind) &&
    (node.kind !== "document" || real.text !== undefined);
  const preview = previewable && real ? <FilePreview node={node} file={real} /> : null;
  const background = real
    ? `center / contain no-repeat url("${real.url}")`
    : pictureBackground(node.name);

  return (
    <QuickLookPanel
      title={node.name}
      tools={tools}
      actions={actions}
      height={height}
      style={style}
      className={cn("mac-finder-quick-look", className)}
      {...props}
    >
      {picture ? (
        <div
          className="mac-finder-quick-look-stage"
          data-fit={height !== undefined || style?.height !== undefined ? "contain" : "width"}
          data-turned={turns % 2 === 0 ? undefined : ""}
          style={stage}
        >
          <div
            className="mac-finder-quick-look-picture"
            style={{ background, rotate: `${turns * -90}deg` }}
          >
            <svg
              ref={overlay}
              role="img"
              aria-label={
                marking || count > 0
                  ? `${node.name}, ${count} ${count === 1 ? "annotation" : "annotations"}`
                  : node.name
              }
              className="mac-finder-quick-look-overlay"
              data-drawing={marking ? "" : undefined}
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              onPointerDown={(event) => {
                if (!marking || event.button || drawing.current) return;
                // The stroke goes on while the pointer leaves the picture. Environments without
                // pointer capture draw only while the pointer is over it. One pointer draws at a
                // time: a second finger neither starts a stroke nor moves or ends this one.
                event.currentTarget.setPointerCapture?.(event.pointerId);
                const id = newId();
                drawing.current = { id, pointer: event.pointerId };
                if (pen === "crop") {
                  const start = pointOf(event).split(" ").map(Number) as [number, number];
                  change((current) => [
                    ...current.filter((mark) => mark.type !== "crop"),
                    { id, type: "crop", from: start, to: start },
                  ]);
                  return;
                }
                add({
                  id,
                  type: "stroke",
                  points: [pointOf(event)],
                  color: border,
                  width: PENS[pen].width,
                  opacity: PENS[pen].opacity,
                });
              }}
              onPointerMove={(event) => {
                const stroke = drawing.current;
                if (stroke?.pointer !== event.pointerId) return;
                const { id } = stroke;
                const point = pointOf(event);
                change((current) =>
                  current.map((mark) => {
                    if (mark.id !== id) return mark;
                    if (mark.type === "crop") {
                      return { ...mark, to: point.split(" ").map(Number) as [number, number] };
                    }
                    return mark.type === "stroke" && mark.points.at(-1) !== point
                      ? { ...mark, points: [...mark.points, point] }
                      : mark;
                  }),
                );
              }}
              onPointerUp={(event) => {
                if (drawing.current?.pointer === event.pointerId) drawing.current = null;
              }}
              onPointerCancel={(event) => {
                if (drawing.current?.pointer === event.pointerId) drawing.current = null;
              }}
              onLostPointerCapture={(event) => {
                if (drawing.current?.pointer === event.pointerId) drawing.current = null;
              }}
            >
              {/* The pointer is always over the overlay itself, whose box its place is read in. */}
              <g pointerEvents="none">
                {annotations.map((mark) =>
                  mark.type === "text" ? null : <Mark key={mark.id} mark={mark} />,
                )}
              </g>
            </svg>
            {annotations.map((mark, index) =>
              mark.type === "text" ? (
                <input
                  key={mark.id}
                  aria-label={`Text annotation ${index + 1}`}
                  className="mac-finder-quick-look-text"
                  style={{
                    left: `${50 + mark.offset / 10}%`,
                    top: `${50 + mark.offset / 10}%`,
                    color: mark.color,
                    fontSize: mark.size,
                  }}
                  size={Math.max(mark.text.length, 1)}
                  value={mark.text}
                  readOnly={!marking}
                  onChange={(event) => {
                    const text = event.currentTarget.value;
                    change((current) =>
                      current.map((other) =>
                        other.id === mark.id && other.type === "text" ? { ...other, text } : other,
                      ),
                    );
                  }}
                />
              ) : null,
            )}
          </div>
        </div>
      ) : preview ? (
        <div className="mac-finder-quick-look-file">{preview}</div>
      ) : (
        <div
          className="mac-finder-quick-look-icon"
          aria-busy={file === null || undefined}
          title={file instanceof Error ? file.message : undefined}
        >
          <ItemIcon node={node} size={256} />
        </div>
      )}
    </QuickLookPanel>
  );
}
