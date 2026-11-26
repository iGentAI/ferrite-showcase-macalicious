import type { ReactNode } from "react";

/*
 * The desktop's pictures. Apple's application icons, volume icons, system template images and
 * desktop pictures are not part of the library. Application, folder, volume and document icons
 * are original generated artwork in icons/ (one <id>.webp each, 256 px square); every picture
 * without one is drawn here as a neutral shape of the size of the artwork it replaces.
 */

/** The generated icons by id: the file name without its extension. */
const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./icons/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([file, url]) => [file.slice("./icons/".length, -".webp".length), url]),
);

/** The generated icon for an id, if there is one, filling the box it is put in. */
function Icon({ id, fallback }: { id: string; fallback: ReactNode }) {
  const url = ICONS[id];
  if (!url) return fallback;
  return <img src={url} alt="" draggable={false} style={FILL} />;
}

/** Whether there is a generated icon for an id. */
export const hasIcon = (id: string) => id in ICONS;

/** A hue for an application, the same every time, from its id. */
export function hueOf(id: string): number {
  let hash = 7;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return hash;
}

/** The initials of a name: "Activity Monitor" is "AM", "Notes" is "N". */
const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

const FILL = { display: "block", width: "100%", height: "100%" } as const;

/**
 * An application's tile: a rounded square in the application's hue with its initials. It
 * fills the box it is put in.
 */
export function AppTile({ id, name }: { id: string; name: string }) {
  return <Icon id={id} fallback={<InitialsTile id={id} name={name} />} />;
}

function InitialsTile({ id, name }: { id: string; name: string }) {
  const hue = hueOf(id);
  return (
    <svg viewBox="0 0 64 64" style={FILL} aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="13" fill={`hsl(${hue} 62% 46%)`} />
      <path
        d="M17 4h30a13 13 0 0 1 13 13v15H4V17A13 13 0 0 1 17 4Z"
        fill="#ffffff"
        fillOpacity="0.16"
      />
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fontSize="24"
        fontWeight="600"
        fill="#ffffff"
        fillOpacity="0.92"
      >
        {initials(name)}
      </text>
    </svg>
  );
}

/** Finder's tile: a two-tone square. */
export function FinderTile() {
  return <Icon id="finder" fallback={<FinderDrawing />} />;
}

