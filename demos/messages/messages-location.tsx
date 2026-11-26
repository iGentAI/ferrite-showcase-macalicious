"use client";

import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

/** Why Send My Current Location is dimmed. */
export const NO_LOCATION = "This browser cannot tell where you are.";

/** What is said when the browser gives no position. */
export const LOCATION_REFUSED =
  "Your location could not be read: the browser refused to give it, or could not find it.";

/** The message a position makes: a link any reader can open. */
export const locationMessage = (latitude: number, longitude: number) =>
  `My current location: https://maps.apple.com/?ll=${latitude.toFixed(5)},${longitude.toFixed(5)}`;

/** Details > Send My Current Location: asks the browser where the person is, and sends that. */
export function SendLocationButton({ onSend }: { onSend: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "asking" | "refused">("idle");
  const located = typeof navigator !== "undefined" && "geolocation" in navigator;
  return (
    <>
      <PushButton
        size="small"
        disabled={!located || state === "asking"}
        focusableWhenDisabled
        title={located ? undefined : NO_LOCATION}
        onClick={() => {
          setState("asking");
          navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
              setState("idle");
              onSend(locationMessage(coords.latitude, coords.longitude));
            },
            () => setState("refused"),
          );
        }}
      >
        Send My Current Location
      </PushButton>
      {state === "refused" ? (
        <Label textStyle="small" color="secondary" role="status">
          {LOCATION_REFUSED}
        </Label>
      ) : null}
    </>
  );
}
