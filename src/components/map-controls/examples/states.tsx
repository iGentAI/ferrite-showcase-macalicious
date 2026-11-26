import {
  MapButton,
  MapCompass,
  MapTypeControl,
  MapTypeOption,
  MapZoomControl,
} from "macalicious/map-controls";

const row = { display: "flex", alignItems: "center", gap: 16 } as const;

/** Each control as shown and with what it has disabled; the last compass is turned east up. */
export default function States() {
  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        padding: 16,
        background: "light-dark(#f9f5ed, #2b2d2f)",
      }}
    >
      <div style={row}>
        <MapZoomControl />
        <MapZoomControl aria-label="Zoom, at the closest" zoomInDisabled />
        <MapButton chevron>Show</MapButton>
        <MapButton chevron disabled>
          Show
        </MapButton>
      </div>
      <div style={row}>
        <MapCompass />
        <MapCompass aria-label="Compass, 3D on" defaultPitched />
        <MapCompass aria-label="Compass, 3D not offered" pitchDisabled />
        <MapCompass aria-label="Compass, plain" hidePitch />
        <MapCompass aria-label="Compass, east up" heading={90} />
      </div>
      <div style={row}>
        <MapTypeControl defaultValue="hybrid" aria-label="Map type">
          <MapTypeOption value="map">Map</MapTypeOption>
          <MapTypeOption value="hybrid">Hybrid</MapTypeOption>
          <MapTypeOption value="satellite">Satellite</MapTypeOption>
        </MapTypeControl>
      </div>
    </div>
  );
}
