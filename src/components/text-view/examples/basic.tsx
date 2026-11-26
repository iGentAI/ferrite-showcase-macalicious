import { TextView } from "macalicious/text-view";

export default function Basic() {
  return (
    <div style={{ width: 320, height: 96 }}>
      <TextView
        aria-label="Note"
        defaultValue={"Here's to the crazy ones.\nThe misfits. The rebels. The troublemakers."}
      />
    </div>
  );
}
