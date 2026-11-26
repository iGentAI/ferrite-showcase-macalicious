import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { requestOpenFile } from "../finder/finder-open";
import { Terminal } from "./terminal";

// This build has no drive to name a folder's path: the one path it is asked for stands in for it.
vi.mock("./terminal-window-state", async (original) => ({
  ...(await original<typeof import("./terminal-window-state")>()),
  shellPathOfItem: (id: string) => (id === "documents" ? "/Users/shackett/Documents" : null),
}));

it("opens its first window at a folder that waited for it, and no second window", async () => {
  requestOpenFile({ app: "terminal", id: "documents", name: "Documents", folder: "window" });
  render(<Terminal />);
  await waitFor(() =>
    expect(screen.getByRole("log", { name: "Terminal output" }).textContent).toContain(
      "shackett@ismhpro Documents %",
    ),
  );
  expect(screen.getAllByRole("log", { name: "Terminal output" })).toHaveLength(1);
});
