import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactCard } from "./contacts-card";
import { type Contact, RINGTONES, TEXT_TONES } from "./contacts-data";
import { playContactTone } from "./contacts-tones";

/** The pitches the page asked of Web Audio, in order: a stand-in, as jsdom has no sound. */
let sounded: { wave: string; hertz: number }[] = [];
const node = () => ({ connect: <T,>(next: T) => next, disconnect() {} });
vi.stubGlobal(
  "AudioContext",
  class {
    state = "running";
    currentTime = 0;
    destination = node();
    createGain() {
      return {
        ...node(),
        gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      };
    }
    createOscillator() {
      const made = {
        ...node(),
        type: "",
        frequency: { value: 0 },
        start() {
          sounded.push({ wave: made.type, hertz: made.frequency.value });
        },
        stop() {},
      };
      return made;
    }
  },
);

const ADA: Contact = { id: "ada", account: "icloud", first: "Ada", last: "Lovelace" };

const edited = (contact: Contact, onChange = vi.fn()) => {
  render(
    <ContactCard
      contact={contact}
      editing
      focusName={false}
      services={[]}
      onChange={onChange}
      onEdit={() => {}}
      onDone={() => {}}
      onAdd={() => {}}
    />,
  );
  return onChange;
};

beforeEach(() => {
  sounded = [];
});

const soundOf = (name: string) => {
  sounded = [];
  playContactTone(name, 100);
  return JSON.stringify(sounded);
};

describe("a contact's tones", () => {
  it("gives every name a sound of its own", () => {
    const names = [...RINGTONES, ...TEXT_TONES];
    expect(new Set(names.map(soundOf)).size).toBe(names.length);
  });

  it("sounds a name it does not know as the plain note", () => {
    expect(soundOf("Marimba")).toBe(soundOf("Note"));
  });
});

describe("a card being edited", () => {
  it("sounds the tone chosen, and keeps it", async () => {
    const user = userEvent.setup();
    const onChange = edited(ADA);
    await user.click(screen.getByRole("combobox", { name: "ringtone" }));
    await user.click(await screen.findByRole("option", { name: "Radar" }));
    expect(onChange).toHaveBeenCalledWith({ ...ADA, ringtone: "Radar" });
    expect(sounded).toEqual([
      { wave: "triangle", hertz: 698 },
      { wave: "triangle", hertz: 698 },
      { wave: "triangle", hertz: 880 },
    ]);
  });

  it("shows an empty birthday's date picker only while its field has the focus", async () => {
    const user = userEvent.setup();
    edited({ ...ADA, birthday: "" });
    expect(screen.queryByRole("group", { name: "birthday date" })).toBeNull();
    await user.click(screen.getByRole("textbox", { name: "birthday" }));
    screen.getByRole("group", { name: "birthday date" });
    await user.click(screen.getByRole("textbox", { name: "note" }));
    expect(screen.queryByRole("group", { name: "birthday date" })).toBeNull();
  });

  it("shows a typed birthday in its date picker", () => {
    edited({ ...ADA, birthday: "March 14, 1980" });
    const picker = screen.getByRole("group", { name: "birthday date" });
    expect(within(picker).getByRole("spinbutton", { name: /year/i })).toHaveTextContent("1980");
    expect(within(picker).getByRole("spinbutton", { name: /month/i })).toHaveTextContent("3");
    expect(within(picker).getByRole("spinbutton", { name: /day/i })).toHaveTextContent("14");
  });

  it("writes a date picked as the card shows one", async () => {
    const user = userEvent.setup();
    const onChange = edited({ ...ADA, birthday: "March 14, 1980" });
    const picker = screen.getByRole("group", { name: "birthday date" });
    await user.click(within(picker).getByRole("spinbutton", { name: /day/i }));
    await user.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenCalledWith({ ...ADA, birthday: "March 15, 1980" });
  });

  it("keeps a birthday with no year as it was typed", async () => {
    const user = userEvent.setup();
    const onChange = edited(ADA);
    await user.type(screen.getByRole("textbox", { name: "birthday" }), "M");
    expect(onChange).toHaveBeenLastCalledWith({ ...ADA, birthday: "M" });
  });

  it("keeps a note's lines", async () => {
    const user = userEvent.setup();
    const onChange = edited({ ...ADA, note: "one" });
    const note = screen.getByRole("textbox", { name: "note" });
    expect(note.tagName).toBe("TEXTAREA");
    await user.type(note, "{Enter}");
    expect(onChange).toHaveBeenCalledWith({ ...ADA, note: "one\n" });
  });
});
