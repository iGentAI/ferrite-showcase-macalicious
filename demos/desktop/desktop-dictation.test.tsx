import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CANNOT_HEAR_DICTATION,
  DesktopDictation,
  DictationRow,
  NO_TEXT_FIELD,
  newlyHeard,
  panelPlace,
  startDictation,
  typedForm,
} from "./desktop-dictation";
import { changeDesktopValue, desktopValues } from "./desktop-personal";

const final = (transcript: string) =>
  Object.assign([{ transcript }], { isFinal: true as boolean | undefined });
const changing = (transcript: string) =>
  Object.assign([{ transcript }], { isFinal: false as boolean | undefined });

describe("typedForm", () => {
  it("starts a sentence with a capital and needs no space at the start of a field", () => {
    expect(typedForm("", "hello there")).toBe("Hello there");
    expect(typedForm("Done. ", " next one")).toBe("Next one");
    expect(typedForm("Done.", "next one")).toBe(" Next one");
    expect(typedForm("First line\n", "second")).toBe("Second");
  });

  it("continues a sentence with a space and in the case heard", () => {
    expect(typedForm("and so", "on")).toBe(" on");
    expect(typedForm("and so ", "on")).toBe("on");
  });

  it("types nothing for nothing heard", () => {
    expect(typedForm("text", "   ")).toBe("");
  });
});

describe("newlyHeard", () => {
  it("takes finished results once and shows the ones still changing", () => {
    expect(newlyHeard([changing("hel")], 0)).toEqual({ finished: [], changing: "hel" });
    expect(newlyHeard([final("hello"), changing("the"), changing("re")], 0)).toEqual({
      finished: ["hello"],
      changing: "there",
    });
    expect(newlyHeard([final("hello"), final(" there")], 1)).toEqual({
      finished: [" there"],
      changing: "",
    });
  });

  it("does not skip a result still changing to take a later finished one", () => {
    expect(newlyHeard([changing("a"), final("b")], 0)).toEqual({ finished: [], changing: "ab" });
  });
});

describe("panelPlace", () => {
  const screenSize = { width: 1000, height: 800 };
  const panel = { width: 168, height: 90 };

  it("stands under the insertion point", () => {
    expect(panelPlace({ left: 100, top: 200, bottom: 220 }, panel, screenSize)).toEqual({
      left: 100,
      top: 226,
    });
  });

  it("stands over it at the bottom of the screen, and inside the right edge", () => {
    expect(panelPlace({ left: 950, top: 700, bottom: 780 }, panel, screenSize)).toEqual({
      left: 826,
      top: 604,
    });
  });
});

