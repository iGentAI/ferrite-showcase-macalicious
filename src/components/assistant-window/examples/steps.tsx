import {
  AssistantWindow,
  AssistantWindowActions,
  AssistantWindowContent,
  AssistantWindowHeading,
  AssistantWindowText,
} from "macalicious/assistant-window";
import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { ProgressBar } from "macalicious/progress-bar";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

const STEPS = ["Introduction", "Select Tasks", "Erasing"] as const;

/**
 * Three steps driven by the buttons: text, a choice of tasks, and progress. Go Back appears
 * from the second step on, and Escape goes back too. Continue is the default button here, so
 * Return activates it.
 */
export default function Steps() {
  const [step, setStep] = useState(0);
  const back = () => setStep(Math.max(0, step - 1));
  return (
    <AssistantWindow title="Setup Assistant" width={560} height={320} onCancel={back}>
      <AssistantWindowHeading id="assistant-steps-step">{STEPS[step]}</AssistantWindowHeading>
      {step === 0 ? (
        <AssistantWindowText aria-labelledby="assistant-steps-step">
          <p>This assistant prepares a second disk for your backups.</p>
          <p>Nothing is changed until the last step.</p>
        </AssistantWindowText>
      ) : step === 1 ? (
        <AssistantWindowContent style={{ display: "grid", alignContent: "start", gap: 8 }}>
          <Checkbox defaultChecked>Erase the disk</Checkbox>
          <Checkbox defaultChecked>Encrypt the backups</Checkbox>
        </AssistantWindowContent>
      ) : (
        <AssistantWindowContent style={{ display: "grid", alignContent: "center", gap: 8 }}>
          <Label id="assistant-steps-progress">Erasing “Backup”…</Label>
          <ProgressBar aria-labelledby="assistant-steps-progress" value={40} />
        </AssistantWindowContent>
      )}
      <AssistantWindowActions leading={<PushButton>Open Help</PushButton>}>
        {step > 0 ? <PushButton onClick={back}>Go Back</PushButton> : null}
        <DefaultButton
          disabled={step === STEPS.length - 1}
          onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
        >
          Continue
        </DefaultButton>
      </AssistantWindowActions>
    </AssistantWindow>
  );
}
