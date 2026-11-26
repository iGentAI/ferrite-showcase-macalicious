import { AboutThisMac } from "../about-this-mac";

/**
 * The window opened on its Storage pane: the startup disk, what is free, the capacity bar and
 * the categories with their sizes. No reference screenshot shows this pane.
 */
export default function Storage() {
  return (
    <div style={{ display: "grid", justifyItems: "start", overflowX: "auto" }}>
      <AboutThisMac defaultTab="storage" />
    </div>
  );
}
