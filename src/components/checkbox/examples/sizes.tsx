import { Checkbox } from "macalicious/checkbox";

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size} style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Checkbox size={size} defaultChecked>
            On
          </Checkbox>
          <Checkbox size={size}>Off</Checkbox>
          <Checkbox size={size} indeterminate>
            Mixed
          </Checkbox>
          <Checkbox size={size} disabled defaultChecked>
            Disabled
          </Checkbox>
        </div>
      ))}
    </div>
  );
}
