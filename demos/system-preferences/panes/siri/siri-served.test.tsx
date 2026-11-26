import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemPreferences } from "../../system-preferences";

const popUp = (name: string) => screen.getByRole("combobox", { name });

function voicesAre(...langs: string[]) {
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => langs.map((lang) => ({ lang })),
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

describe("Siri pane on the served desktop", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("offers the accents this browser has a voice for, and keeps the one chosen", async () => {
    voicesAre("en-GB", "en_US", "fr-FR");
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="siri" />);
    await user.click(popUp("Siri Voice:"));
    const offered = (await screen.findAllByRole("option")).map((one) => one.textContent);
    expect(offered).toEqual(["American", "British"]);
    await user.click(screen.getByRole("option", { name: "British" }));
    expect(popUp("Siri Voice:")).toHaveTextContent("British");
  });

  it("dims the voice, saying why, when the browser has none", () => {
    voicesAre();
    render(<SystemPreferences defaultPane="siri" />);
    expect(popUp("Siri Voice:")).toBeDisabled();
    expect(popUp("Siri Voice:")).toHaveAttribute(
      "title",
      "This browser offers web pages no voices, so Siri cannot speak here.",
    );
  });

  it("lets the language be chosen among those it can name, and says answers stay English", async () => {
    voicesAre("en-US", "de-DE");
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="siri" />);
    await user.click(popUp("Language:"));
    expect((await screen.findAllByRole("option")).map((one) => one.textContent)).toEqual([
      "English (United Kingdom)",
      "English (United States)",
      "French (France)",
      "German (Germany)",
      "Japanese",
      "Spanish (Spain)",
    ]);
    await user.click(screen.getByRole("option", { name: "German (Germany)" }));
    expect(popUp("Language:")).toHaveTextContent("German (Germany)");
    expect(
      screen.getByText("It understands requests and writes its answers in English."),
    ).toBeTruthy();
    expect(popUp("Siri Voice:")).toBeDisabled();
  });
});
