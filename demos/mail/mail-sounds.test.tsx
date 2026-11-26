import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playAlert } from "../system-preferences/panes/sound/alert-sounds";
import { Mail } from "./mail";
import { DEFAULT_SETTINGS, type MailMessage } from "./mail-data";
import { MailPreferences, SERVED_SETTING_REASONS } from "./mail-preferences";
import { playMailAction, playMailSound, soundNewMail } from "./mail-sounds";

vi.mock("../system-preferences/panes/sound/alert-sounds", () => ({
  playAlert: vi.fn(),
}));

const played = () => vi.mocked(playAlert).mock.calls.map(([name]) => name);

beforeEach(() => vi.mocked(playAlert).mockClear());

describe("Mail's sounds", () => {
  it("plays the chosen new-mail sound, a stand-in for Mail's own, and none for None", () => {
    playMailSound("Glass");
    playMailSound("New Messages Sound");
    playMailSound("None");
    expect(played()).toEqual(["Glass", "Morse"]);
    expect(vi.mocked(playAlert).mock.calls[0]?.[1]).toBe(100);
  });

  it("sounds once for a message however many viewers see it", () => {
    soundNewMail(["m1", "m2"], "Ping");
    soundNewMail(["m1"], "Ping");
    soundNewMail([], "Ping");
    expect(played()).toEqual(["Ping"]);
  });

  it("plays an action's sound only while its setting is on", () => {
    playMailAction("sent", true);
    playMailAction("noMail", undefined);
    playMailAction("sent", false);
    expect(played()).toEqual(["Bottle", "Tink"]);
  });

  it("Preferences: the sound choices are not dimmed, and choosing one plays it", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<MailPreferences defaultValue="general" settingReasons={SERVED_SETTING_REASONS} />);
    const box = screen.getByRole("checkbox", { name: "Play sounds for other mail actions" });
    expect(box).not.toHaveAttribute("aria-disabled", "true");
    expect(box).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("combobox", { name: "New messages sound:" }));
    await user.click(await screen.findByRole("option", { name: "Glass" }));
    expect(played()).toEqual(["Glass"]);
  });

  const incoming = (id: string, mailbox = "inbox"): MailMessage =>
    ({
      id,
      mailbox,
      from: "Martin",
      to: ["Chris"],
      subject: "Hello",
      preview: "",
      body: "",
      time: 1,
      unread: true,
      rulesPending: true,
    }) as unknown as MailMessage;

  it("sounds when new mail comes in the Inbox, not when it was filed elsewhere", () => {
    const held = {
      onMessageChange: vi.fn(),
      onSend: vi.fn(),
      onSaveDraft: vi.fn(),
      onErase: vi.fn(),
      defaultSettings: { ...DEFAULT_SETTINGS, sound: "Pop" },
    };
    const { rerender } = render(<Mail {...held} heldMessages={[incoming("a1", "sent")]} />);
    expect(played()).toEqual([]);
    rerender(<Mail {...held} heldMessages={[incoming("a2")]} />);
    expect(played()).toEqual(["Pop"]);
  });

  it("Get Mail that brings nothing plays the no-mail sound", async () => {
    let answer = () => {};
    const onGetMail = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          answer = resolve;
        }),
    );
    render(
      <Mail
        heldMessages={[]}
        onMessageChange={vi.fn()}
        onSend={vi.fn()}
        onSaveDraft={vi.fn()}
        onErase={vi.fn()}
        onGetMail={onGetMail}
        defaultSettings={DEFAULT_SETTINGS}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Get Mail" })[0] as HTMLElement);
    await vi.waitFor(() => expect(onGetMail).toHaveBeenCalled());
    expect(played()).toEqual([]);
    answer();
    await vi.waitFor(() => expect(played()).toEqual(["Tink"]));
  });

  it.each([
    ["true", true, ["Bottle"]],
    ["kept", "kept", []],
  ] as const)(
    "a send answered %s closes the window, with the sound only if it went",
    async (_, answer, sounds) => {
      render(
        <Mail
          heldMessages={[]}
          onMessageChange={vi.fn()}
          onSend={async () => answer}
          onSaveDraft={vi.fn()}
          onErase={vi.fn()}
          defaultSettings={DEFAULT_SETTINGS}
        />,
      );
      fireEvent.click(screen.getAllByRole("button", { name: "New Message" })[0] as HTMLElement);
      const compose = screen.getByRole("region", { name: "New Message" });
      await userEvent.type(within(compose).getByLabelText("To:"), "martin{Enter}");
      fireEvent.click(within(compose).getByRole("button", { name: "Send" }));
      await vi.waitFor(() =>
        expect(screen.queryByRole("region", { name: "New Message" })).toBeNull(),
      );
      expect(played()).toEqual(sounds);
    },
  );
});
