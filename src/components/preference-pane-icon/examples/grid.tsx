import {
  PreferencePaneIcon,
  PreferencePaneIconArtwork,
  type PreferencePaneIconArtworkProps,
  PreferencePaneIconGrid,
} from "macalicious/preference-pane-icon";

type Pane = {
  title: string;
  tint: PreferencePaneIconArtworkProps["tint"];
  shape?: PreferencePaneIconArtworkProps["shape"];
  /** Path of a glyph drawn for this example on a 24 x 24 grid. */
  glyph: string;
};

const panes: Pane[] = [
  { title: "General", tint: "blue", glyph: "M6 7h12M6 12h12M6 17h7" },
  { title: "Desktop &\nScreen Saver", tint: "purple", glyph: "M5 6h14v10H5zM9 19h6" },
  { title: "Dock", tint: "graphite", glyph: "M5 16h14M8 12v.01M12 12v.01M16 12v.01" },
  { title: "Mission\nControl", tint: "graphite", glyph: "M5 6h6v5H5zM13 6h6v5h-6zM5 13h14v5H5z" },
  { title: "Siri", tint: "purple", shape: "circle", glyph: "M7 12c2-6 3 6 5 0s3 6 5 0" },
  {
    title: "Spotlight",
    tint: "blue",
    shape: "circle",
    glyph: "M15 15l4 4M16 11a5 5 0 1 1-10 0 5 5 0 0 1 10 0z",
  },
  { title: "Language\n& Region", tint: "blue", glyph: "M7 20V5M7 6h10l-2 3.500 2 3.500H7" },
  { title: "Notifications", tint: "red", glyph: "M6 6h12v9H10l-4 3z" },
  {
    title: "Internet\nAccounts",
    tint: "blue",
    shape: "circle",
    glyph: "M16 12a4 4 0 1 1-1.500-3.100V13a1.500 1.500 0 0 0 3 0v-1a6 6 0 1 0-2.500 4.900",
  },
  {
    title: "Users &\nGroups",
    tint: "gray",
    shape: "circle",
    glyph:
      "M9 11a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5zM4.500 17c0-5 9-5 9 0M16 11a2 2 0 1 0 0-4M15.500 13c2 0 4 1 4 4",
  },
  {
    title: "Accessibility",
    tint: "blue",
    shape: "circle",
    glyph: "M12 6v.01M6 9.500h12M12 9.500V14l-3 5M12 14l3 5",
  },
  { title: "Security\n& Privacy", tint: "gray", glyph: "M5 11l7-6 7 6v8H5zM12 13v3" },
];

/**
 * Part of the System Preferences grid, four columns wide: columns 82 pt apart, rows 91 pt
 * apart, captions broken where System Preferences breaks them. The artwork is the library's
 * stand-in tile with a glyph drawn for this example, not Apple's icons.
 */
export default function Grid() {
  return (
    <PreferencePaneIconGrid columns={4}>
      {panes.map((pane) => (
        <PreferencePaneIcon key={pane.title} title={pane.title}>
          <PreferencePaneIconArtwork tint={pane.tint} shape={pane.shape}>
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d={pane.glyph} />
            </svg>
          </PreferencePaneIconArtwork>
        </PreferencePaneIcon>
      ))}
    </PreferencePaneIconGrid>
  );
}
