import { Checkbox } from "macalicious/checkbox";
import {
  InspectorPanel,
  InspectorPanelHeader,
  InspectorPanelItem,
  InspectorPanelList,
  InspectorPanelSection,
} from "macalicious/inspector-panel";

/**
 * Visual comparison target: the top of Finder's Info window, from the title bar to the
 * separator under the General section. Reference crop (2x pixels) x=112 y=76 w=530 h=572,
 * i.e. 265 x 286 pt, over the capture's transparent margin (matte white).
 *
 * The proxy icon, the item's icon and the tags field are left out and masked: the icons are
 * Apple artwork and the tags field is a token field. Values are broken where the capture
 * breaks them, because text is set in the fallback font off Apple platforms.
 */
export default function VisualGetInfo() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 265,
        height: 286,
        background: "#ffffff",
      }}
    >
      <InspectorPanel
        title="Aqua and Bondi.pdf Info"
        icon={<span style={{ width: 16, height: 16 }} />}
        height={500}
        style={{ position: "absolute", inset: 0 }}
      >
        <InspectorPanelHeader
          title="Aqua and Bondi.pdf"
          detail="111.6 MB"
          subtitle="Modified: July 14, 2018 at 6:52 PM"
        >
          <div style={{ height: 33 }} />
        </InspectorPanelHeader>
        <InspectorPanelSection title="General:" defaultOpen>
          <InspectorPanelList>
            <InspectorPanelItem label="Kind:">PDF document</InspectorPanelItem>
            <InspectorPanelItem label="Size:">
              111,631,362 bytes (111.6 MB
              <br />
              on disk)
            </InspectorPanelItem>
            <InspectorPanelItem label="Where:">
              Macintosh SSD ▸ Users ▸ shackett
              <br />▸ Documents
            </InspectorPanelItem>
            <InspectorPanelItem label="Created:">December 31, 2016 at 1:17 PM</InspectorPanelItem>
            <InspectorPanelItem label="Modified:">July 14, 2018 at 6:52 PM</InspectorPanelItem>
          </InspectorPanelList>
          <div
            style={{ display: "grid", gap: 6, justifyItems: "start", margin: "14px 0 0 42.5px" }}
          >
            <Checkbox size="small">Stationery pad</Checkbox>
            <Checkbox size="small">Locked</Checkbox>
          </div>
        </InspectorPanelSection>
        <InspectorPanelSection title="More Info:" defaultOpen />
      </InspectorPanel>
    </div>
  );
}
