import { type ComponentProps, type ReactNode, useId } from "react";

/*
 * Stand-ins for the pane's pictures: original drawings in place of Apple's emblem and account
 * icons, and each provider's name set in the system font in place of its logo. No provider's
 * wordmark or colours are reproduced; a stand-in has the size of the logo it replaces, so the
 * rows keep their balance.
 */

const CLOUD = "M7 17.5a4 4 0 0 1-.6-7.95 5.5 5.5 0 0 1 10.7-1.2A4.6 4.6 0 0 1 17.4 17.5z";

/** A white tile with a blue cloud, drawn on a 24 pt square. */
function CloudTile() {
  return (
    <>
      <rect x="0.5" y="0.5" width="23" height="23" rx="3.5" fill="#ffffff" stroke="#c8c8c8" />
      <path d={CLOUD} fill="#3d9df5" />
    </>
  );
}

/** The pane's emblem: an at sign on a blue disc, 36 pt across. */
export function AtArtwork() {
  const fill = useId();
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#35b9fb" />
          <stop offset="1" stopColor="#0a6fe8" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="18" r="18" fill={`url(#${fill})`} />
      <g fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="18" cy="18" r="4.6" />
        <path d="M22.6 13.4v6.1a3 3 0 0 0 6 0V18a10.6 10.6 0 1 0-4.6 8.8" />
      </g>
    </svg>
  );
}

/** The picture of the iCloud account in the list: the cloud tile, 25 pt wide. */
export function CloudAccountPicture(props: ComponentProps<"svg">) {
  return (
    <svg
      width="25"
      height="25.5"
      viewBox="0 0 24 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <CloudTile />
    </svg>
  );
}

/** The picture of the Game Center account in the list: four coloured discs, 28.5 pt wide. */
export function GamesAccountPicture(props: ComponentProps<"svg">) {
  return (
    <svg
      width="28.5"
      height="29.5"
      viewBox="0 0 28.5 29.5"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="9.5" cy="10" r="9.5" fill="#35b4f6" />
      <circle cx="19.5" cy="8.5" r="8" fill="#f6c431" />
      <circle cx="20" cy="20.5" r="8.5" fill="#f0457e" />
      <circle cx="8.5" cy="22.5" r="6.5" fill="#8a4de0" />
    </svg>
  );
}

interface WordmarkProps {
  /** Size of the logo the stand-in replaces, in points. */
  width: number;
  height: number;
  /** The provider's name. */
  name: string;
  /** Where the name starts, when a tile precedes it. */
  x?: number;
  /** The baseline of the name, from the top of the box. */
  baseline: number;
  fontSize: number;
  fontWeight?: number;
  /** A fill other than the text colour of the row. */
  fill?: string;
  /** A tile before the name. */
  children?: ReactNode;
}

/** A provider's name in the system font, stretched to the width of the logo it stands in for. */
function Wordmark({
  width,
  height,
  name,
  x = 0,
  baseline,
  fontSize,
  fontWeight = 400,
  fill = "currentColor",
  children,
}: WordmarkProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      aria-hidden="true"
      focusable="false"
    >
      {children}
      <text
        x={x}
        y={baseline}
        fontSize={fontSize}
        fontWeight={fontWeight}
        textLength={width - x}
        lengthAdjust="spacingAndGlyphs"
        fill={fill}
      >
        {name}
      </text>
    </svg>
  );
}

/** iCloud: the cloud tile and the name, 122 x 24 pt. */
export function CloudLogo() {
  return (
    <Wordmark width={122} height={24} name="iCloud" x={32} baseline={22.5} fontSize={30}>
      <CloudTile />
    </Wordmark>
  );
}

/** Exchange: a blue tile with an envelope and the name in the same blue, 150.5 x 33 pt. */
export function ExchangeLogo() {
  return (
    <Wordmark
      width={150.5}
      height={33}
      name="Exchange"
      x={41}
      baseline={26}
      fontSize={28}
      fill="#1a73c8"
    >
      <rect x="0" y="2" width="32" height="29" rx="3" fill="#1a73c8" />
      <path d="M6 10h20v13H6zM6 10l10 8 10-8" fill="none" stroke="#ffffff" strokeWidth="1.8" />
    </Wordmark>
  );
}

/** Google: the name alone, 116 x 36.5 pt with its descender. */
export function GoogleLogo() {
  return <Wordmark width={116} height={36.5} name="Google" baseline={27.5} fontSize={36} />;
}

/** Yahoo: the name alone in capitals, 95 x 22 pt. */
export function YahooLogo() {
  return <Wordmark width={95} height={22} name="YAHOO!" baseline={22} fontSize={30} />;
}

/** AOL: the name alone, bold, 62.5 x 25 pt. */
export function AolLogo() {
  return (
    <Wordmark width={62.5} height={25} name="Aol." baseline={25} fontSize={34} fontWeight={700} />
  );
}
