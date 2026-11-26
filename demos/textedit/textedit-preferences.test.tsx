import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  beginDesktopValues,
  changeDesktopValue,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { TextEdit, type TextEditActions } from "./textedit";
import {
  newDocumentFrom,
  openedDocument,
  TEXTEDIT_SETTINGS,
  TextEditPreferences,
  useTextEditPreferences,
} from "./textedit-preferences";

afterEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
});

const documentView = () => screen.getByRole("textbox", { name: "Document" });
const values = () => renderHook(useTextEditPreferences).result.current;

describe("the Preferences window", () => {
  it("has the two tabs, and changes the person's values", async () => {
    const user = userEvent.setup();
    render(<TextEditPreferences />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "New Document",
      "Open and Save",
    ]);
    await user.click(screen.getByRole("radio", { name: "Plain text" }));
    expect(desktopValues()[TEXTEDIT_SETTINGS.format]).toBe("plain");
    await user.click(screen.getByRole("checkbox", { name: "Show ruler" }));
    expect(desktopValues()[TEXTEDIT_SETTINGS.ruler]).toBe(false);

    const correct = screen.getByRole("checkbox", { name: "Correct spelling automatically" });
    expect(correct).not.toBeChecked();
    await user.click(correct);
    expect(desktopValues()[TEXTEDIT_SETTINGS.correctAutomatically]).toBe(true);

    await user.click(screen.getByRole("tab", { name: "Open and Save" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: "Display RTF files as RTF code instead of formatted text",
      }),
    );
    expect(desktopValues()[TEXTEDIT_SETTINGS.rtfAsCode]).toBe(true);
    await user.click(screen.getByRole("button", { name: "Restore All Defaults" }));
    expect(desktopValues()[TEXTEDIT_SETTINGS.rtfAsCode]).toBe(false);
    expect(desktopValues()[TEXTEDIT_SETTINGS.format]).toBe("plain");
  });
});

describe("what the document window does with them", () => {
  it("File > New makes the format and the rich text font asked for", () => {
    changeDesktopValue(TEXTEDIT_SETTINGS.format, "plain");
    const actions: { current: TextEditActions | null } = { current: null };
    render(<TextEdit actionsRef={actions} />);
    act(() => actions.current?.newDocument());
    expect(documentView().tagName).toBe("TEXTAREA");

    act(() => {
      changeDesktopValue(TEXTEDIT_SETTINGS.format, "rich");
      changeDesktopValue(TEXTEDIT_SETTINGS.richFamily, "Georgia");
      changeDesktopValue(TEXTEDIT_SETTINGS.richSize, 18);
    });
    act(() => actions.current?.newDocument());
    const run = documentView().querySelector("span") as HTMLElement;
    expect(run.style.fontSize).toBe("18px");
    expect(run.style.fontFamily).toContain("Georgia");
  });

  it("shows plain text in the plain text font, and follows a change at once", async () => {
    const actions: { current: TextEditActions | null } = { current: null };
    render(<TextEdit actionsRef={actions} />);
    act(() => actions.current?.setFormat("plain"));
    fireEvent.click(await screen.findByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(documentView().style.fontSize).toBe("11px");
    expect(documentView().style.fontFamily).toContain("Menlo");
    act(() => changeDesktopValue(TEXTEDIT_SETTINGS.plainSize, 18));
    expect(documentView().style.fontSize).toBe("18px");
  });

  it("hides the ruler and stops spell checking when asked", async () => {
    render(<TextEdit />);
    expect(screen.getByLabelText("Ruler")).toBeInTheDocument();
    expect(documentView()).toHaveAttribute("spellcheck", "true");
    act(() => {
      changeDesktopValue(TEXTEDIT_SETTINGS.ruler, false);
      changeDesktopValue(TEXTEDIT_SETTINGS.spelling, false);
    });
    await waitFor(() => expect(screen.queryByLabelText("Ruler")).toBeNull());
    expect(documentView()).toHaveAttribute("spellcheck", "false");
  });
});

describe("opening a rich text file", () => {
  const rtf = { name: "Letter.rtf", format: "rich", lines: ["Dear Ada"] } as const;
  const html = { name: "Page.html", format: "rich", lines: ["Hi"] } as const;
  const code = "{\\rtf1\\ansi\r\nDear Ada}";

  it("shows the formatted text by default", () => {
    expect(openedDocument(rtf, code, values())).toEqual(rtf);
  });

  it("shows RTF code when RTF is asked for, and HTML stays formatted", () => {
    changeDesktopValue(TEXTEDIT_SETTINGS.rtfAsCode, true);
    expect(openedDocument(rtf, code, values())).toEqual({
      name: "Letter.rtf",
      format: "plain",
      lines: ["{\\rtf1\\ansi", "Dear Ada}"],
    });
    expect(openedDocument(html, "<p>Hi</p>", values())).toEqual(html);
  });

  it("shows HTML code when HTML is asked for", () => {
    changeDesktopValue(TEXTEDIT_SETTINGS.htmlAsCode, true);
    expect(openedDocument(html, "<p>Hi</p>", values()).lines).toEqual(["<p>Hi</p>"]);
  });

  it("leaves a plain text file alone", () => {
    changeDesktopValue(TEXTEDIT_SETTINGS.rtfAsCode, true);
    const txt = { name: "a.txt", format: "plain", lines: ["x"] } as const;
    expect(openedDocument(txt, "x", values())).toEqual(txt);
  });

  it("makes the plain untitled document when the font is the default", () => {
    expect(newDocumentFrom(values(), document)).toEqual({
      name: "Untitled",
      format: "rich",
      lines: [""],
    });
  });
});
