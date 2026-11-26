import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { richTextFromHtml } from "macalicious/lib/rich-text";
import { describe, expect, it, vi } from "vitest";
import {
  connectDesktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { shareLink } from "../desktop/desktop-share-link";
import { Mail } from "./mail";
import { MailCompose } from "./mail-compose";
import type { MailMessage } from "./mail-data";
import { MAIL_SETTINGS, MAIL_SIGNATURES } from "./mail-saved";
import {
  holdsLines,
  type MailSignature,
  markSignature,
  readMailSignatures,
  SIGNATURE_HTML,
  settleMarks,
  signatureFor,
  signatureIn,
  swapSignature,
  toggleOriginal,
  withSignature,
} from "./mail-signatures";
import { MailSignaturesPane } from "./mail-signatures-pane";
import { messageText } from "./mail-text";

const signature = (id: string, text: string): MailSignature => ({ id, name: id, text });
const editor = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};
const MARK = 'data-mail-signature=""';

describe("withSignature", () => {
  const robin = signature("s", "Robin\nThe Harbor");
  const quote = "\n\nOn Monday, Ada wrote:\n\nHello";
  it("leaves room above it in a new message", () => {
    expect(withSignature("", robin, true)).toBe("\n\nRobin\nThe Harbor");
  });
  it("goes above the quote, or under it, as the setting says", () => {
    expect(withSignature(quote, robin, true)).toBe(
      "\n\nRobin\nThe Harbor\n\nOn Monday, Ada wrote:\n\nHello",
    );
    expect(withSignature(quote, robin, false)).toBe(`${quote}\n\nRobin\nThe Harbor`);
  });
  it("adds nothing without a signature, or for an empty one", () => {
    expect(withSignature("Hi", null, true)).toBe("Hi");
    expect(withSignature("Hi", signature("e", " "), true)).toBe("Hi");
  });
});

describe("swapSignature", () => {
  const one = signature("one", "Robin\nThe Harbor");
  const two = signature("two", "R.");
  it("puts the new one where the marked one stood, leaving the person's words", () => {
    const root = editor(
      `<div>Hello</div><div><br></div><div ${MARK}>Robin</div><div ${MARK}>The Harbor</div>`,
    );
    swapSignature(root, one, two, true);
    expect(messageText(root)).toBe("Hello\n\nR.");
  });
  it("takes it away for None", () => {
    const root = editor(`<div>Hello</div><div ${MARK}>Robin</div><div ${MARK}>The Harbor</div>`);
    swapSignature(root, one, null, true);
    expect(messageText(root)).toBe("Hello");
  });
  it("goes above the quote when there was none", () => {
    const root = editor("<div><br></div><div>On Monday, Ada wrote:</div><div>Hi</div>");
    swapSignature(root, null, two, true);
    expect(messageText(root)).toBe("\nR.\n\nOn Monday, Ada wrote:\nHi");
  });
  it("goes under the text, with a line between", () => {
    const root = editor("Hello");
    swapSignature(root, null, two, true);
    expect(messageText(root)).toBe("Hello\n\nR.");
  });
  it("takes nothing that has no mark, wherever the same words stand", () => {
    for (const html of [
      "<div>Hello</div><div><br></div><div>R.</div>",
      "<div>R.</div><div>is how I sign</div>",
      "<div>On Monday, Ada wrote:</div><div>Hi</div><div>R.</div>",
    ]) {
      const root = editor(html);
      const before = messageText(root);
      swapSignature(root, two, null, true);
      expect(messageText(root)).toBe(before);
    }
  });
  it("replaces a marked signature wherever the person's typing has left it", () => {
    const root = editor("<div>Hello</div>");
    swapSignature(root, null, two, true);
    root.insertAdjacentHTML("beforeend", "<div>P.S. the ferry</div>");
    swapSignature(root, two, one, true);
    expect(messageText(root)).toBe("Hello\n\nRobin\nThe Harbor\nP.S. the ferry");
  });
  it("takes the marked lines, not the same words elsewhere", () => {
    const root = editor("<div>R.</div><div>Hello</div>");
    swapSignature(root, null, two, true);
    root.insertAdjacentHTML("beforeend", "<div>R.</div>");
    swapSignature(root, two, null, true);
    expect(messageText(root)).toBe("R.\nHello\n\nR.");
    expect(root.querySelector("[data-mail-signature]")).toBeNull();
  });
  it("keeps the mark through a saved draft, and finds it by its mark", () => {
    const root = editor("<div>Hello</div><div>On Monday, Ada wrote:</div><div>R.</div>");
    swapSignature(root, null, one, false);
    const opened = document.createElement("div");
    opened.append(richTextFromHtml(root.innerHTML, document, SIGNATURE_HTML));
    expect(signatureIn(opened, [one])?.id).toBe("one");
    swapSignature(opened, one, two, false);
    expect(messageText(opened)).toBe("Hello\nOn Monday, Ada wrote:\nR.\n\nR.");
  });
  it("drops the mark for a reader of the message", () => {
    const read = document.createElement("div");
    read.append(richTextFromHtml(`<div ${MARK}>R.</div>`, document));
    expect(read.innerHTML).toBe("<div>R.</div>");
  });
});

