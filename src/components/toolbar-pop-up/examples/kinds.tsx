import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButtonItem } from "macalicious/pop-up-button";
import { ToolbarPopUp, ToolbarPullDown, ToolbarSplitPullDown } from "macalicious/toolbar-pop-up";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;

const rows = (
  <svg viewBox="0 0 14 13" width="14" height="13" aria-hidden="true" focusable="false">
    <path d="M0 .5h14M0 6.5h14M0 12.5h14" stroke="currentColor" />
    <path d="M0 2.5h4v2H0zM5 2.5h4v2H5zM10 2.5h4v2h-4zM0 8.5h4v2H0zM5 8.5h4v2H5zM10 8.5h4v2h-4z" />
  </svg>
);

const pen = (
  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M2 12l1-4 6.5-6.5 3 3L6 11z" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

/** The three kinds: a pull-down with a glyph, a pop-up that shows the choice, and a split button. */
export default function Kinds() {
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "end" }}>
      <div style={cell}>
        <span style={caption}>Pull-down</span>
        <ToolbarPullDown image={rows} aria-label="Group">
          <MenuItem>None</MenuItem>
          <MenuSeparator />
          <MenuItem>Name</MenuItem>
          <MenuItem>Kind</MenuItem>
        </ToolbarPullDown>
      </div>
      <div style={cell}>
        <span style={caption}>Pop-up</span>
        <ToolbarPopUp defaultValue="helvetica" aria-label="Font" style={{ width: 120 }}>
          <PopUpButtonItem value="helvetica">Helvetica</PopUpButtonItem>
          <PopUpButtonItem value="menlo">Menlo</PopUpButtonItem>
          <PopUpButtonItem value="times">Times</PopUpButtonItem>
        </ToolbarPopUp>
      </div>
      <div style={cell}>
        <span style={caption}>Split</span>
        <ToolbarSplitPullDown image={pen} aria-label="Highlight" menuLabel="Highlight colors">
          <MenuItem>Yellow</MenuItem>
          <MenuItem>Green</MenuItem>
          <MenuItem>Blue</MenuItem>
        </ToolbarSplitPullDown>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <ToolbarPullDown image={rows} aria-label="Group, disabled" disabled>
          <MenuItem>None</MenuItem>
        </ToolbarPullDown>
      </div>
    </div>
  );
}
