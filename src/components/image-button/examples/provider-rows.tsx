import { ImageButton } from "macalicious/image-button";
import { useState } from "react";

const providers = [
  { name: "Cloud", color: "#4a9df8", width: 92, height: 26 },
  { name: "Exchange", color: "#2f6fc4", width: 118, height: 32 },
  { name: "Mail", color: "#e0503e", width: 104, height: 36 },
];

function Logo({ color, width, height }: { color: string; width: number; height: number }) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      focusable="false"
    >
      <rect width={width} height={height} rx={height / 2} fill={color} />
    </svg>
  );
}

const divider = { height: 2, background: "var(--mac-color-separator)" } as const;

/**
 * The row layout: a list of account providers as in Internet Accounts. Each row is the full
 * width of the list and 54 pt tall, with its logo centred; the last row has a title instead.
 * The list, not the button, draws the 2 pt dividers. The logos are stand-ins.
 */
export default function ProviderRows() {
  const [chosen, setChosen] = useState("Choose an account type.");
  return (
    <div style={{ display: "grid", gap: 8, width: 300, font: "var(--mac-font-body)" }}>
      <div style={{ background: "var(--mac-color-group-background)" }}>
        {providers.map((provider) => (
          <div key={provider.name}>
            <ImageButton
              layout="row"
              aria-label={provider.name}
              onClick={() => setChosen(`${provider.name} chosen.`)}
            >
              <Logo {...provider} />
            </ImageButton>
            <div style={divider} />
          </div>
        ))}
        <ImageButton layout="row" onClick={() => setChosen("Other account chosen.")}>
          Add Other Account…
        </ImageButton>
      </div>
      <output style={{ color: "var(--mac-color-label-secondary)" }}>{chosen}</output>
    </div>
  );
}
