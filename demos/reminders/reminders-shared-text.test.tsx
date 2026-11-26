import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Reminders } from "./reminders";
import { reminderOfText, shareTextWithReminders, takeSharedTexts } from "./reminders-shared-text";

afterEach(() => {
  takeSharedTexts();
});

const row = (title: string) =>
  screen
    .getAllByRole("option")
    .find((option) => option.querySelector(".mac-reminders-text")?.textContent === title);

describe("text shared with Reminders", () => {
  it("titles the reminder with its first line and keeps the rest as notes", () => {
    expect(reminderOfText("\n  Ferry times \nLeaves at ten\nBack at four\n")).toEqual({
      title: "Ferry times",
      notes: "Leaves at ten\nBack at four",
    });
    expect(reminderOfText("Only a title")).toEqual({ title: "Only a title" });
    expect(reminderOfText("  \n ")).toBeNull();
  });

  it("makes a selected reminder in an open window", () => {
    render(<Reminders today="2019-10-03" />);
    act(() => {
      expect(shareTextWithReminders("Ferry times\nLeaves at ten")).toBe(true);
    });
    expect(row("Ferry times")).toHaveAttribute("aria-selected", "true");
    expect(takeSharedTexts()).toEqual([]);
  });

  it("waits for a window that opens later", () => {
    shareTextWithReminders("Pack a bag");
    render(<Reminders today="2019-10-03" />);
    expect(row("Pack a bag")).toBeDefined();
  });
});