describe("signatureIn", () => {
  const one = signature("one", "Robin\nThe Harbor");
  const two = signature("two", "R.");
  it("takes no line without a mark for a signature, wherever it stands", () => {
    for (const html of [
      "<div>Hi</div><div><br></div><div>R.</div>",
      "<div>On Monday, Ada wrote:</div><div>Hi</div><div>R.</div>",
    ]) {
      expect(signatureIn(editor(html), [two])).toBeNull();
    }
  });
  it("marks the signature a message was made with, so that it can be swapped once typed under", () => {
    const root = editor(
      "<div><br></div><div>On Monday, Ada wrote:</div><div>Hi</div><div><br></div><div>R.</div>",
    );
    const original = "On Monday, Ada wrote:\nHi";
    markSignature(root, two, false, original);
    expect(signatureIn(root, [two])?.id).toBe("two");
    root.insertAdjacentHTML("beforeend", "<div>P.S.</div>");
    swapSignature(root, two, null, false);
    expect(messageText(root)).toBe("\nOn Monday, Ada wrote:\nHi\n\nP.S.");
  });
  it("does not take part of the marked lines for a signature with fewer words", () => {
    const shortened = signature("short", "The Harbor");
    const root = editor(`<div>Mine</div><div ${MARK}>Robin</div><div ${MARK}>The Harbor</div>`);
    const held = signatureIn(root, [shortened]);
    expect(held?.id).toBe("kept");
    expect(held?.text).toBe("Robin\nThe Harbor");
    swapSignature(root, held, null, true);
    expect(messageText(root)).toBe("Mine");
  });
  it("knows a marked signature among those with other words", () => {
    const root = editor(`<div>Mine</div><div ${MARK}>Robin</div><div ${MARK}>The Harbor</div>`);
    expect(signatureIn(root, [two, one])?.id).toBe("one");
  });
  it("reads lines a paste has nested in one block", () => {
    expect(
      holdsLines(editor("<blockquote><div>On Monday<br>Hi</div></blockquote>"), "On Monday\nHi"),
    ).toBe(true);
  });
});

describe("settleMarks", () => {
  const two = signature("two", "R.");
  it("takes the mark off a line the browser marked by copying the signature's", () => {
    const root = editor(`<div>Hello</div><div ${MARK}>R.</div><div ${MARK}>Later</div>`);
    expect(settleMarks(root, two)).toBe(true);
    expect(signatureIn(root, [two])?.id).toBe("two");
    swapSignature(root, two, null, true);
    expect(messageText(root)).toBe("Hello\nLater");
  });
  it("makes a signature the person has edited their own text", () => {
    const root = editor(`<div ${MARK}>R. updated</div>`);
    expect(settleMarks(root, two)).toBe(false);
    expect(root.querySelector("[data-mail-signature]")).toBeNull();
  });
  it("takes off a mark that came in with no signature placed", () => {
    const root = editor(`<div ${MARK}>Pasted</div>`);
    expect(settleMarks(root, null)).toBe(false);
    expect(root.querySelector("[data-mail-signature]")).toBeNull();
  });
});

