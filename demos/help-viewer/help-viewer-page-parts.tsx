"use client";

import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { Separator } from "macalicious/separator";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { fitsDesktopValue, useKeptValue } from "../desktop/desktop-kept-value";
import { requestPane } from "../system-preferences/pane-request";
import { actionsOf, type HelpAction } from "./help-viewer-guides";

function act(action: HelpAction) {
  if ("pane" in action) {
    requestPane(action.pane);
    requestDesktopEffects([{ open: "system-preferences" }]);
  } else requestDesktopEffects([{ open: action.app }]);
}

/** The links on a page that open an application or a pane of System Preferences. */
export function PageActions({ topicId }: { topicId: string }) {
  const actions = actionsOf(topicId);
  if (actions.length === 0) return null;
  return (
    <ul className="mac-help-viewer-topic-list">
      {actions.map((action) => (
        <li key={action.label}>
          <Label
            render={<button type="button" />}
            color="link"
            className="mac-help-viewer-action"
            onClick={() => act(action)}
          >
            {action.label}
          </Label>
        </li>
      ))}
    </ul>
  );
}

export type Answers = Readonly<Record<string, "yes" | "no">>;

const NO_ANSWERS: Answers = {};
const readAnswers = new WeakMap<object, Answers>();

/** The answers kept; anything that is not one is left out. */
export function readFeedback(stored: unknown): Answers | undefined {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return undefined;
  const known = readAnswers.get(stored);
  if (known) return known;
  const answers = Object.fromEntries(
    Object.entries(stored).filter(([, answer]) => answer === "yes" || answer === "no"),
  ) as Answers;
  readAnswers.set(stored, answers);
  return answers;
}

/** The answers with a new one, the oldest going first when one desktop value would not hold them. */
export function withAnswer(answers: Answers, page: string, answer: "yes" | "no"): Answers {
  const { [page]: _replaced, ...others } = answers;
  let entries = [...Object.entries(others), [page, answer] as const];
  while (!fitsDesktopValue(Object.fromEntries(entries))) entries = entries.slice(1);
  return Object.fromEntries(entries);
}

/**
 * "Was this page helpful?" under a topic. The real app sends the answer to Apple; here it stays with
 * the person's desktop values, and the reply says so.
 */
export function PageFeedback({ page }: { page: string }) {
  const [answers, setAnswers] = useKeptValue("helpViewer.feedback", readFeedback, NO_ANSWERS);
  const answer = answers[page];
  return (
    <aside className="mac-help-viewer-feedback" aria-label="Feedback">
      <Separator aria-hidden="true" />
      {answer ? (
        <Label role="status" className="mac-help-viewer-feedback-row">
          Thanks. Your answer is kept with your desktop and is not sent anywhere.
        </Label>
      ) : (
        <div className="mac-help-viewer-feedback-row">
          <Label>Was this page helpful?</Label>
          <PushButton size="small" onClick={() => setAnswers(withAnswer(answers, page, "yes"))}>
            Yes
          </PushButton>
          <PushButton size="small" onClick={() => setAnswers(withAnswer(answers, page, "no"))}>
            No
          </PushButton>
        </div>
      )}
    </aside>
  );
}
