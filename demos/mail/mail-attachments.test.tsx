import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Mark } from "../preview/preview-markup";
import { useOutgoingFiles } from "./mail-attachment-views";
import { MAIL_FILE_MARK, placeFiles } from "./mail-attachments";
import { ATTACHMENTS_UNAVAILABLE, INCLUDE_ORIGINAL_UNAVAILABLE, MailCompose } from "./mail-compose";
import { heldTo, pressOn, textAt, textBoxOn } from "./mail-markup";

describe("placeFiles", () => {
  it("gives each mark the file it names, once, and leaves a mark with none its text", () => {
    const root = document.createElement("div");
    root.innerHTML = ["a.txt", "b.txt", "a.txt", "gone.txt"]
      .map((name) => `<span ${MAIL_FILE_MARK}="${name}">${name}</span>`)
      .join("");
    const placed = placeFiles(root, [
      { id: "1", name: "a.txt" },
      { id: "2", name: "b.txt" },
    ]);
    expect(placed.map(({ file }) => file.id)).toEqual(["1", "2"]);
    expect([...root.children].map((each) => each.textContent)).toEqual([
      "",
      "",
      "a.txt",
      "gone.txt",
    ]);
  });
});

// Over the demo's own messages nobody keeps a file: the New Message window's Attach, Markup and
// Photo Browser stay dimmed and say why, as a tooltip and as their description.

describe("choosing a mark in Markup", () => {
  const box: Mark = {
    id: "a",
    kind: "rect",
    color: "#ff0000",
    stroke: 0.01,
    x: 0.2,
    y: 0.2,
    w: 0.2,
    h: 0.2,
  };

  it("moves a mark held by its inside, by as far as the pointer went", () => {
    const press = pressOn([box], null, [0.3, 0.3], 0.01);
    expect(press?.handle).toBeNull();
    const after = press && heldTo(press, [0.5, 0.4]);
    expect([after?.x, after?.y, after?.w, after?.h]).toEqual([0.4, 0.3, 0.2, 0.2]);
  });

  it("resizes the chosen mark by a corner, the opposite corner staying", () => {
    const press = pressOn([box], "a", [0.4, 0.4], 0.01);
    expect(press?.handle).toBe(2);
    const after = press && heldTo(press, [0.6, 0.5]);
    expect([after?.x, after?.y, after?.w, after?.h]).toEqual([0.2, 0.2, 0.4, 0.3]);
  });

  it("takes a corner of a mark not chosen as a move, and takes nothing off every mark", () => {
    expect(pressOn([box], null, [0.4, 0.4], 0.01)?.handle).toBeNull();
    expect(pressOn([box], "a", [0.8, 0.8], 0.01)).toBeNull();
  });

  it("gives a text a box, so that it can be chosen and scaled", () => {
    const text = textAt(
      [0.1, 0.1],
      "Sign here",
      { color: "#000000", stroke: 0.01 },
      0.05,
      textBoxOn({ width: 400, height: 200 }, "Sign here", 0.05, () => 0.25),
    );
    expect([text?.w, text?.h]).toEqual([0.25, 0.12]);
    const press = text && pressOn([text], null, [0.2, 0.15], 0.01);
    expect(press?.mark.id).toBe(text?.id);
  });
});