describe("a signature in the New Message window", () => {
  const one = signature("one", "Robin");
  const two = signature("two", "R.");
  const swapTo = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole("combobox", { name: "Signature" }));
    await user.click(await screen.findByRole("option", { name }));
  };
  const box = () => screen.getByRole("textbox", { name: "Message" });
  const text = () => messageText(box());
  const shown = () => screen.getByRole("combobox", { name: "Signature" }).textContent;
  const draft = { to: [], cc: [], subject: "" };

  it("reads a saved draft's mark, and leaves what the person typed like it", async () => {
    const user = userEvent.setup();
    const html = `<div>R.</div><div>Mine</div><div ${MARK}>R.</div><div>P.S.</div>`;
    render(<MailCompose defaultDraft={{ ...draft, body: "", html }} signatures={[one, two]} />);
    expect(shown()).toContain("two");
    await swapTo(user, "one");
    expect(text()).toBe("R.\nMine\nRobin\nP.S.");
  });
  it("keeps a reopened draft's signature when Preferences has changed it, and swaps it whole", async () => {
    const user = userEvent.setup();
    const html = `<div>Mine</div><div ${MARK}>Old Robin</div><div ${MARK}>Old Harbor</div>`;
    render(<MailCompose defaultDraft={{ ...draft, body: "", html }} signatures={[one, two]} />);
    expect(shown()).toContain("As Written");
    await swapTo(user, "two");
    expect(text()).toBe("Mine\nR.");
    await swapTo(user, "As Written");
    expect(text()).toBe("Mine\nOld Robin\nOld Harbor");
  });
  it("takes all of a reopened signature that Preferences has since shortened", async () => {
    const user = userEvent.setup();
    const html = `<div>Mine</div><div ${MARK}>Robin</div><div ${MARK}>The Harbor</div>`;
    const shortened = signature("short", "The Harbor");
    render(<MailCompose defaultDraft={{ ...draft, body: "", html }} signatures={[shortened]} />);
    expect(shown()).toContain("As Written");
    await swapTo(user, "None");
    expect(text()).toBe("Mine");
  });
  it("does not take the last line a person typed in a saved draft for a signature", async () => {
    const user = userEvent.setup();
    const html = "<div>Mine</div><div><br></div><div>R.</div>";
    render(<MailCompose defaultDraft={{ ...draft, body: "", html }} signatures={[one, two]} />);
    expect(shown()).toContain("None");
    await swapTo(user, "one");
    expect(text()).toContain("R.");
  });
  it("does not take the last line of a draft saved with no HTML for a signature either", async () => {
    const user = userEvent.setup();
    render(<MailCompose defaultDraft={{ ...draft, body: "Mine\n\nR." }} signatures={[one, two]} />);
    expect(shown()).toContain("None");
    await swapTo(user, "one");
    await swapTo(user, "None");
    expect(text()).toContain("Mine\n\nR.");
    expect(text()).not.toContain("Robin");
  });
  it("says the signature it was made with, of two with the same words, and keeps it", () => {
    const work = signature("work", "R.");
    const home = signature("home", "R.");
    const defaultDraft = { ...draft, body: "\n\nR." };
    const made = { defaultDraft, startingSignature: home };
    const view = render(<MailCompose {...made} signatures={[work, home]} />);
    expect(shown()).toContain("home");
    view.rerender(<MailCompose {...made} signatures={[signature("work", "Edited"), home]} />);
    expect(shown()).toContain("home");
    expect(shown()).not.toContain("As Written");
  });
  it("leaves a line like the signature alone once the person has edited it", async () => {
    const user = userEvent.setup();
    render(
      <MailCompose
        defaultDraft={{ ...draft, body: "\n\nR." }}
        startingSignature={two}
        signatures={[one, two]}
      />,
    );
    const marked = box().querySelector("[data-mail-signature]") as HTMLElement;
    marked.textContent = "R. updated";
    fireEvent.input(box());
    await waitFor(() => expect(shown()).toContain("None"));
    box().insertAdjacentHTML("beforeend", "<div>R.</div>");
    fireEvent.input(box());
    await swapTo(user, "one");
    expect(text()).toContain("R. updated\nR.");
    expect(text()).toContain("Robin");
  });
  it("marks the signature a new message opened with, for the draft it saves", () => {
    render(
      <MailCompose
        defaultDraft={{ ...draft, body: "\n\nR." }}
        startingSignature={two}
        signatures={[one, two]}
      />,
    );
    const marks = box().querySelectorAll("[data-mail-signature]");
    expect([...marks].map((each) => each.textContent)).toEqual(["R."]);
  });
  it("keeps the pop-up for a reopened draft after Preferences has lost every signature", async () => {
    const user = userEvent.setup();
    const html = `<div>Mine</div><div>R.</div><div ${MARK}>R.</div>`;
    render(<MailCompose defaultDraft={{ ...draft, body: "", html }} signatures={[]} />);
    expect(shown()).toContain("As Written");
    await swapTo(user, "None");
    expect(text()).toBe("Mine\nR.");
  });
  it("keeps the old words when Preferences edits the signature, and the new one replaces them", async () => {
    const user = userEvent.setup();
    const defaultDraft = { ...draft, body: "\n\nR." };
    const made = { defaultDraft, startingSignature: two };
    const view = render(<MailCompose {...made} signatures={[two]} />);
    expect(shown()).toContain("two");
    const edited = signature("two", "Robin V.");
    view.rerender(<MailCompose {...made} signatures={[edited]} />);
    await waitFor(() => expect(shown()).toContain("As Written"));
    expect(text()).toContain("R.");
    await swapTo(user, "two");
    expect(text()).toContain("Robin V.");
    expect(text().split("\n")).not.toContain("R.");
  });
  it("keeps the signature's words when Preferences loses it while the window is open", async () => {
    const user = userEvent.setup();
    const defaultDraft = { ...draft, body: "\n\nR." };
    const made = { defaultDraft, startingSignature: two };
    const view = render(<MailCompose {...made} signatures={[two]} />);
    expect(shown()).toContain("two");
    view.rerender(<MailCompose {...made} signatures={[]} />);
    await waitFor(() => expect(shown()).toContain("As Written"));
    expect(text()).toContain("R.");
    await swapTo(user, "None");
    expect(text()).not.toContain("R.");
  });
});

