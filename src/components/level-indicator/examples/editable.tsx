import { LevelIndicator } from "macalicious/level-indicator";
import { useId, useState } from "react";

/**
 * An editable rating and an editable capacity. Click or drag along the indicator, or focus it
 * and use the arrow keys, Home and End. The rating is controlled; the capacity keeps its own
 * value.
 */
export default function Editable() {
  const [rating, setRating] = useState(3);
  const ratingId = useId();
  const volumeId = useId();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 160px",
        gap: "12px 8px",
        alignItems: "center",
        font: "var(--mac-font-body)",
      }}
    >
      <span id={ratingId}>Rating:</span>
      <div>
        <LevelIndicator
          variant="rating"
          editable
          value={rating}
          onValueChange={setRating}
          max={5}
          aria-labelledby={ratingId}
          getAriaValueText={(_, value) => `${value} of 5 stars`}
        />
      </div>
      <span id={volumeId}>Alert volume:</span>
      <LevelIndicator
        variant="discrete"
        editable
        defaultValue={6}
        max={10}
        name="alert-volume"
        aria-labelledby={volumeId}
      />
    </div>
  );
}
