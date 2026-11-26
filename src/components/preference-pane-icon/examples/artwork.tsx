import {
  PreferencePaneIconArtwork,
  type PreferencePaneIconArtworkProps,
} from "macalicious/preference-pane-icon";

const tints: NonNullable<PreferencePaneIconArtworkProps["tint"]>[] = [
  "blue",
  "gray",
  "graphite",
  "green",
  "orange",
  "purple",
  "red",
  "white",
];

/** The stand-in artwork in both shapes and every tint. */
export default function Artwork() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 37px)", gap: 12 }}>
      {tints.map((tint) => (
        <PreferencePaneIconArtwork key={tint} tint={tint} />
      ))}
      {tints.map((tint) => (
        <PreferencePaneIconArtwork key={tint} tint={tint} shape="circle" />
      ))}
    </div>
  );
}
