import { Checkbox } from "macalicious/checkbox";
import {
  InspectorPanel,
  InspectorPanelHeader,
  InspectorPanelItem,
  InspectorPanelList,
  InspectorPanelSection,
} from "macalicious/inspector-panel";

/** Stand-in artwork: a document shape, not Apple's icon. */
function DocumentIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 2h13l6 6v22H7z" fill="#ffffff" stroke="#9a9a9a" />
      <path d="M20 2v6h6" fill="#e3e3e3" stroke="#9a9a9a" />
      <rect x="11" y="13" width="11" height="8" fill="#5ba4e6" />
    </svg>
  );
}

export default function Basic() {
  return (
    <InspectorPanel title="Report.pdf Info" icon={<DocumentIcon size={16} />}>
      <InspectorPanelHeader
        icon={<DocumentIcon size={32} />}
        title="Report.pdf"
        detail="2.4 MB"
        subtitle="Modified: Today at 9:41 AM"
      />
      <InspectorPanelSection title="General:" defaultOpen>
        <InspectorPanelList>
          <InspectorPanelItem label="Kind:">PDF document</InspectorPanelItem>
          <InspectorPanelItem label="Size:">2,412,544 bytes (2.4 MB on disk)</InspectorPanelItem>
          <InspectorPanelItem label="Where:">Macintosh HD ▸ Users ▸ Documents</InspectorPanelItem>
          <InspectorPanelItem label="Created:">October 7, 2019 at 9:41 AM</InspectorPanelItem>
        </InspectorPanelList>
        <div style={{ display: "grid", gap: 6, justifyItems: "start", margin: "13px 0 0 43px" }}>
          <Checkbox size="small">Stationery pad</Checkbox>
          <Checkbox size="small">Locked</Checkbox>
        </div>
      </InspectorPanelSection>
      <InspectorPanelSection title="More Info:">
        <InspectorPanelList>
          <InspectorPanelItem label="Pages:">81</InspectorPanelItem>
          <InspectorPanelItem label="Version:">1.4</InspectorPanelItem>
        </InspectorPanelList>
      </InspectorPanelSection>
      <InspectorPanelSection title="Comments:">No comments.</InspectorPanelSection>
    </InspectorPanel>
  );
}