function FinderDrawing() {
  return (
    <svg viewBox="0 0 64 64" style={FILL} aria-hidden="true">
      <rect x="4" y="6" width="56" height="52" rx="9" fill="#eaf1f8" />
      <path d="M13 6h19v52H13a9 9 0 0 1-9-9V15a9 9 0 0 1 9-9Z" fill="#3d8fe0" />
      <path
        d="M18 42c8 6 20 6 28 0"
        fill="none"
        stroke="#1d2b3a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The tile of a minimized window: a small window in its application's hue, badged with the
 * application's icon at its lower right as Catalina's Dock does.
 */
export function MiniWindowTile({ app }: { app: string }) {
  const hue = hueOf(app);
  const badge = ICONS[app];
  return (
    <svg viewBox="0 0 64 64" style={FILL} aria-hidden="true">
      <rect x="6" y="13" width="52" height="38" rx="3" fill="#ececec" stroke="#8e8e93" />
      <path d="M6 16a3 3 0 0 1 3-3h46a3 3 0 0 1 3 3v5H6Z" fill={`hsl(${hue} 35% 70%)`} />
      <circle cx="11" cy="17" r="1.5" fill="#ff5f57" />
      <circle cx="16" cy="17" r="1.5" fill="#febc2e" />
      <circle cx="21" cy="17" r="1.5" fill="#28c840" />
      {badge ? <image href={badge} x="38" y="38" width="26" height="26" /> : null}
    </svg>
  );
}

/** The Downloads stack's tile: a folder. */
export function FolderTile() {
  return <Icon id="downloads-folder" fallback={<FolderDrawing />} />;
}

function FolderDrawing() {
  return (
    <svg viewBox="0 0 64 64" style={FILL} aria-hidden="true">
      <path
        d="M6 16a4 4 0 0 1 4-4h14l6 6h24a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z"
        fill="#58aee8"
      />
      <path d="M6 24h52v26a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" fill="#7cc4f2" />
      <path
        d="M32 30v12m-6-5 6 6 6-6"
        fill="none"
        stroke="#2f78b4"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The Trash: an empty basket, or a full one. */
export function TrashTile({ full = false }: { full?: boolean }) {
  return <Icon id={full ? "trash-full" : "trash-empty"} fallback={<TrashDrawing />} />;
}

function TrashDrawing() {
  return (
    <svg viewBox="0 0 64 64" style={FILL} aria-hidden="true">
      <path
        d="M14 12h36l-4 44H18Z"
        fill="#e6e8eb"
        fillOpacity="0.85"
        stroke="#9aa0a8"
        strokeWidth="1.5"
      />
      <path d="M22 14l3 40M32 14v40M42 14l-3 40" stroke="#b4bac2" strokeWidth="1.5" />
      <ellipse cx="32" cy="12" rx="18" ry="3" fill="#f4f5f7" stroke="#9aa0a8" strokeWidth="1.5" />
    </svg>
  );
}

/** A volume on the desktop: the internal disk, or an external backup disk. */
export function DriveIcon({ external = false }: { external?: boolean }) {
  return (
    <span style={{ display: "block", width: 64, height: 64 }}>
      <Icon id={external ? "drive-external" : "drive-internal"} fallback={<DriveDrawing />} />
    </span>
  );
}

function DriveDrawing() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <rect x="6" y="14" width="52" height="36" rx="6" fill="#d9dde2" stroke="#8a9099" />
      <path d="M6 40h52" stroke="#aab0b8" />
      <circle cx="49" cy="45" r="2" fill="#57c038" />
    </svg>
  );
}

/** What a file holds, which picks its generated icon. */
export type FileKind = "document" | "image" | "pdf";

const FILE_ICON: Record<FileKind, string> = {
  document: "document",
  image: "image-document",
  pdf: "pdf-document",
};

/**
 * A file on the desktop or in a stack: the generated icon of its kind, or a sheet in a hue
 * where there is none.
 */
export function FileIcon({ hue, kind = "document" }: { hue: number; kind?: FileKind }) {
  return <Icon id={FILE_ICON[kind]} fallback={<FileDrawing hue={hue} />} />;
}

function FileDrawing({ hue }: { hue: number }) {
  return (
    <svg viewBox="0 0 64 64" style={FILL} aria-hidden="true">
      <rect x="12" y="6" width="40" height="52" rx="2" fill="#fbfbfb" stroke="#a8adb5" />
      <rect x="17" y="12" width="30" height="22" fill={`hsl(${hue} 55% 62%)`} />
      <path d="M17 41h30M17 46h30M17 51h18" stroke="#c2c6cc" strokeWidth="2" />
    </svg>
  );
}

/** A stand-in for a system template image, with the size of its ink box in the screenshots. */
function Glyph({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** The mark of the Apple menu: an ellipse with the mark's ink box, 12.5 by 15.5 pt. */
export function MarkGlyph() {
  return (
    <svg width="15" height="20" viewBox="0 0 15 20" fill="currentColor" aria-hidden="true">
      <ellipse cx="7.25" cy="8.75" rx="6.25" ry="7.75" />
    </svg>
  );
}

export function TimeMachineGlyph() {
  return (
    <Glyph width={18.5} height={16}>
      <circle cx="9.25" cy="8" r="7" />
      <path d="M9.25 4v4l3 2" />
    </Glyph>
  );
}

/** The keychain's padlock, its shackle lifted while the keychain is unlocked. */
export function LockGlyph({ open }: { open: boolean }) {
  return (
    <Glyph width={14} height={16}>
      <rect x="2" y="7.5" width="10" height="8" rx="1.5" fill="currentColor" stroke="none" />
      <path d={open ? "M4 4a3 3 0 0 1 6 0v1" : "M4 7.5V4a3 3 0 0 1 6 0v3.5"} />
    </Glyph>
  );
}

export function WiFiGlyph() {
  return (
    <Glyph width={20} height={14.5}>
      <path d="M1 5a13 13 0 0 1 18 0L10 14Z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function AirPlayGlyph() {
  return (
    <Glyph width={18} height={14}>
      <rect x="0.5" y="0.5" width="17" height="10" rx="1.5" />
      <path d="M5 14l4-4 4 4Z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function BatteryGlyph() {
  return (
    <Glyph width={22.5} height={12}>
      <rect x="0.5" y="0.5" width="19" height="11" rx="2.5" />
      <rect x="2" y="2" width="16" height="8" rx="1" fill="currentColor" stroke="none" />
      <rect x="21" y="4" width="1.5" height="4" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function SpotlightGlyph() {
  return (
    <Glyph width={13.5} height={13.5}>
      <circle cx="5.5" cy="5.5" r="4.5" strokeWidth="1.5" />
      <path d="m9 9 4 4" strokeWidth="1.5" />
    </Glyph>
  );
}

export function SiriGlyph() {
  return (
    <Glyph width={16} height={16}>
      <circle cx="8" cy="8" r="8" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function NotificationCenterGlyph() {
  return (
    <Glyph width={18} height={10}>
      <path d="M0 1h18M0 5h18M0 9h18" strokeWidth="2" />
    </Glyph>
  );
}
