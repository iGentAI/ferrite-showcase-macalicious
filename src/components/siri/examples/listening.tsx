"use client";

import { Siri } from "macalicious/siri";
import { useState } from "react";

/**
 * Listening: the orb gives way to a waveform whose height follows `level`. Click the orb, or
 * press Space on it, to stop and start.
 */
export default function Listening() {
  const [listening, setListening] = useState(true);
  return (
    <Siri
      prompt={listening ? "What can I help you with?" : "Click the orb to speak."}
      listening={listening}
      level={0.8}
      onListen={() => setListening((on) => !on)}
      onClose={() => setListening(false)}
      style={{ height: 200 }}
    />
  );
}
