import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = () => screen.getByRole("region", { name: "Wallet & Apple Pay" });

describe("Wallet & Apple Pay pane", () => {
  it("opens at its frame size on the introduction, before any card is added", () => {
    render(<SystemPreferences defaultPane="wallet-and-apple-pay" />);
    expect(frame()).toHaveStyle({ width: "668px", height: "334px" });
    expect(frame()).toHaveTextContent(
      "Add credit, debit, or store cards and use Apple Pay with Touch ID to make purchases easily and securely, right from your Mac.",
    );
    expect(screen.getByRole("button", { name: "Add Card…" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Help" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "See how your data is managed…" })).toBeVisible();
  });

  it("says that Add Card and the privacy link are not part of the demo", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="wallet-and-apple-pay" />);
    const address = window.location.href;
    await user.click(screen.getByRole("button", { name: "Add Card…" }));
    expect(await screen.findByRole("dialog", { name: "Not part of this demo" })).toHaveTextContent(
      "“Add Card…”",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("link", { name: "See how your data is managed…" }));
    expect(await screen.findByRole("dialog", { name: "Not part of this demo" })).toHaveTextContent(
      "“See how your data is managed…”",
    );
    // The link is not followed, and the introduction stays.
    expect(window.location.href).toBe(address);
    expect(frame()).toHaveTextContent("Card-related information");
  });

  it("is found by what it adds, and comes back after Show All and Back", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences />);
    await user.type(screen.getByRole("searchbox"), "debit card{Enter}");
    expect(frame()).toHaveStyle({ height: "334px" });

    await user.click(screen.getByRole("button", { name: "Show All" }));
    expect(screen.queryByRole("button", { name: "Add Card…" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Add Card…" })).toBeEnabled();
  });
});

describePaneControls("wallet-and-apple-pay");
