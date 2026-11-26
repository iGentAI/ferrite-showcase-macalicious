import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditRows } from "./desktop-edit-rows";

const execCommand = vi.fn(() => true);
const said = vi.fn();

beforeEach(() => {
  execCommand.mockClear();
  said.mockClear();
  document.execCommand = execCommand;
});
afterEach(() => vi.unstubAllGlobals());

async function opened(ui?: Parameters<typeof render>[0]) {
  render(
    <>
      {ui}
      <Menu>
        <MenuTrigger>Edit</MenuTrigger>
        <MenuPopup aria-label="Edit">
          <EditRows nothing="No text here." say={said} />
        </MenuPopup>
      </Menu>
    </>,
  );
}

const pick = async (name: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  return screen.findByRole("menuitem", { name: new RegExp(`^${name}`) });
};

const isDimmed = (item: HTMLElement) => item.getAttribute("aria-disabled") === "true";

describe("the Edit rows", () => {
  it("acts on the field that had the keyboard before the menu took it", async () => {
    await opened(<input aria-label="Find" defaultValue="harbour" />);
    const input = screen.getByRole("textbox", { name: "Find" }) as HTMLInputElement;
    act(() => input.focus());
    input.setSelectionRange(0, 4);
    const cut = await pick("Cut");
    expect(isDimmed(cut)).toBe(false);
    let focused: Element | null = null;
    execCommand.mockImplementationOnce(() => {
      focused = document.activeElement;
      return true;
    });
    fireEvent.click(cut);
    await vi.waitFor(() => expect(execCommand).toHaveBeenCalledWith("cut"));
    expect(focused).toBe(input);
  });

  it("dims Cut and Copy without a selection, and Paste in a read-only field", async () => {
    await opened(<input aria-label="Find" defaultValue="harbour" readOnly />);
    act(() => (screen.getByRole("textbox", { name: "Find" }) as HTMLInputElement).focus());
    expect(isDimmed(await pick("Copy"))).toBe(true);
    expect(isDimmed(screen.getByRole("menuitem", { name: /^Cut/ }))).toBe(true);
    expect(isDimmed(screen.getByRole("menuitem", { name: /^Paste/ }))).toBe(true);
  });

  it("pastes what the clipboard holds into the field", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { readText: async () => "tide" } });
    await opened(<input aria-label="Find" />);
    act(() => screen.getByRole("textbox", { name: "Find" }).focus());
    fireEvent.click(await pick("Paste"));
    await vi.waitFor(() => expect(execCommand).toHaveBeenCalledWith("insertText", false, "tide"));
  });

  it("pastes at the insertion point of a field that selects its text as it takes the keyboard", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { readText: async () => "tide" } });
    await opened(
      <input aria-label="Find" defaultValue="harbour" onFocus={(event) => event.target.select()} />,
    );
    const input = screen.getByRole("textbox", { name: "Find" }) as HTMLInputElement;
    act(() => input.focus());
    input.setSelectionRange(7, 7);
    let selected: (number | null)[] = [];
    execCommand.mockImplementationOnce(() => {
      selected = [input.selectionStart, input.selectionEnd];
      return true;
    });
    fireEvent.click(await pick("Paste"));
    await vi.waitFor(() => expect(execCommand).toHaveBeenCalledWith("insertText", false, "tide"));
    expect(selected).toEqual([7, 7]);
  });

  it("says so when the browser refuses the clipboard, and dims Paste when it has none", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { readText: () => Promise.reject(new Error("denied")) },
    });
    await opened(<input aria-label="Find" />);
    act(() => screen.getByRole("textbox", { name: "Find" }).focus());
    fireEvent.click(await pick("Paste"));
    await vi.waitFor(() => expect(said).toHaveBeenCalledWith(expect.stringMatching(/Command-V/)));
    expect(execCommand).not.toHaveBeenCalled();
    cleanup();

    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    await opened(<input aria-label="Find" />);
    act(() => screen.getByRole("textbox", { name: "Find" }).focus());
    expect(isDimmed(await pick("Paste"))).toBe(true);
  });

  it("leaves another field alone when the one pasted into has gone by the time the clipboard answers", async () => {
    let answer: (text: string) => void = () => {};
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { readText: () => new Promise<string>((resolve) => (answer = resolve)) },
    });
    await opened(<input aria-label="Other" />);
    const first = document.createElement("input");
    document.body.append(first);
    act(() => first.focus());
    fireEvent.click(await pick("Paste"));
    first.remove();
    act(() => screen.getByRole("textbox", { name: "Other" }).focus());
    await act(async () => answer("tide"));
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("leaves the keyboard where the person has moved it while the clipboard answers", async () => {
    let answer: (text: string) => void = () => {};
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { readText: () => new Promise<string>((resolve) => (answer = resolve)) },
    });
    await opened(
      <>
        <input aria-label="Find" />
        <input aria-label="Other" />
      </>,
    );
    const other = screen.getByRole("textbox", { name: "Other" });
    act(() => screen.getByRole("textbox", { name: "Find" }).focus());
    fireEvent.click(await pick("Paste"));
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    act(() => other.focus());
    await act(async () => answer("tide"));
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(execCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(other);
  });

  it("leaves the keyboard on a button the person moves to while the menu lets go, for Cut and Paste", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { readText: async () => "tide" } });
    await opened(
      <>
        <input aria-label="Find" defaultValue="harbour" />
        <button type="button">Elsewhere</button>
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Find" }) as HTMLInputElement;
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    for (const command of ["Cut", "Paste"]) {
      act(() => input.focus());
      input.setSelectionRange(0, 4);
      fireEvent.click(await pick(command));
      await act(async () => {});
      await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
      act(() => elsewhere.focus());
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(execCommand).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(elsewhere);
    }
  });

  it("lets go of the field when the person presses what takes no keyboard", async () => {
    await opened(
      <>
        <input aria-label="Find" defaultValue="harbour" />
        <p>A paragraph</p>
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Find" }) as HTMLInputElement;
    act(() => input.focus());
    input.setSelectionRange(0, 4);
    const paragraph = screen.getByText("A paragraph");
    fireEvent.pointerDown(paragraph);
    act(() => input.blur());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(isDimmed(await pick("Paste"))).toBe(true);
    expect(isDimmed(screen.getByRole("menuitem", { name: /^Cut/ }))).toBe(true);
  });

  it("keeps the field when a press leaves the keyboard in it", async () => {
    await opened(
      <>
        <input aria-label="Find" defaultValue="harbour" />
        <p>A paragraph</p>
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Find" }) as HTMLInputElement;
    act(() => input.focus());
    fireEvent.pointerDown(screen.getByText("A paragraph"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(isDimmed(await pick("Select All"))).toBe(false);
  });

  it("offers Cut and Copy in an email field, which does not tell its selection", async () => {
    await opened(<input aria-label="Address" type="email" defaultValue="a@b.example" />);
    const input = screen.getByRole("textbox", { name: "Address" }) as HTMLInputElement;
    act(() => input.focus());
    expect(input.selectionStart).toBeNull();
    expect(isDimmed(await pick("Copy"))).toBe(false);
    expect(isDimmed(screen.getByRole("menuitem", { name: /^Cut/ }))).toBe(false);
  });

  it("leaves the keyboard alone when the person has gone to another application", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { readText: async () => "tide" } });
    const focused = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    await opened(<input aria-label="Find" />);
    act(() => screen.getByRole("textbox", { name: "Find" }).focus());
    fireEvent.click(await pick("Paste"));
    await new Promise((resolve) => setTimeout(resolve, 350));
    focused.mockRestore();
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("says so when the field will not take what is pasted", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { readText: async () => "tide" } });
    execCommand.mockImplementationOnce(() => false);
    await opened(<input aria-label="Find" />);
    act(() => screen.getByRole("textbox", { name: "Find" }).focus());
    fireEvent.click(await pick("Paste"));
    await vi.waitFor(() => expect(said).toHaveBeenCalledWith(expect.stringMatching(/Command-V/)));
  });

  it("keeps the field when the keyboard moves to what opens the menu", async () => {
    await opened(<input aria-label="Find" defaultValue="harbour" />);
    const input = screen.getByRole("textbox", { name: "Find" }) as HTMLInputElement;
    act(() => input.focus());
    input.setSelectionRange(0, 4);
    const trigger = screen.getByRole("button", { name: "Edit" });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    expect(isDimmed(await screen.findByRole("menuitem", { name: /^Cut/ }))).toBe(false);
  });

  it("copies the text selected on the page when the press on the row has taken it away, as in WebKit", async () => {
    await opened(<p>A paragraph</p>);
    const selection = document.getSelection() as Selection;
    selection.selectAllChildren(screen.getByText("A paragraph"));
    const copy = await pick("Copy");
    expect(isDimmed(copy)).toBe(false);
    selection.removeAllRanges();
    let copied = "";
    execCommand.mockImplementationOnce(() => {
      copied = selection.toString();
      return true;
    });
    fireEvent.click(copy);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toBe("A paragraph");
    selection.removeAllRanges();
  });

  it("dims everything, saying why, with no field and no selection", async () => {
    await opened(<button type="button">Elsewhere</button>);
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    const paste = await pick("Paste");
    expect(isDimmed(paste)).toBe(true);
    expect(paste).toHaveAttribute("title", "No text here.");
  });
});
