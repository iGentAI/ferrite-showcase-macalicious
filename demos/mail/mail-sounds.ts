import { playAlert } from "../system-preferences/panes/sound/alert-sounds";
import { alertSoundSettings } from "../system-preferences/setting-effects";

/*
 * Apple's Mail sounds are not part of this project, so each of Mail's own stands on one of the
 * desktop's alert tones, picked so that it differs from the sounds the New messages sound pop-up
 * names itself (Glass, Ping, Pop).
 */
const STAND_INS: Readonly<Record<string, string>> = { "New Messages Sound": "Morse" };
const ACTIONS = { sent: "Bottle", noMail: "Tink" } as const;

/** The sound of General's New messages sound, under the Sound pane's alert volume; None is silent. */
export function playMailSound(choice: unknown): void {
  if (typeof choice !== "string" || choice === "None") return;
  playAlert(STAND_INS[choice] ?? choice, alertSoundSettings().volume);
}

const sounded = new Set<string>();

/** New mail has come in: its sound, once per message however many of this page's viewers see it. */
export function soundNewMail(ids: readonly string[], choice: unknown): void {
  const unheard = ids.filter((id) => !sounded.has(id));
  for (const id of unheard) sounded.add(id);
  if (unheard.length > 0) playMailSound(choice);
}

/** The sound of a sent message or an empty Get Mail, while Play sounds for other mail actions is on. */
export function playMailAction(action: keyof typeof ACTIONS, playSounds: unknown): void {
  if (playSounds === false) return;
  playAlert(ACTIONS[action], alertSoundSettings().volume);
}