describe("a signature in a link shared with Mail", () => {
  it("is in the window the link opens, selected, under the address", async () => {
    receiveDesktopValues({
      [MAIL_SIGNATURES]: { list: [signature("two", "R.")], chosen: "two", turn: 0 },
    });
    const stop = connectDesktopValues(vi.fn());
    render(<Mail keepsView takesSharedLinks />);
    await act(() => {
      shareLink("mail", "https://example.test/page", "A page", "safari", new Set(["mail"]));
    });
    const combobox = await screen.findByRole("combobox", { name: "Signature" });
    await waitFor(() => expect(combobox.textContent).toContain("two"));
    expect(messageText(screen.getByRole("textbox", { name: "Message" }))).toBe(
      "https://example.test/page\n\nR.",
    );
    stop();
    forgetDesktopValues();
  });
});

describe("a signature in a forward, placed under the quote", () => {
  const FERRY: MailMessage = {
    id: "ferry",
    mailbox: "inbox",
    from: "Ada",
    fromAddress: "Ada <ada@macalicious>",
    to: ["Robin"],
    toAddresses: ["Robin <robin@macalicious>"],
    subject: "Ferry times",
    date: "",
    received: "Monday",
    time: 100,
    body: "The first boat.",
  };

  it("is known, swapped rather than added to, and taken off without touching the quote", async () => {
    const user = userEvent.setup();
    receiveDesktopValues({
      [MAIL_SETTINGS]: { signatureAbove: false },
      [MAIL_SIGNATURES]: {
        list: [signature("one", "Robin"), signature("two", "R.")],
        chosen: "two",
        turn: 0,
      },
    });
    const stop = connectDesktopValues(vi.fn());
    render(<Mail keepsView messages={[FERRY]} defaultMessage="ferry" me="Robin <r@macalicious>" />);
    await user.click(await screen.findByRole("button", { name: "Forward" }));
    const combobox = () => screen.getByRole("combobox", { name: "Signature" });
    const text = () => messageText(screen.getByRole("textbox", { name: "Message" }));
    await waitFor(() => expect(combobox().textContent).toContain("two"));
    const quote = "On Monday, Ada wrote:\n\nThe first boat.";
    expect(text()).toBe(`\n\n${quote}\n\nR.`);
    expect(
      screen.getByRole("button", { name: "Include Original Message" }).getAttribute("title"),
    ).toContain("forward");

    await user.click(combobox());
    await user.click(await screen.findByRole("option", { name: "one" }));
    expect(text()).toBe(`\n\n${quote}\n\nRobin`);
    await user.click(combobox());
    await user.click(await screen.findByRole("option", { name: "None" }));
    expect(text()).toBe(`\n\n${quote}\n`);
    stop();
    forgetDesktopValues();
  });
});

