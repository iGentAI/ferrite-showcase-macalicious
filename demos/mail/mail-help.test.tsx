import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MAIL_HELP_UNAVAILABLE, MailPreferences } from "./mail-preferences";

// The Preferences window's Help buttons had no action: pressed, nothing happened and nothing said why. The served
// desktop has no help book for Mail, so it passes the reason as `helpUnavailable` and the buttons are dimmed and say
// so, in every pane. Without a host's reason the component draws them enabled, as the reference screenshots show.

const dimmed = (element: HTMLElement) =>
  element.getAttribute("aria-disabled") === "true" || element.hasAttribute("disabled");

const PANES = ["General", "Accounts", "Junk Mail", "Viewing"];

describe("Mail Preferences' Help button", () => {
  it("is unavailable and says why, in every pane, when the host gives a reason", async () => {
    const user = userEvent.setup();
    render(<MailPreferences helpUnavailable={MAIL_HELP_UNAVAILABLE} />);
    for (const pane of PANES) {
      await user.click(screen.getByRole("tab", { name: pane }));
      const help = screen.getByRole("button", { name: "Help" });
      expect(dimmed(help)).toBe(true);
      expect(help.getAttribute("title")).toBe(MAIL_HELP_UNAVAILABLE);
    }
  });

  it("is drawn enabled, as captured, without a host's reason", async () => {
    const user = userEvent.setup();
    render(<MailPreferences />);
    for (const pane of PANES) {
      await user.click(screen.getByRole("tab", { name: pane }));
      const help = screen.getByRole("button", { name: "Help" });
      expect(dimmed(help)).toBe(false);
      expect(help.getAttribute("title")).toBeNull();
    }
  });
});
