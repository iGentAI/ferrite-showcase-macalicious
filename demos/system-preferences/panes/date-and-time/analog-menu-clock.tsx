"use client";

import { useEffect, useState } from "react";

const HANDS = { hour: 3.6, minute: 5.4 } as const;

/** The clock's face in the menu bar, when the Clock tab says Analog; read every half minute. */
export function AnalogMenuClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const minutes = now.getMinutes();
  const angles = { hour: ((now.getHours() % 12) + minutes / 60) * 30, minute: minutes * 6 };
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" data-menu-clock-face="">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1" />
      {(Object.keys(HANDS) as (keyof typeof HANDS)[]).map((hand) => (
        <line
          key={hand}
          data-hand={hand}
          x1="8"
          y1="8"
          x2="8"
          y2={8 - HANDS[hand]}
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          transform={`rotate(${angles[hand]} 8 8)`}
        />
      ))}
    </svg>
  );
}