describe("Start Dictation", () => {
  class Heard {
    static last: Heard;
    lang = "";
    interimResults = false;
    continuous = false;
    stopped = 0;
    onresult: ((event: { results: unknown[] }) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error?: string }) => void) | null = null;
    constructor() {
      Heard.last = this;
    }
    start() {}
    stop() {
      this.stopped += 1;
    }
  }

  /** The browser's insertText on a text area, which jsdom does not have. */
  const insertText = vi.fn((_: string, __: boolean, text: string) => {
    const area = document.activeElement as HTMLTextAreaElement;
    area.setRangeText(text, area.selectionStart, area.selectionEnd, "end");
    return true;
  });

  const dictateInto = async (text: string) => {
    const view = render(
      <>
        <textarea aria-label="Words" defaultValue={text} />
        <button type="button">Elsewhere</button>
        <DesktopDictation />
      </>,
    );
    const area = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Words" });
    area.focus();
    area.setSelectionRange(text.length, text.length);
    act(() => startDictation());
    return { area, view };
  };

  const hear = (...results: unknown[]) => act(() => Heard.last.onresult?.({ results }));

  beforeEach(() => {
    vi.stubGlobal("SpeechRecognition", Heard);
    document.execCommand = insertText as unknown as typeof document.execCommand;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    insertText.mockClear();
  });

  it("types what is finished at the insertion point and shows what is still changing", async () => {
    const { area } = await dictateInto("Dear team.");
    expect(Heard.last.continuous).toBe(true);
    expect(Heard.last.interimResults).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Listening…");

    hear(changing("good"));
    expect(screen.getByRole("status")).toHaveTextContent("good");
    expect(area.value).toBe("Dear team.");

    hear(final("good morning"));
    expect(area.value).toBe("Dear team. Good morning");
    hear(final("good morning"), final("to you"));
    expect(area.value).toBe("Dear team. Good morning to you");
  });

  it("Done lets what was said arrive, and ends when the recognizer does", async () => {
    const { area } = await dictateInto("");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(Heard.last.stopped).toBe(1);
    expect(document.activeElement).toBe(area);
    expect(screen.getByRole("status")).toHaveTextContent("Finishing…");

    hear(final("last words"));
    expect(area.value).toBe("Last words");
    act(() => Heard.last.onend?.());
    expect(screen.queryByRole("dialog", { name: "Dictation" })).toBeNull();
  });

  it("Escape ends it at once and what it hears after goes nowhere", async () => {
    const { area } = await dictateInto("");
    const heard = Heard.last;
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Dictation" })).toBeNull();
    expect(heard.onresult).toBeNull();
    expect(area.value).toBe("");
  });

  it("ends when the keyboard goes elsewhere", async () => {
    await dictateInto("");
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("dialog", { name: "Dictation" })).toBeNull();
  });

  describe("while Dictation is off, its default", () => {
    const chooseRow = async () => {
      render(
        <>
          <textarea aria-label="Words" defaultValue="Dear team." />
          <Menu>
            <MenuTrigger>Edit</MenuTrigger>
            <MenuPopup>
              <DictationRow />
            </MenuPopup>
          </Menu>
          <DesktopDictation />
        </>,
      );
      const area = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Words" });
      await userEvent.click(area);
      await userEvent.click(screen.getByRole("button", { name: "Edit" }));
      return area;
    };
    const prompt = () => screen.findByRole("alertdialog");

    beforeEach(() => {
      Heard.last = undefined as unknown as Heard;
      changeDesktopValue("dictation.on", undefined);
    });

    it("Start Dictation asks first and does not listen", async () => {
      await chooseRow();
      await userEvent.click(await screen.findByRole("menuitem", { name: "Start Dictation…" }));
      expect(await prompt()).toHaveTextContent("Do you want to enable Dictation?");
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(Heard.last).toBeUndefined();
    });

    it("Cancel leaves it off and the keyboard in the field", async () => {
      const area = await chooseRow();
      await userEvent.click(await screen.findByRole("menuitem", { name: "Start Dictation…" }));
      await prompt();
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await vi.waitFor(() => expect(document.activeElement).toBe(area));
      expect(desktopValues()["dictation.on"]).toBeUndefined();
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(Heard.last).toBeUndefined();
    });

    it("Enable Dictation keeps it on and starts listening in the field", async () => {
      const area = await chooseRow();
      await userEvent.click(await screen.findByRole("menuitem", { name: "Start Dictation…" }));
      await prompt();
      await userEvent.click(screen.getByRole("button", { name: "Enable Dictation" }));
      expect(desktopValues()["dictation.on"]).toBe(true);
      await screen.findByRole("dialog", { name: "Dictation" });
      expect(document.activeElement).toBe(area);
      expect(Heard.last).toBeDefined();
    });

    it("is dimmed with no field, and says why, rather than asking", async () => {
      render(
        <Menu open>
          <MenuPopup>
            <DictationRow />
          </MenuPopup>
        </Menu>,
      );
      const row = await screen.findByRole("menuitem", { name: "Start Dictation…" });
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(row).toHaveAttribute("title", NO_TEXT_FIELD);
    });
  });

  it("says when it cannot hear, and stays until Done", async () => {
    await dictateInto("");
    act(() => {
      Heard.last.onerror?.({ error: "not-allowed" });
      Heard.last.onend?.();
    });
    expect(screen.getByRole("status")).toHaveTextContent(CANNOT_HEAR_DICTATION);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Dictation" })).toBeNull();
  });
});
