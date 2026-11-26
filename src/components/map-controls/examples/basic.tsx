import {
  MapButton,
  MapCompass,
  MapControls,
  MapTypeControl,
  MapTypeOption,
  MapZoomControl,
} from "macalicious/map-controls";

function LocationGlyph() {
  return (
    <svg viewBox="0 0 15 15" width="15" height="15" aria-hidden="true" focusable="false">
      <path
        d="M12.5 2.5 2.5 6.8 7 8l1.2 4.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Basic() {
  return (
    <div
      style={{
        position: "relative",
        width: 420,
        height: 180,
        background: "light-dark(#f9f5ed, #2b2d2f)",
      }}
    >
      <MapControls placement="bottom-leading" aria-label="Map type">
        <MapTypeControl defaultValue="map" aria-label="Map type">
          <MapTypeOption value="map">Map</MapTypeOption>
          <MapTypeOption value="hybrid">Hybrid</MapTypeOption>
          <MapTypeOption value="satellite">Satellite</MapTypeOption>
        </MapTypeControl>
      </MapControls>
      <MapControls aria-label="Map controls">
        <MapButton variant="rounded" aria-label="Show current location">
          <LocationGlyph />
        </MapButton>
        <MapControls orientation="vertical" placement="none" aria-label="Compass and zoom">
          <MapCompass />
          <MapZoomControl />
        </MapControls>
      </MapControls>
    </div>
  );
}