describe("Include Original Message", () => {
  const original = "On Monday, Ada wrote:\nHello";
  const draft = { to: [], cc: [], subject: "Re: Hi", body: `\n\n${original}` };
  const button = () => screen.getByRole("button", { name: "Include Original Message" });
  const box = () => screen.getByRole("textbox", { name: "Message" });

  it("follows the text when the person deletes the quote by hand and puts it back", async () => {
    const user = userEvent.setup();
    render(<MailCompose defaultDraft={draft} original={original} />);
    await waitFor(() => expect(button().getAttribute("aria-pressed")).toBe("true"));
    const quoted = [...box().children].filter((line) =>
      /wrote:|Hello/.test(line.textContent ?? ""),
    );
    for (const line of quoted) line.remove();
    fireEvent.input(box());
    await waitFor(() => expect(button().getAttribute("aria-pressed")).toBe("false"));
    await user.click(button());
    expect(messageText(box())).toContain(original);
    await waitFor(() => expect(button().getAttribute("aria-pressed")).toBe("true"));
    await user.click(button());
    expect(messageText(box())).not.toContain("Hello");
  });
});

describe("toggleOriginal", () => {
  it("takes the quote out and puts it back", () => {
    const original = "On Monday, Ada wrote:\n\nHello";
    const root = editor("<div>Mine</div>");
    toggleOriginal(root, original, true);
    expect(messageText(root)).toBe("Mine\n\nOn Monday, Ada wrote:\n\nHello");
    toggleOriginal(root, original, true);
    expect(messageText(root)).toBe("Mine\n");
  });
  it("puts it back above a signature that goes below the quote, not above one that goes over it", () => {
    const original = "On Monday, Ada wrote:\nHello";
    const two = signature("two", "R.");
    const below = editor("<div>Mine</div><div></div>");
    swapSignature(below, null, two, false);
    toggleOriginal(below, original, false);
    const said = messageText(below);
    expect(said.indexOf("Hello")).toBeLessThan(said.indexOf(two.text));
    expect(said.indexOf("Mine")).toBeLessThan(said.indexOf("Hello"));

    const over = editor("<div>Mine</div>");
    swapSignature(over, null, two, true);
    toggleOriginal(over, original, true);
    const put = messageText(over);
    expect(put.indexOf(two.text)).toBeLessThan(put.indexOf("Hello"));
  });
});

describe("Preferences > Signatures", () => {
  it("shows the message font the signature follows, checked and dimmed, and says why", () => {
    render(
      <MailSignaturesPane
        kept={{ list: [], chosen: "none", turn: 0 }}
        above
        font="Georgia 18"
        onChange={vi.fn()}
        onAboveChange={vi.fn()}
      />,
    );
    const box = screen.getByRole("checkbox", {
      name: "Always match my default message font (Georgia 18)",
    });
    expect(box).toBeChecked();
    expect(box).toHaveAttribute("aria-disabled", "true");
    expect(box.closest("[title]") ?? box).toHaveAttribute(
      "title",
      "A signature here is plain text, so it always has the message's font.",
    );
  });
});

describe("signatureFor", () => {
  const list = [signature("a", "A"), signature("b", "B")];
  it.each([
    ["none", 0, 0, null],
    ["b", 0, 0, "b"],
    ["gone", 0, 0, null],
    ["random", 0, 0.9, "b"],
    ["sequential", 3, 0, "b"],
    ["sequential", 4, 0, "a"],
  ])("%s, turn %i, random %d gives %s", (chosen, turn, random, expected) => {
    expect(signatureFor({ list, chosen, turn }, random)?.id ?? null).toBe(expected);
  });
  it("reads only what it wrote", () => {
    expect(readMailSignatures({ list: [{ id: "a", name: "A" }, list[0]] })).toEqual({
      list: [list[0]],
      chosen: "none",
      turn: 0,
    });
    expect(readMailSignatures({})).toBeUndefined();
  });
});
