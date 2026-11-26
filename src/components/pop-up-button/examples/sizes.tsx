import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

const row = { display: "flex", alignItems: "center", gap: 8 } as const;

/** The three control sizes. The menu takes the font of its button. */
export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size} style={row}>
          <PopUpButton
            size={size}
            defaultValue="letter"
            aria-label={`Paper size, ${size}`}
            style={{ width: 130 }}
          >
            <PopUpButtonItem value="letter">US Letter</PopUpButtonItem>
            <PopUpButtonItem value="legal">US Legal</PopUpButtonItem>
            <PopUpButtonItem value="a4">A4</PopUpButtonItem>
          </PopUpButton>
        </div>
      ))}
    </div>
  );
}
