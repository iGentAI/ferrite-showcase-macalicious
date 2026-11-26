import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../system-preferences";

/*
 * Tests every pane owes, written once: each test opens the pane anew for every control of one
 * kind it finds enabled, uses the control and expects what a person would see. A pane's own
 * test file calls `describePaneControls` and adds what is particular to the pane. Not a pane
 * and not a test file itself; only test files import it.
 */

export interface PaneControlsOptions {
  /** Settings the pane opens with, as `defaultSettings` of the window. */
  settings?: Record<string, unknown>;
  /** Called after the pane opens, to reach a state: unlock the pane, choose a row. */
  prepare?: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
  /**
   * How many tests the controls of each kind are spread over, a whole number from 1. Every
   * control is used in a window opened anew, so a pane with many controls of one kind
   * (Spotlight has twenty-one checkboxes) renders the window that many times in one test,
   * which is slow on a busy machine. With `parts`, test k of n takes every nth control from
   * the kth. 1 when left out.
   */
  parts?: number;
}

/** The number of parts, checked once: a value that is not a whole number from 1 is refused. */
function partsOf(id: string, options: PaneControlsOptions) {
  const parts = options.parts ?? 1;
  if (!Number.isInteger(parts) || parts < 1)
    throw new Error(`${id}: parts must be a whole number from 1, not ${String(options.parts)}`);
  return parts;
}

/** Open the pane and return the controls of one role inside its window. */
async function open(id: string, role: string, options: PaneControlsOptions) {
  cleanup();
  const user = userEvent.setup();
  render(<SystemPreferences defaultPane={id} defaultSettings={options.settings} />);
  await options.prepare?.(user);
  const pane = document.querySelector<HTMLElement>(`[data-pane="${id}"]`);
  if (!pane) throw new Error(`the pane ${id} did not open`);
  return { user, controls: within(pane).queryAllByRole(role) };
}

const disabled = (control: HTMLElement) =>
  control.matches(":disabled") || control.getAttribute("aria-disabled") === "true";

/**
 * Use every control of a role in turn, each in a pane opened anew; returns how many were used.
 * With `part`, only every `parts`-th control from that one. The first pane opened also
 * says how many controls there are, so a pane is opened once per control and not once more.
 */
async function each(
  id: string,
  role: string,
  options: PaneControlsOptions,
  use: (control: HTMLElement, user: ReturnType<typeof userEvent.setup>) => Promise<void>,
  wanted: (control: HTMLElement) => boolean = () => true,
  part?: { index: number; of: number },
) {
  const step = part?.of ?? 1;
  let count = Number.POSITIVE_INFINITY;
  let used = 0;
  for (let index = part?.index ?? 0; index < count; index += step) {
    const { user, controls } = await open(id, role, options);
    count = controls.length;
    const control = controls[index];
    if (!control || disabled(control) || !wanted(control)) continue;
    await use(control, user);
    used++;
  }
  return used;
}

/**
 * The tests of a pane's controls by kind: every enabled checkbox changes its state, every
 * enabled radio button can be chosen, every enabled pop-up button takes another choice, and
 * every button or link whose sheet no screenshot shows (`Uncaptured`), the help button among
 * them, says so in a popover. The first three are one test each, or `options.parts` tests each.
 */
export function describePaneControls(id: string, options: PaneControlsOptions = {}) {
  const parts = partsOf(id, options);
  const named = (title: string, part: number) =>
    parts > 1 ? `${title} (part ${part + 1} of ${parts})` : title;

  describe(`${id}: every control answers`, () => {
    for (let index = 0; index < parts; index++) {
      const part = { index, of: parts };
      it(named("changes the state of every enabled checkbox", index), async () => {
        await each(
          id,
          "checkbox",
          options,
          async (box, user) => {
            const before = box.getAttribute("aria-checked");
            await user.click(box);
            expect(box, box.textContent ?? "").not.toHaveAttribute("aria-checked", before ?? "");
          },
          undefined,
          part,
        );
      });

      it(named("chooses every enabled radio button", index), async () => {
        await each(
          id,
          "radio",
          options,
          async (radio, user) => {
            await user.click(radio);
            expect(radio, radio.textContent ?? "").toBeChecked();
          },
          undefined,
          part,
        );
      });

      it(named("takes another choice in every enabled pop-up button", index), async () => {
        await each(
          id,
          "combobox",
          options,
          async (button, user) => {
            await user.click(button);
            // The menu is in a portal, outside the window: a pane may hold lists of its own.
            const items = await waitFor(() => {
              const found = screen
                .getAllByRole("option")
                .filter((item) => !item.closest("[data-pane]"));
              expect(found.length).toBeGreaterThan(0);
              return found;
            });
            const other = items.find(
              (item) => item.getAttribute("aria-selected") !== "true" && !disabled(item),
            );
            if (!other) return; // a menu of one item has no other choice
            const title = other.textContent ?? "";
            await user.click(other);
            expect(button).toHaveTextContent(title);
          },
          undefined,
          part,
        );
      });
    }

    it("says so where no screenshot shows what a button or link opens", async () => {
      const answered = (control: HTMLElement) => control.getAttribute("aria-haspopup") === "dialog";
      let used = 0;
      for (const role of ["button", "link"]) {
        used += await each(
          id,
          role,
          options,
          async (control, user) => {
            await user.click(control);
            const popover = await screen.findByRole("dialog", { name: "Not part of this demo" });
            expect(popover).toHaveTextContent("No reference screenshot shows");
            await user.keyboard("{Escape}");
            expect(screen.queryByRole("dialog")).toBeNull();
            expect(control).toHaveFocus();
          },
          answered,
        );
      }
      // Every one of these panes has at least its help button.
      expect(used).toBeGreaterThan(0);
    });
  });
}
