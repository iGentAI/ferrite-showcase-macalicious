import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { type MailMessage, showingAddresses } from "./mail-data";
import { MailPreferences, messageFontStyle } from "./mail-preferences";

describe("messageFontStyle", () => {
  it("sets nothing until a font is chosen, so a message keeps the window's own", () => {
    expect(messageFontStyle({})).toBeUndefined();
  });
  it("sets the chosen font and size for the message and the New Message window", () => {
    const style = messageFontStyle({ messageFont: "Georgia", messageSize: "18" }) as Record<
      string,
      string
    >;
    expect(style["--mac-mail-message-font"]).toMatch(/^18px \/ 1\.1667 .*Georgia/);
    expect(style["--mac-mail-compose-message-font"]).toBe(style["--mac-mail-message-font"]);
  });
  it("falls back to Helvetica 12 for what it does not know", () => {
    const style = messageFontStyle({ messageFont: "Nope", messageSize: "x" }) as Record<
      string,
      string
    >;
    expect(style["--mac-mail-message-font"]).toBe("12px / 1.1667 Helvetica, Arial, sans-serif");
  });
});

describe("showingAddresses", () => {
  const base: MailMessage = {
    id: "m",
    mailbox: "inbox",
    from: "Ada",
    to: ["Robin"],
    subject: "s",
    date: "",
    received: "",
    time: 0,
    body: "",
  };
  it("puts each person's address in place of the name, and keeps a name with no address", () => {
    const addressed = {
      ...base,
      fromAddress: "Ada <ada@macalicious>",
      toAddresses: ["robin@macalicious"],
    };
    expect(showingAddresses(addressed)).toMatchObject({
      from: "Ada <ada@macalicious>",
      to: ["robin@macalicious"],
    });
    expect(showingAddresses(base)).toMatchObject({ from: "Ada", to: ["Robin"] });
  });
});

describe("Preferences", () => {
  it("dims a setting that means nothing here, unchecked, and says why", async () => {
    const user = userEvent.setup();
    render(<MailPreferences settings={{ remoteContent: true }} />);
    await user.click(screen.getByRole("tab", { name: "Viewing" }));
    const dimmed = screen.getByRole("checkbox", { name: "Load remote content in messages" });
    expect(dimmed).toHaveAttribute("aria-disabled", "true");
    expect(dimmed).not.toBeChecked();
    expect(dimmed.title).toMatch(/nothing in them loads from outside/);
  });
  it("changes the message font from its pop-up", async () => {
    const user = userEvent.setup();
    const changes: unknown[] = [];
    render(<MailPreferences onSettingsChange={(next) => changes.push(next)} />);
    await user.click(screen.getByRole("tab", { name: "Fonts & Colors" }));
    await user.click(screen.getByRole("combobox", { name: "Message Font Size" }));
    await user.click(await screen.findByRole("option", { name: "18" }));
    expect(changes.at(-1)).toMatchObject({ messageSize: "18" });
  });
});
