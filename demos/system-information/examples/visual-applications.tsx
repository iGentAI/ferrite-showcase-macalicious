import { SystemInformation } from "../system-information";

/**
 * Visual check target for a state no screenshot shows: a report that lists things, here
 * Software > Applications, in the captured 751 x 520 pt frame over a white matte.
 */
export default function VisualApplications() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 751,
        height: 520,
        background: "#ffffff",
      }}
    >
      <SystemInformation
        defaultSelectedId="software/applications"
        defaultExpanded={["software"]}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
