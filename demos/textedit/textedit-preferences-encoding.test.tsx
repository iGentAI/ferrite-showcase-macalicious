import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { TEXTEDIT_SETTINGS, TextEditPreferences } from "./textedit-preferences";

afterEach(() => {
  changeDesktopValue(TEXTEDIT_SETTINGS.openEncoding, null);
  changeDesktopValue(TEXTEDIT_SETTINGS.saveEncoding, null);
});

describe("Preferences > Open and Save > Plain Text File Encoding", () => {
  it("saves the encoding for opening and for saving, each on its own", async () => {
    const user = userEvent.setup();
    render(<TextEditPreferences />);
    await user.click(screen.getByRole("tab", { name: "Open and Save" }));
    await user.click(screen.getByRole("combobox", { name: "Opening files" }));
    await user.click(await screen.findByRole("option", { name: "Western (Mac OS Roman)" }));
    expect(desktopValues()[TEXTEDIT_SETTINGS.openEncoding]).toBe("macintosh");
    expect(desktopValues()[TEXTEDIT_SETTINGS.saveEncoding]).toBeUndefined();
    expect(screen.getByRole("combobox", { name: "Saving files" })).toHaveTextContent("Automatic");
  });
});
