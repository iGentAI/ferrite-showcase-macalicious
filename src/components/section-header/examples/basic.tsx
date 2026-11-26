import { SectionHeader, SectionHeaderAction } from "macalicious/section-header";

export default function Basic() {
  return (
    <div style={{ width: 420, background: "var(--mac-color-control-background)" }}>
      <SectionHeader accessory={<SectionHeaderAction>Show All (553)</SectionHeaderAction>}>
        Documents
      </SectionHeader>
    </div>
  );
}
