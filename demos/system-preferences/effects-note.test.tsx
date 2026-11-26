import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE } from "./catalogue";
import { EFFECTS_NOTE_HEIGHT, effectsNote, PANE_EFFECTS } from "./effects";
import { PANES } from "./panes";
import { SystemPreferences } from "./system-preferences";

// The settings are as loaded: the served desktop's settings session is `storage.ts`'s, tested
// with its server in `storage.test.tsx`; here only what the window shows under a pane matters.
vi.mock("./storage", async (original) => ({
  ...(await original<typeof import("./storage")>()),
  useServerSettings: () => false,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  for (const name of ["data-appearance", "data-accent", "data-highlight"]) {
    document.documentElement.removeAttribute(name);
  }
});

/** The window showing the pane `id`, and the frame sizes it asked for. */
function open(id: string) {
  const sizes: { width: number; height: number }[] = [];
  const view = render(
    <SystemPreferences defaultPane={id} onFrameSizeChange={(size) => sizes.push(size)} />,
  );
  const name = CATALOGUE.get(id)?.name ?? id;
  const pane = view.container.querySelector<HTMLElement>(`[data-pane="${id}"]`);
  if (!pane) throw new Error(`no pane ${name}`);
  return { view, pane, sizes };
}

describe("System Preferences on a desktop served by its Ferrite application", () => {
  it.each([...PANES].filter(([, pane]) => !pane.served).map(([id]) => id))(
    "says under %s which of its settings take effect there, and grows to show it",
    (id) => {
      vi.stubEnv("VITE_MACALICIOUS_API", "1");
      const { view, pane, sizes } = open(id);
      const note = within(view.container).getByRole("note");
      expect(note).toHaveTextContent(effectsNote(id));
      // Under the pane, not over its controls.
      expect(pane.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(pane.contains(note)).toBe(false);
      expect(sizes.at(-1)?.height).toBe((PANES.get(id)?.height ?? 0) + EFFECTS_NOTE_HEIGHT);
      // A setting the note says takes effect is a control the pane shows, under that name.
      for (const name of PANE_EFFECTS[id] ?? []) {
        if (!/^[A-Z]/.test(name)) continue;
        const shown = within(pane).queryAllByText(
          (text) => text.replace(/[:…]$/, "").trim() === name,
        );
        expect(shown.length, `${CATALOGUE.get(id)?.name} has no control "${name}"`).toBeGreaterThan(
          0,
        );
      }
      view.unmount();
    },
  );

  it("names what takes effect in General, Dock and Desktop & Screen Saver, and says the rest change nothing", () => {
    expect(effectsNote("general")).toBe(
      "On this desktop these settings take effect. Ask to keep changes is TextEdit's, whose documents have files; Close windows brings back the windows, as each application keeps its own contents.",
    );
    expect(effectsNote("dock")).toMatch(/Prefer tabs is for Terminal:/);
    expect(effectsNote("desktop-and-screen-saver")).toMatch(/the desktop picture/);
    expect(effectsNote("keyboard")).toBe(
      "On this desktop the Text tab, Dictation's On, Off and Language, and the viewers' check box take effect. The dimmed settings are your computer's, which a web page cannot read or change.",
    );
    expect(effectsNote("trackpad")).toBe(
      "The dimmed settings are your computer's, which a web page cannot read or change.",
    );
  });
});

describe("System Preferences anywhere else", () => {
  it.each([...PANES.keys()])("shows %s at its own height, with no note", (id) => {
    const { view, sizes } = open(id);
    expect(within(view.container).queryByRole("note")).toBeNull();
    expect(sizes.at(-1)?.height).toBe(PANES.get(id)?.height);
    view.unmount();
  });
});

// Keep `screen` in use for a failing test's output.
void screen;