describe("the New Message window with an owner that keeps files", () => {
  const attaching = {
    choose: vi.fn(),
    available: true,
    setFrozen: vi.fn(),
    takeFiles: vi.fn(),
    drop: vi.fn(),
    strip: <p>plan.txt</p>,
    panel: null,
    placed: [],
    revision: "",
  };

  const pasting = (data: { text?: string; files?: File[] }) => {
    fireEvent.paste(screen.getByRole("textbox", { name: "Message" }), {
      clipboardData: { getData: () => data.text ?? "", files: data.files ?? [], types: [] },
    });
  };

  it("takes a picture from the computer's clipboard as an attachment, with its bytes", async () => {
    attaching.drop.mockClear();
    render(<MailCompose attaching={attaching} />);
    const picture = new File(["png"], "image.png", { type: "image/png" });
    pasting({ files: [picture] });
    expect(attaching.drop).toHaveBeenCalledTimes(1);
    const [item] = attaching.drop.mock.calls[0]?.[0] ?? [];
    expect(item).toMatchObject({ name: "image.png", kind: "file", type: "image/png", size: 3 });
    expect(await item.bytes()).toBe(picture);
  });

  it("leaves a paste with text in it, or a file that is no picture, to the text", () => {
    attaching.drop.mockClear();
    render(<MailCompose attaching={attaching} />);
    const picture = new File(["png"], "image.png", { type: "image/png" });
    pasting({ text: "a table", files: [picture] });
    pasting({ files: [new File(["x"], "a.txt", { type: "text/plain" })] });
    expect(attaching.drop).not.toHaveBeenCalled();
  });

  it("offers Attach and shows the owner's files", () => {
    render(<MailCompose attaching={attaching} />);
    screen.getByRole("button", { name: "Attach" }).click();
    expect(attaching.choose).toHaveBeenCalledTimes(1);
    expect(screen.getByText("plan.txt")).toBeInTheDocument();
  });

  it("keeps Attach dimmed while a message is held as it is", () => {
    const attachRef: { current: (() => void) | null } = { current: null };
    const { rerender } = render(<MailCompose attaching={attaching} attachRef={attachRef} />);
    expect(attachRef.current).toBe(attaching.choose);
    rerender(<MailCompose attaching={attaching} attachRef={attachRef} sending />);
    expect(attachRef.current).toBeNull();
    rerender(<MailCompose attaching={attaching} attachRef={attachRef} held />);
    expect(attachRef.current).toBeNull();
    expect(attaching.setFrozen).toHaveBeenLastCalledWith(true);
    const button = screen.getByRole("button", { name: "Attach" });
    expect(button.getAttribute("aria-disabled") === "true" || button.hasAttribute("disabled")).toBe(
      true,
    );
  });
});

describe("a message that may not change", () => {
  function Host({ frozen }: { frozen: boolean }) {
    const { attaching } = useOutgoingFiles(false);
    useEffect(() => attaching.setFrozen(frozen), [attaching.setFrozen, frozen]);
    return (
      <>
        <button type="button" onClick={attaching.choose}>
          Choose
        </button>
        <button type="button" onClick={() => attaching.takeFiles([new File(["x"], "late.txt")])}>
          Take
        </button>
        {attaching.strip}
        {attaching.panel}
      </>
    );
  }
  const panel = () => document.querySelector(".mac-mail-panel-layer");

  it("takes no file, opens no panel and closes the one that is open", () => {
    const { rerender } = render(<Host frozen={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(panel()).not.toBeNull();
    rerender(<Host frozen />);
    expect(panel()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(panel()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Take" }));
    expect(screen.queryByText("late.txt")).toBeNull();
  });
});

describe("the New Message window's attachment controls", () => {
  it("are unavailable and say why", () => {
    render(<MailCompose />);
    for (const name of ["Attach", "Markup"]) {
      const button = screen.getByRole("button", { name });
      expect(
        button.getAttribute("aria-disabled") === "true" || button.hasAttribute("disabled"),
      ).toBe(true);
      expect(button.getAttribute("title")).toBe(ATTACHMENTS_UNAVAILABLE);
    }
    const photos = screen.getByRole("button", { name: "Photo Browser" });
    expect(photos.getAttribute("aria-disabled") === "true" || photos.hasAttribute("disabled")).toBe(
      true,
    );
    const described = photos.getAttribute("aria-describedby");
    expect(described && document.getElementById(described)?.textContent).toBe(
      ATTACHMENTS_UNAVAILABLE,
    );
    expect(photos.closest("[title]")?.getAttribute("title")).toBe(ATTACHMENTS_UNAVAILABLE);
    // The reason is not printed on the toolbar itself.
    expect(screen.queryByText(ATTACHMENTS_UNAVAILABLE, { selector: "button *" })).toBeNull();
  });

  it("include Include Original Message, which is unavailable and says why", () => {
    render(<MailCompose />);
    const button = screen.getByRole("button", { name: "Include Original Message" });
    expect(button.getAttribute("aria-disabled") === "true" || button.hasAttribute("disabled")).toBe(
      true,
    );
    expect(button.getAttribute("title")).toBe(INCLUDE_ORIGINAL_UNAVAILABLE);
  });
});
