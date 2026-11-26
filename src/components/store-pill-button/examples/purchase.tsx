"use client";

import { StorePillButton } from "macalicious/store-pill-button";
import { useEffect, useState } from "react";

type Step = "offer" | "confirm" | "downloading" | "open";

/**
 * The purchase sequence the store runs through: the offer, a confirmation, the download, and
 * the installed app. The page keeps the step; the button only shows it.
 */
export default function Purchase() {
  const [step, setStep] = useState<Step>("offer");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (step !== "downloading") return;
    if (progress >= 1) {
      setStep("open");
      setProgress(0);
      return;
    }
    const timer = setTimeout(() => setProgress(Math.min(1, progress + 0.05)), 150);
    return () => clearTimeout(timer);
  }, [step, progress]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {step === "offer" && (
        <StorePillButton onClick={() => setStep("confirm")}>Get</StorePillButton>
      )}
      {step === "confirm" && (
        <StorePillButton variant="filled" onClick={() => setStep("downloading")}>
          Install
        </StorePillButton>
      )}
      {step === "downloading" && (
        <StorePillButton
          progress={progress}
          onClick={() => {
            setProgress(0);
            setStep("offer");
          }}
        >
          Stop
        </StorePillButton>
      )}
      {step === "open" && <StorePillButton onClick={() => setStep("offer")}>Open</StorePillButton>}
      <span aria-live="polite" style={{ font: "var(--mac-font-control-small)" }}>
        {step === "downloading" ? "Downloading" : step === "open" ? "Installed" : ""}
      </span>
    </div>
  );
}
