import { Label } from "macalicious/label";
import { SYSTEM_IMAGE_NAMES, SystemImage } from "macalicious/system-image";

/** Every image at its own size, with its name. */
export default function All() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 88px)",
        gap: "16px 8px",
        color: "var(--mac-color-control-text)",
      }}
    >
      {SYSTEM_IMAGE_NAMES.map((name) => (
        <div
          key={name}
          style={{ display: "grid", gap: 6, justifyItems: "center", alignContent: "end" }}
        >
          <SystemImage name={name} />
          <Label textStyle="small" color="secondary">
            {name}
          </Label>
        </div>
      ))}
    </div>
  );
}
