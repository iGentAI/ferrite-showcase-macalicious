import { CatalinaSpotlight } from "../spotlight";
import { developerItems } from "../spotlight-data";

/**
 * The index of the Dark Aqua capture's Mac, which has a developer's files: they come first,
 * so the top hit for "OS X" is an XML file and the preview is its text. This host keeps the
 * window open whatever it is told.
 */
export default function Developer() {
  return (
    <div
      className="mac-spotlight-app-example-backdrop"
      style={{ boxSizing: "border-box", height: 470, padding: 20, overflow: "hidden" }}
    >
      <CatalinaSpotlight
        open
        items={developerItems}
        defaultQuery="OS X"
        style={{ maxWidth: "100%", marginInline: "auto" }}
      />
    </div>
  );
}
