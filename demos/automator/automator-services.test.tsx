import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import { afterEach, describe, expect, it, vi } from "vitest";
// startServices imports these two when served; loaded here, no load outlasts the test that started it.
import "../desktop/desktop-siri";
import { ServicesItems, startServices } from "../desktop/desktop-services";
import { clearFinderSelection, publishFinderSelection } from "../finder/finder-selection";
import "./automator-background";
import { refreshSavedWorkflows } from "./automator-library";

const FINDER_WINDOW = {};
const quick = (id: string, receives?: string) => ({
  id,
  name: `Action ${id}`,
  kind: "quick-action",
  enabled: true,
  steps: [],
  ...(receives ? { receives } : {}),
});

async function withSaved(workflows: unknown[]) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ library: { workflows, tz: 0 }, rev: 1 }))),
  );
  await refreshSavedWorkflows();
}

async function rows(from: string) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <Menu>
      <MenuTrigger>Services</MenuTrigger>
      <MenuPopup>
        <ServicesItems apps={[]} from={from} none={<MenuItem disabled>None apply</MenuItem>} />
      </MenuPopup>
    </Menu>,
  );
  await user.click(screen.getByRole("button", { name: "Services" }));
  await waitFor(() => screen.getAllByRole("menuitem"));
  return screen.getAllByRole("menuitem").map((row) => row.textContent);
}

afterEach(() => {
  clearFinderSelection(FINDER_WINDOW);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a Quick Action in the Services menu", () => {
  it("takes files only from Finder's selection with Finder in front", async () => {
    await withSaved([quick("f"), quick("t", "text")]);
    expect(await rows("finder")).toEqual(["None apply"]);
  });

  it("lists a Quick Action on files while Finder has a selection", async () => {
    await withSaved([quick("f"), quick("t", "text")]);
    publishFinderSelection(FINDER_WINDOW, ["a"]);
    expect(await rows("finder")).toEqual(["Action f"]);
  });

  it("does not list it with another application in front", async () => {
    await withSaved([quick("f")]);
    publishFinderSelection(FINDER_WINDOW, ["a"]);
    expect(await rows("textedit")).toEqual(["None apply"]);
  });

  it("lists one that takes nothing always, and one that takes text over selected text", async () => {
    await withSaved([quick("n", "none"), quick("t", "text")]);
    const stop = startServices();
    const field = document.createElement("textarea");
    field.value = "words";
    document.body.append(field);
    field.focus();
    field.select();
    field.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(await rows("textedit")).toEqual(["Action t", "Action n"]);
    stop();
    field.remove();
  });
});
