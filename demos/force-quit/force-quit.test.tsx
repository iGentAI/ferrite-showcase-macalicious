import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ForceQuit } from "./force-quit";
import { type ForceQuitApplication, forceQuit } from "./force-quit-data";

const mail: ForceQuitApplication = { id: "mail", name: "Mail" };
const safari: ForceQuitApplication = { id: "safari", name: "Safari" };
const finder: ForceQuitApplication = { id: "finder", name: "Finder", relaunches: true };

/** The window; while its sheet is open the page behind the sheet is hidden from assistive technology. */
const frame = (hidden = false) =>
  screen.getByRole("region", { name: "Force Quit Applications", hidden });
const rows = () => screen.queryAllByRole("option");
const listed = () => rows().map((row) => row.textContent);
const selected = () =>
  rows()
    .filter((row) => row.getAttribute("aria-selected") === "true")
    .map((row) => row.textContent);
/** The window's own button, whatever it reads. */
const action = () => within(frame()).getByRole("button", { name: /^(Force Quit|Relaunch)$/ });
const sheetGone = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
/** Answers the open confirmation and waits for it to go. */
const answer = async (user: UserEvent, button: string) => {
  const sheet = await screen.findByRole("dialog");
  await user.click(within(sheet).getByRole("button", { name: button }));
  await sheetGone();
};

describe("the window", () => {
  it("opens as captured: three applications, the first selected, minimize unavailable", () => {
    render(<ForceQuit />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("338px");
    expect(frame().style.height).toBe("307px");
    expect(listed()).toEqual(["Mail", "Safari", "Finder"]);
    expect(selected()).toEqual(["Mail"]);
    expect(action()).toHaveAccessibleName("Force Quit");
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Minimize" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeEnabled();
  });

  it("hands the window's props to the frame and the hosting callbacks to the controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    render(
      <ForceQuit
        state="inactive"
        data-host="desk"
        width={400}
        zoomRole="zoom"
        minimizeDisabled={false}
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
      />,
    );
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-host", "desk");
    expect(frame().style.width).toBe("400px");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: "Zoom" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
  });
});

describe("the list", () => {
  it("selects the application that is clicked and names the button after it", async () => {
    const user = userEvent.setup();
    render(<ForceQuit />);
    await user.click(screen.getByRole("option", { name: "Finder" }));
    expect(selected()).toEqual(["Finder"]);
    expect(action()).toHaveAccessibleName("Relaunch");
    await user.click(screen.getByRole("option", { name: "Safari" }));
    expect(selected()).toEqual(["Safari"]);
    expect(action()).toHaveAccessibleName("Force Quit");
  });

  it("marks an application that has stopped responding", () => {
    render(<ForceQuit defaultApplications={[mail, { ...safari, notResponding: true }]} />);
    expect(listed()).toEqual(["Mail", "Safari (not responding)"]);
  });

  it("selects the first application for an id that names none, and acts on that one", async () => {
    const user = userEvent.setup();
    const onForceQuit = vi.fn();
    render(<ForceQuit defaultSelectedId="gone" onForceQuit={onForceQuit} />);
    expect(selected()).toEqual(["Mail"]);
    await user.click(action());
    expect(await screen.findByRole("dialog")).toHaveAccessibleName(
      "Do you want to force “Mail” to quit?",
    );
    await answer(user, "Force Quit");
    expect(onForceQuit).toHaveBeenCalledWith(mail);
    expect(listed()).toEqual(["Safari", "Finder"]);
  });

  it("has nothing to quit when no application runs", () => {
    render(<ForceQuit defaultApplications={[]} />);
    expect(rows()).toEqual([]);
    expect(action()).toBeDisabled();
  });
});

