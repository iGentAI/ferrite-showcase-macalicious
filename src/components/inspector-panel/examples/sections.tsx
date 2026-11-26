import {
  InspectorPanel,
  InspectorPanelItem,
  InspectorPanelList,
  InspectorPanelSection,
} from "macalicious/inspector-panel";
import { useState } from "react";

/**
 * The inspector kind: titled with a noun, following a selection, with a controlled section, a
 * disabled one, and two lists whose label columns are lined up with the label-width variable.
 */
export default function Sections() {
  const [open, setOpen] = useState(true);
  return (
    <InspectorPanel
      title="Info"
      style={{ ["--mac-inspector-panel-label-width" as string]: "92px" }}
    >
      <InspectorPanelSection title="Dimensions:" open={open} onOpenChange={setOpen}>
        <InspectorPanelList>
          <InspectorPanelItem label="Width:">1024 pixels</InspectorPanelItem>
          <InspectorPanelItem label="Height:">748 pixels</InspectorPanelItem>
        </InspectorPanelList>
      </InspectorPanelSection>
      <InspectorPanelSection title="More Info:" defaultOpen>
        <InspectorPanelList>
          <InspectorPanelItem label="Content Creator:">Preview</InspectorPanelItem>
          <InspectorPanelItem label="Security:">None</InspectorPanelItem>
        </InspectorPanelList>
      </InspectorPanelSection>
      <InspectorPanelSection title="Sharing & Permissions:" disabled>
        Not available for this selection.
      </InspectorPanelSection>
    </InspectorPanel>
  );
}
