import { PathBar, PathBarItem } from "macalicious/path-bar";

/** A stand-in icon: a flat 16 pt square, so its pixels are known. */
function Icon() {
  return <span style={{ display: "block", width: 16, height: 16, background: "#808080" }} />;
}

/** A name of a fixed width, so the layout does not depend on the font. */
function Name({ children }: { children: string }) {
  return (
    <span style={{ display: "inline-block", width: 40, overflow: "hidden", verticalAlign: "top" }}>
      {children}
    </span>
  );
}

/**
 * Visual check target: a populated path bar. No reference screenshot shows one (every captured
 * Finder path bar is empty), so the comparison checks pixels of the layout the stylesheet
 * states [provisional]: 8 pt inset, 16 pt icon, 4 pt gap, name, then a 5 by 8 pt chevron with
 * 6 pt either side, and no chevron after the last component.
 *
 * With 40 pt names: icon 8..24, name 28..68, chevron 74..79; name 85..125, chevron 131..136;
 * icon 142..158, name 162..202, nothing after it.
 */
export default function VisualPopulated() {
  return (
    <PathBar style={{ width: 300 }}>
      <PathBarItem icon={<Icon />} onActivate={() => {}}>
        <Name>Disk</Name>
      </PathBarItem>
      <PathBarItem onActivate={() => {}}>
        <Name>Users</Name>
      </PathBarItem>
      <PathBarItem icon={<Icon />}>
        <Name>Docs</Name>
      </PathBarItem>
    </PathBar>
  );
}