describe("force quitting", () => {
  it("asks first, then removes the application, selects its neighbour and tells the host", async () => {
    const user = userEvent.setup();
    const onForceQuit = vi.fn();
    const onApplicationsChange = vi.fn();
    render(<ForceQuit onForceQuit={onForceQuit} onApplicationsChange={onApplicationsChange} />);
    expect(frame()).toHaveAttribute("data-window-state", "key");

    await user.click(action());
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAccessibleName("Do you want to force “Mail” to quit?");
    expect(sheet).toHaveAccessibleDescription("You will lose any unsaved changes.");
    // Nothing is quit before the sheet is answered, and the window behind it is main and held.
    expect(onForceQuit).not.toHaveBeenCalled();
    expect(frame(true)).toHaveAttribute("data-window-state", "main");
    expect(screen.getByRole("listbox", { hidden: true }).closest("[inert]")).not.toBe(null);

    await answer(user, "Force Quit");
    expect(listed()).toEqual(["Safari", "Finder"]);
    expect(selected()).toEqual(["Safari"]);
    expect(onForceQuit).toHaveBeenCalledTimes(1);
    expect(onForceQuit).toHaveBeenCalledWith(mail);
    expect(onApplicationsChange).toHaveBeenCalledTimes(1);
    expect(onApplicationsChange).toHaveBeenCalledWith([safari, finder]);
    expect(frame()).toHaveAttribute("data-window-state", "key");
    // The keyboard is back in the list, on the neighbour.
    expect(screen.getByRole("listbox", { name: "Applications" })).toHaveFocus();
  });

  it("keeps the application on Cancel and on Escape", async () => {
    const user = userEvent.setup();
    const onForceQuit = vi.fn();
    render(<ForceQuit onForceQuit={onForceQuit} />);

    // Return in the list asks about the selected application, as the button does.
    await user.click(screen.getByRole("option", { name: "Safari" }));
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toHaveAccessibleName(
      "Do you want to force “Safari” to quit?",
    );
    await answer(user, "Cancel");
    expect(frame()).toHaveAttribute("data-window-state", "key");

    await user.click(action());
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await sheetGone();

    expect(listed()).toEqual(["Mail", "Safari", "Finder"]);
    expect(selected()).toEqual(["Safari"]);
    expect(onForceQuit).not.toHaveBeenCalled();
  });

  it("relaunches Finder, which stays in the list", async () => {
    const user = userEvent.setup();
    const onForceQuit = vi.fn();
    const onApplicationsChange = vi.fn();
    render(<ForceQuit onForceQuit={onForceQuit} onApplicationsChange={onApplicationsChange} />);

    // A double click on a row asks about that application.
    await user.dblClick(screen.getByRole("option", { name: "Finder" }));
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAccessibleName("Do you want to relaunch “Finder”?");
    expect(sheet).not.toHaveAccessibleDescription();
    await answer(user, "Relaunch");

    expect(listed()).toEqual(["Mail", "Safari", "Finder"]);
    expect(selected()).toEqual(["Finder"]);
    expect(onForceQuit).toHaveBeenCalledTimes(1);
    expect(onForceQuit).toHaveBeenCalledWith(finder);
    expect(onApplicationsChange).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "the row that takes the place of the selected one is selected",
      quit: "mail",
      selectedId: "mail",
      applications: [safari, finder],
      next: "safari",
    },
    {
      name: "the row before it is selected when the selected one was the last",
      quit: "safari",
      selectedId: "safari",
      applications: [mail],
      next: "mail",
      from: [mail, safari],
    },
    {
      name: "another application's selection is kept",
      quit: "mail",
      selectedId: "finder",
      applications: [safari, finder],
      next: "finder",
    },
    {
      name: "nothing is selected once the list is empty",
      quit: "mail",
      selectedId: "mail",
      applications: [],
      next: undefined,
      from: [mail],
    },
  ])("$name", ({ quit, selectedId, applications, next, from = [mail, safari, finder] }) => {
    expect(forceQuit(from, quit, selectedId)).toEqual({ applications, selectedId: next });
  });
});

describe("a controlled list", () => {
  it("shows what it is given and asks for an application to go", async () => {
    const user = userEvent.setup();
    const onApplicationsChange = vi.fn();
    const { rerender } = render(
      <ForceQuit applications={[mail, safari]} onApplicationsChange={onApplicationsChange} />,
    );
    await user.click(action());
    await answer(user, "Force Quit");
    // The host has not followed: the list is still its own.
    expect(onApplicationsChange).toHaveBeenCalledWith([safari]);
    expect(listed()).toEqual(["Mail", "Safari"]);

    rerender(<ForceQuit applications={[safari]} onApplicationsChange={onApplicationsChange} />);
    expect(listed()).toEqual(["Safari"]);
    expect(selected()).toEqual(["Safari"]);
  });

  it("drops the question when the application it asks about leaves the list", async () => {
    const user = userEvent.setup();
    const onForceQuit = vi.fn();
    const { rerender } = render(
      <ForceQuit applications={[mail, safari, finder]} onForceQuit={onForceQuit} />,
    );
    await user.click(action());
    await screen.findByRole("dialog");

    rerender(<ForceQuit applications={[safari, finder]} onForceQuit={onForceQuit} />);
    await sheetGone();
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(selected()).toEqual(["Safari"]);
    expect(onForceQuit).not.toHaveBeenCalled();
  });
});
