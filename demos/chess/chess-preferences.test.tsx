// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { ChessLive } from "./chess-live";

afterEach(cleanup);

const OnDesktop = ({ render: renderWindow }: DesktopSecondaryWindowProps) => (
  <>{renderWindow({} as Parameters<DesktopSecondaryWindowProps["render"]>[0])}</>
);

describe("Chess with no server", () => {
  it("opens its Preferences, and they change the board", async () => {
    render(<ChessLive DesktopWindow={OnDesktop} preferencesOpen />);
    const prefs = screen.getByRole("region", { name: "Chess Preferences" });
    expect(prefs).toBeTruthy();
    expect(screen.getByRole("grid", { name: "Chessboard" })).toBeTruthy();

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Board" }));
    await user.click(await screen.findByRole("option", { name: "Green" }));
    await waitFor(() =>
      expect(document.querySelector(".mac-chess")?.getAttribute("data-board-style")).toBe("green"),
    );
  });

  it("dims what this board has no use for", () => {
    render(<ChessLive DesktopWindow={OnDesktop} preferencesOpen />);
    expect(screen.getByRole("combobox", { name: "View" }).getAttribute("title")).toBe(
      "This browser cannot draw in 3D (no WebGL on graphics hardware): the board stays flat.",
    );
    const listening = screen.getByRole("checkbox", { name: "Listen for Spoken Commands" });
    expect(listening.getAttribute("aria-disabled")).toBe("true");
    expect(listening.closest("[title]")?.getAttribute("title")).toBe(
      "This browser has no speech recognizer: moves are made on the board.",
    );
    expect(
      screen.getByRole("combobox", { name: "Computer plays at" }).hasAttribute("data-disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("checkbox", { name: "Show my side at the bottom" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("shows no Preferences until they are asked for", () => {
    render(<ChessLive DesktopWindow={OnDesktop} />);
    expect(screen.queryByRole("region", { name: "Chess Preferences" })).toBeNull();
  });
});
