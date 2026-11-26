import { SectionHeader, SectionHeaderAction } from "macalicious/section-header";

/**
 * Visual comparison target: the group headers of Finder's grouped search results (Spotlight
 * "Show all in Finder").
 *
 * `#pinned`: the leading 300 pt of the pinned "Folders" header. Reference crop (2x pixels)
 * x=442 y=250 w=600 h=64, i.e. 300 x 32 pt: the 31 pt band and the point of separator under it.
 *
 * `#plain`: the trailing 300 pt of the "Documents" header with its "Show All (553)" action.
 * Reference crop 600 x 64 px at y=592, starting 600 px before the view's right edge (x=1770 in
 * the light capture, x=1424 in the dark one), i.e. 300 x 32 pt: the rule and the 31 pt bar,
 * on the content background. The title is outside this crop; `#plain-start` is the leading
 * 300 pt of the same header (x=442).
 */
export default function VisualFinderGroups() {
  const content = {
    width: 300,
    background: "light-dark(#ffffff, #1e1f21)",
    contain: "paint",
  } as const;
  const action = <SectionHeaderAction>Show All (553)</SectionHeaderAction>;
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <div id="pinned" style={{ width: 300, height: 32, contain: "paint" }}>
        <SectionHeader variant="pinned" style={{ width: 600 }}>
          Folders
        </SectionHeader>
      </div>
      <div id="plain-start" style={{ ...content, height: 32 }}>
        <SectionHeader accessory={action} style={{ width: 600 }}>
          Documents
        </SectionHeader>
      </div>
      <div
        id="plain"
        style={{ ...content, height: 32, display: "flex", justifyContent: "flex-end" }}
      >
        <SectionHeader accessory={action} style={{ flex: "none", width: 600 }}>
          Documents
        </SectionHeader>
      </div>
    </div>
  );
}
