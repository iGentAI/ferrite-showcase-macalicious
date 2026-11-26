import { ProgressBar } from "macalicious/progress-bar";
import { useEffect, useState } from "react";

/**
 * A task that reports its progress. The fill follows each new value over a quarter of a
 * second; with reduced motion it jumps.
 */
export default function Live() {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setValue((current) => (current >= 100 ? 0 : Math.min(100, current + 12)));
    }, 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ width: 300 }}>
      <ProgressBar
        value={value}
        aria-label="Copying “Movies” to “Backup”"
        getAriaValueText={(formatted) => `${formatted} copied`}
      />
    </div>
  );
}
