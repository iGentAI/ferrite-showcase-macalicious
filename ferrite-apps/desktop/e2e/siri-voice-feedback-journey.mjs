#!/usr/bin/env node
// Voice Feedback in System Preferences > Siri: a spoken request is answered aloud while it is On, a typed one never is, and Off
// silences it across a reload. Exits 0 only when every step passed with no console error, page error, failed request or HTTP
// error.
//
// Stand-ins: no microphone or speaker in a headless browser, so a small recognizer stands in for the browser's speech
// recognition and `speechSynthesis.speak` only records what it is given. What this proves is the desktop's decision to speak
// and what it says, not that a person hears it.
//
//   node e2e/siri-voice-feedback-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const ASKED = "What time is it in Paris";

await journey("siri-voice-feedback", async ({ page, base, out, step }) => {
  await page.addInitScript((said) => {
    window.__spoken = [];
    class Recognizer {
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: said }]] });
          this.onend?.();
        }, 50);
      }
      stop() {}
    }
    window.SpeechRecognition = Recognizer;
    window.webkitSpeechRecognition = Recognizer;
    SpeechSynthesis.prototype.speak = function speak(utterance) {
      window.__spoken.push(utterance.text);
    };
  }, ASKED);
  await openDesktop(page, base);

  const spoken = () => page.evaluate(() => window.__spoken);
  const siri = page.getByRole("dialog", { name: "Siri" });
  const answer = page.locator(".mac-siri-demo-reply[data-answer]");
  const open = async () => {
    if (await siri.isVisible().catch(() => false)) return;
    await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
    await siri.waitFor({ timeout: 5_000 });
  };
  const close = async () => {
    await page.keyboard.press("Escape");
    await siri.waitFor({ state: "detached", timeout: 5_000 });
  };
  const speakTo = async () => {
    await open();
    await siri.getByRole("button", { name: "Listen" }).click();
    await page.waitForTimeout(100);
    await answer.waitFor({ timeout: 10_000 });
    return (await answer.innerText()).trim();
  };

  const said = await speakTo();
  const heard = await spoken();
  step(
    "Voice Feedback On: a spoken request is answered aloud, in the words on the screen",
    said !== "" && heard.length === 1 && heard[0] === said,
    JSON.stringify(heard),
  );
  await page.screenshot({ path: path.join(out, "siri-voice-answer.png") });

  const field = siri.getByRole("textbox", { name: "Type to Siri" });
  await field.fill("What time is it in Tokyo");
  await field.press("Enter");
  await answer.getByText(/Tokyo/).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  step("a typed request gets its own answer, in text only", (await spoken()).length === 1);
  await close();

  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 10_000 });
  await prefs.getByRole("button", { name: "Siri", exact: true }).first().click();
  const group = prefs.getByRole("radiogroup", { name: "Voice Feedback:" });
  await group.waitFor({ timeout: 8_000 });
  const saved = nextSave(page, "/api/system-preferences/settings");
  await group.getByRole("radio", { name: "Off" }).click();
  await saved;

  await speakTo();
  step(
    "Voice Feedback Off: the answer is on the screen and nothing is said",
    (await spoken()).length === 1,
  );
  await close();

  await reloadDesktop(page);
  await speakTo();
  step("it stays Off across a reload", (await spoken()).length === 0);
  await close();
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await group.waitFor({ timeout: 10_000 });
  step("and the pane still shows Off", await group.getByRole("radio", { name: "Off" }).isChecked());
  await page.screenshot({ path: path.join(out, "siri-voice-off.png") });
});
