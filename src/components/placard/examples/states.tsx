import { Placard, PlacardButton, PlacardLabel } from "macalicious/placard";

/** The states of a placard button, pinned with `data-force`, and the small size. */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <Placard aria-label="States">
        <PlacardButton popUp>Normal</PlacardButton>
        <PlacardButton popUp data-force="pressed">
          Pressed
        </PlacardButton>
        <PlacardButton popUp data-force="focus">
          Focused
        </PlacardButton>
        <PlacardButton popUp disabled>
          Disabled
        </PlacardButton>
        <PlacardLabel>Label</PlacardLabel>
      </Placard>
      <Placard size="small" aria-label="Small">
        <PlacardButton popUp>Small</PlacardButton>
        <PlacardLabel>Page 3 of 12</PlacardLabel>
      </Placard>
    </div>
  );
}
