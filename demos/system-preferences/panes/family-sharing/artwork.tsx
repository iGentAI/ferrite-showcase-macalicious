/*
 * Stand-in picture for the Family Sharing pane: an original drawing in place of Apple's icon.
 * It is decorative: the title under it names the pane.
 */

/** One figure: a head, a body with arms and two legs, `height` points tall, feet at `bottom`. */
function Figure({ x, bottom, height }: { x: number; bottom: number; height: number }) {
  const top = bottom - height;
  const unit = height / 10;
  return (
    <g fill="#ffffff" stroke="#ffffff" strokeLinecap="round">
      <circle cx={x} cy={top + 1.3 * unit} r={1.3 * unit} stroke="none" />
      <path
        d={`M${x - 1.6 * unit} ${top + 3.4 * unit}h${3.2 * unit}v${3.4 * unit}h${-3.2 * unit}z`}
        strokeWidth={unit * 0.6}
        strokeLinejoin="round"
      />
      <path
        d={`M${x - 1.9 * unit} ${top + 3.6 * unit}l${-1.5 * unit} ${2.6 * unit}M${x + 1.9 * unit} ${top + 3.6 * unit}l${1.5 * unit} ${2.6 * unit}`}
        strokeWidth={unit * 0.9}
        fill="none"
      />
      <path
        d={`M${x - 0.95 * unit} ${top + 6.8 * unit}V${bottom - 0.6 * unit}M${x + 0.95 * unit} ${top + 6.8 * unit}V${bottom - 0.6 * unit}`}
        strokeWidth={unit * 1.2}
        fill="none"
      />
    </g>
  );
}

/**
 * A white tile, 112 pt square, with four figures in front of a cloud. The tile is white in both
 * appearances, as the icon is; its shadow is drawn outside the picture's box.
 */
export function FamilyPicture() {
  return (
    <svg
      width="112"
      height="112"
      viewBox="0 0 112 112"
      aria-hidden="true"
      focusable="false"
      style={{ overflow: "visible", filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.3))" }}
    >
      <rect x="0.5" y="0.5" width="111" height="111" rx="12" fill="#ffffff" />
      <circle cx="30" cy="64" r="19" fill="#86d3f8" />
      <path
        d="M30 83h53a19 19 0 0 0 4.2-37.5 26 26 0 0 0-51 3.5A19 19 0 0 0 30 83z"
        fill="#3d9df0"
        opacity="0.9"
      />
      <Figure x={32.5} bottom={76} height={26} />
      <Figure x={48} bottom={77} height={34.5} />
      <Figure x={66.5} bottom={76.5} height={36.5} />
      <Figure x={84} bottom={77.5} height={18.5} />
    </svg>
  );
}
