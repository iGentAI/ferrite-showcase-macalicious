import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onDesktopEffects } from "./desktop-effects";
import { answerOf, CANNOT_HEAR, DesktopSiri, SIRI_ASK_URL } from "./desktop-siri";

afterEach(() => {
  vi.unstubAllGlobals();
});

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Siri on the desktop's Ferrite application", () => {
  it("names what it made when asked to change it, and says it cannot with nothing made", async () => {
    const asked: { text: string; made?: unknown }[] = [];
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string; made?: unknown };
      asked.push(body);
      return reply({
        text: body.made ? "OK, I changed the reminder." : "OK, I’ll remind you.",
        card: null,
        effects: [],
        via: "commands",
        understood: true,
        made: { app: "reminders", id: "r1" },
      });
    });
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<DesktopSiri onClose={vi.fn()} launch={vi.fn()} />);
    const field = screen.getByRole("textbox", { name: "Type to Siri" });
    await user.type(field, "change it to 5{Enter}");
    expect(await screen.findByText(/can’t change that/)).toBeInTheDocument();
    expect(asked).toEqual([]);

    await user.type(field, "Remind me to call Mom{Enter}");
    await screen.findByText("OK, I’ll remind you.");
    await user.type(field, "change it to 5{Enter}");
    await screen.findByText("OK, I changed the reminder.");
    expect(asked.at(-1)?.text).toBe("change it to 5");
    expect(asked.at(-1)?.made).toEqual({ app: "reminders", id: "r1" });
    expect(asked[0]?.made).toBeUndefined();
  });

  it("sends a typed request with the browser's time zone and shows the answer and its card", async () => {
    const fetch = vi.fn(async () =>
      reply({
        text: "OK, I’ll remind you tomorrow at 5:00 PM: “call Mom”.",
        card: { title: "Reminders", app: "reminders", items: [{ text: "call Mom" }] },
        effects: [],
        via: "commands",
        understood: true,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const launch = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DesktopSiri onClose={onClose} launch={launch} />);
    await user.type(
      screen.getByRole("textbox", { name: "Type to Siri" }),
      "Remind me to call Mom{Enter}",
    );

    expect(await screen.findByText(/remind you tomorrow at 5:00 PM/)).toBeInTheDocument();
    expect(screen.getByText("“Remind me to call Mom”")).toBeInTheDocument();
    expect(screen.getByText("call Mom")).toBeInTheDocument();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SIRI_ASK_URL);
    expect(JSON.parse(String(init.body))).toEqual({
      text: "Remind me to call Mom",
      tz: 0 - new Date().getTimezoneOffset(),
    });

    await user.click(screen.getByRole("button", { name: "Open Reminders" }));
    expect(launch).toHaveBeenCalledWith("reminders");
    expect(onClose).toHaveBeenCalled();
  });

  it("hands what the answer asks of the desktop to it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reply({
          text: "Dark mode is on.",
          card: null,
          effects: [{ appearance: "dark" }, { evil: 1 }],
          via: "commands",
          understood: true,
        }),
      ),
    );
    const heard: unknown[] = [];
    const stop = onDesktopEffects((effects) => heard.push(...effects));
    const user = userEvent.setup();
    render(<DesktopSiri onClose={() => {}} launch={() => {}} />);
    await user.click(screen.getByRole("button", { name: "“Turn on dark mode”" }));
    expect(await screen.findByText("Dark mode is on.")).toBeInTheDocument();
    await waitFor(() => expect(heard).toEqual([{ appearance: "dark" }]));
    stop();
  });

  /** A server whose answers the test gives one by one, by the request's text. */
  function holdAnswers() {
    const pending = new Map<string, (response: Response) => void>();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((resolve) => {
            pending.set(JSON.parse(String(init.body)).text, resolve);
          }),
      ),
    );
    const answer = (text: string, said: string, effects: unknown[]) =>
      pending.get(text)?.(
        reply({ text: said, card: null, effects, via: "commands", understood: true }),
      );
    return { pending, answer };
  }

  /** Ask once and wait for the answer, so the page has its session and sends requests at once. */
  async function warmUp(
    user: ReturnType<typeof userEvent.setup>,
    held: ReturnType<typeof holdAnswers>,
  ) {
    await user.type(screen.getByRole("textbox", { name: "Type to Siri" }), "Hello{Enter}");
    await waitFor(() => expect(held.pending.has("Hello")).toBe(true));
    held.answer("Hello", "Hi.", []);
    expect(await screen.findByText("Hi.")).toBeInTheDocument();
  }

  it("shows no older answer while a newer request is pending, and carries out both", async () => {
    const held = holdAnswers();
    const heard: unknown[] = [];
    const stop = onDesktopEffects((effects) => heard.push(...effects));
    const user = userEvent.setup();
    render(<DesktopSiri onClose={() => {}} launch={() => {}} />);
    await warmUp(user, held);
    const field = screen.getByRole("textbox", { name: "Type to Siri" });
    await user.type(field, "Turn on dark mode{Enter}");
    await user.type(field, "Open Calculator{Enter}");
    await waitFor(() => expect(held.pending.has("Open Calculator")).toBe(true));
    held.answer("Turn on dark mode", "Dark mode is on.", [{ appearance: "dark" }]);
    await waitFor(() => expect(heard).toEqual([{ appearance: "dark" }]));
    // The newer request is still pending: the older answer is not shown meanwhile.
    expect(screen.queryByText("Dark mode is on.")).not.toBeInTheDocument();
    held.answer("Open Calculator", "Opening Calculator.", [{ open: "calculator" }]);
    expect(await screen.findByText("Opening Calculator.")).toBeInTheDocument();
    await waitFor(() => expect(heard).toEqual([{ appearance: "dark" }, { open: "calculator" }]));
    stop();
  });

  it("keeps the newer answer when the older one comes back after it", async () => {
    const held = holdAnswers();
    const speakSpy = vi.fn();
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak: speakSpy });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    const heard: unknown[] = [];
    const stop = onDesktopEffects((effects) => heard.push(...effects));
    const user = userEvent.setup();
    render(<DesktopSiri onClose={() => {}} launch={() => {}} />);
    await warmUp(user, held);
    const field = screen.getByRole("textbox", { name: "Type to Siri" });
    await user.type(field, "Turn on dark mode{Enter}");
    await user.type(field, "Open Calculator{Enter}");
    await waitFor(() => expect(held.pending.has("Open Calculator")).toBe(true));
    // The newer answer first, then the older one.
    held.answer("Open Calculator", "Opening Calculator.", [{ open: "calculator" }]);
    expect(await screen.findByText("Opening Calculator.")).toBeInTheDocument();
    held.answer("Turn on dark mode", "Dark mode is on.", [{ appearance: "dark" }]);
    await waitFor(() => expect(heard).toEqual([{ open: "calculator" }, { appearance: "dark" }]));
    expect(screen.getByText("Opening Calculator.")).toBeInTheDocument();
    expect(screen.queryByText("Dark mode is on.")).not.toBeInTheDocument();
    expect(speakSpy).not.toHaveBeenCalled();
    stop();
  });

  it("stops speaking and drops a pending answer when listening starts", async () => {
    const held = holdAnswers();
    const made: { onresult: ((event: unknown) => void) | null; start: () => void }[] = [];
    vi.stubGlobal(
      "SpeechRecognition",
      class {
        lang = "";
        interimResults = true;
        onresult: ((event: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        start = vi.fn();
        stop = vi.fn();
        constructor() {
          made.push(this);
        }
      },
    );
    const cancelSpy = vi.fn();
    const speakSpy = vi.fn();
    vi.stubGlobal("speechSynthesis", { cancel: cancelSpy, speak: speakSpy });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    const heard: unknown[] = [];
    const stop = onDesktopEffects((effects) => heard.push(...effects));
    const user = userEvent.setup();
    render(<DesktopSiri onClose={() => {}} launch={() => {}} />);
    await warmUp(user, held);
    const orb = screen.getByRole("button", { name: "Listen" });
    await user.click(orb);
    // Heard: a spoken request, whose answer is still on its way.
    act(() => made[0]?.onresult?.({ results: [[{ transcript: "Open Notes" }]] }));
    await waitFor(() => expect(held.pending.has("Open Notes")).toBe(true));
    const cancelled = cancelSpy.mock.calls.length;
    await user.click(orb); // stop listening
    await user.click(orb); // and listen again
    expect(cancelSpy.mock.calls.length).toBeGreaterThan(cancelled);
    held.answer("Open Notes", "Opening Notes.", [{ open: "notes" }]);
    await waitFor(() => expect(heard).toEqual([{ open: "notes" }]));
    expect(screen.queryByText("Opening Notes.")).not.toBeInTheDocument();
    expect(speakSpy).not.toHaveBeenCalled();
    stop();
  });

  it("says to type instead when the microphone is denied, fails or the service is unavailable", async () => {
    for (const error of [
      "not-allowed",
      "service-not-allowed",
      "audio-capture",
      "network",
      "start",
    ]) {
      const made: { onerror: ((event: { error?: string }) => void) | null }[] = [];
      vi.stubGlobal(
        "SpeechRecognition",
        class {
          lang = "";
          interimResults = true;
          onresult = null;
          onend = null;
          onerror: ((event: { error?: string }) => void) | null = null;
          start = () => {
            if (error === "start") throw new Error("NotAllowedError");
          };
          stop = vi.fn();
          constructor() {
            made.push(this);
          }
        },
      );
      const user = userEvent.setup();
      const { unmount } = render(<DesktopSiri onClose={() => {}} launch={() => {}} />);
      const orb = screen.getByRole("button", { name: "Listen" });
      await user.click(orb);
      if (error !== "start") act(() => made[0]?.onerror?.({ error }));
      expect(await screen.findByText(CANNOT_HEAR)).toBeInTheDocument();
      expect(orb).toHaveAttribute("aria-pressed", "false");
      unmount();
    }
  });

  it("shows and says nothing once closed, but still carries out what the server did", async () => {
    let answer: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      ),
    );
    const speakSpy = vi.fn();
    const cancelSpy = vi.fn();
    vi.stubGlobal("speechSynthesis", { cancel: cancelSpy, speak: speakSpy });
    const heard: unknown[] = [];
    const stop = onDesktopEffects((effects) => heard.push(...effects));
    const user = userEvent.setup();
    const { unmount } = render(<DesktopSiri onClose={() => {}} launch={() => {}} />);
    await user.type(screen.getByRole("textbox", { name: "Type to Siri" }), "Open Notes{Enter}");
    await waitFor(() => expect(answer).toBeDefined());
    // A new request stops whatever answer was being spoken.
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    unmount();
    // Closing Siri stops speaking too.
    expect(cancelSpy).toHaveBeenCalledTimes(2);
    answer?.(
      reply({
        text: "Opening Notes.",
        card: null,
        effects: [{ open: "notes" }],
        via: "commands",
        understood: true,
      }),
    );
    await waitFor(() => expect(heard).toEqual([{ open: "notes" }]));
    expect(speakSpy).not.toHaveBeenCalled();
    stop();
  });

  it("listens only to the current recognizer, and stops every one when closed", async () => {
    const made: FakeRecognition[] = [];
    class FakeRecognition {
      lang = "";
      interimResults = true;
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() {
        made.push(this);
      }
    }
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const user = userEvent.setup();
    const { unmount } = render(<DesktopSiri onClose={() => {}} launch={() => {}} />);
    const orb = screen.getByRole("button", { name: "Listen" });
    await user.click(orb);
    expect(orb).toHaveAttribute("aria-pressed", "true");
    await user.click(orb); // stop
    await user.click(orb); // and listen again before the first has ended
    expect(made).toHaveLength(2);
    const [first, second] = made;
    expect(first?.onend).toBeNull();
    expect(first?.stop).toHaveBeenCalled();
    expect(orb).toHaveAttribute("aria-pressed", "true");
    unmount();
    expect(second?.stop).toHaveBeenCalled();
    expect(second?.onresult).toBeNull();
  });

  it("says so when the server cannot be reached, and never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    const user = userEvent.setup();
    render(<DesktopSiri onClose={() => {}} launch={() => {}} />);
    await user.type(screen.getByRole("textbox", { name: "Type to Siri" }), "Open Notes{Enter}");
    expect(await screen.findByText(/can’t reach the desktop’s server/)).toBeInTheDocument();
  });

  it("reads only well-formed answers", () => {
    expect(answerOf(null)).toBeNull();
    expect(answerOf({ text: 3 })).toBeNull();
    const read = answerOf({
      text: "Hi",
      card: { title: "T", app: "a", items: [{ text: "x" }, { text: 2 }] },
    });
    expect(read?.card?.items).toEqual([{ text: "x" }]);
    expect(read?.understood).toBe(true);
    const rich = answerOf({
      text: "Hi",
      card: { title: "T", app: "a", lead: "187.20", detail: "Up 1.50", items: [] },
    });
    expect(rich?.card?.lead).toBe("187.20");
    expect(rich?.card?.detail).toBe("Up 1.50");
    expect(
      answerOf({ text: "Hi", card: { title: "T", app: "a", lead: 3, items: [] } })?.card,
    ).toEqual({ title: "T", app: "a", items: [] });
  });
});
