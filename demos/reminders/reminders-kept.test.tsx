import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectDesktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { RemindersView, type RemindersViewProps } from "./reminders";
import { REMINDERS_VIEW } from "./reminders-kept";

const TRIP = "sh-0123456789abcdef01234567";
const LISTS = [{ id: "groceries", name: "Groceries", color: "green" }] as const;
const shared = [
  { id: TRIP, name: "Trip", color: "purple", reminders: [], owned: true, members: [] },
] as unknown as RemindersViewProps["sharedLists"];

let stop = () => {};
afterEach(() => {
  stop();
  stop = () => {};
  forgetDesktopValues();
});

describe("a window going back to a list that arrives late", () => {
  it("shows it when it arrives, and keeps naming it until then", async () => {
    const write = vi.fn();
    receiveDesktopValues({
      [REMINDERS_VIEW]: { source: TRIP, sort: "title", showCompleted: false },
    });
    stop = connectDesktopValues(write);
    const onSourceChange = vi.fn();
    const props = {
      keepsView: true,
      defaultLists: LISTS,
      defaultReminders: [],
      defaultSource: "groceries",
      onSourceChange,
    } as RemindersViewProps;
    const { rerender } = render(<RemindersView {...props} />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSourceChange).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();

    rerender(<RemindersView {...props} sharedLists={shared} />);
    expect(onSourceChange).toHaveBeenCalledWith(TRIP);
    expect(write).not.toHaveBeenCalled();
  });

  it("keeps the person's choice of the list already shown, while the other has not arrived", async () => {
    const write = vi.fn();
    receiveDesktopValues({
      [REMINDERS_VIEW]: { source: TRIP, sort: "manual", showCompleted: false },
    });
    stop = connectDesktopValues(write);
    render(
      <RemindersView
        keepsView
        defaultLists={LISTS}
        defaultReminders={[]}
        defaultSource="groceries"
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    fireEvent.mouseDown(screen.getByRole("treeitem", { name: /^Groceries/ }));
    await waitFor(() =>
      expect(write).toHaveBeenCalledWith(
        REMINDERS_VIEW,
        expect.objectContaining({ source: "groceries" }),
      ),
    );
  });
});
