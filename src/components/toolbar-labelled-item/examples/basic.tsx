import { SystemImage } from "macalicious/system-image";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";

export default function Basic() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <ToolbarLabelledItem label="Reload">
        <ToolbarButton style={{ width: 44 }}>
          <SystemImage name="refresh" />
        </ToolbarButton>
      </ToolbarLabelledItem>
      <ToolbarLabelledItem label="Erase">
        <ToolbarButton style={{ width: 44 }} disabled>
          <SystemImage name="refresh" />
        </ToolbarButton>
      </ToolbarLabelledItem>
    </div>
  );
}
