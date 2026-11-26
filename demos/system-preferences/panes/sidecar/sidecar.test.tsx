import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const paneButton = (name: string) =>
  within(screen.getByRole("group", { name: "All preferences" })).getByRole("button", { name });

describe("Sidecar pane", () => {
  it("opens at its frame size in the captured state, with no device to connect to", () => {
    render(<SystemPreferences defaultPane="sidecar" />);
    expect(frame("Sidecar")).toHaveStyle({ width: "668px", height: "354px" });
    expect(screen.getByRole("checkbox", { name: "Show Sidebar" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show Touch Bar" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Enable double tap on Apple Pencil" }),
    ).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Sidebar position" })).toHaveTextContent(
      "on the left",
    );
    expect(screen.getByRole("combobox", { name: "Touch Bar position" })).toHaveTextContent(
      "on the bottom",
    );
    const connect = screen.getByRole("button", { name: "Connect to:" });
    expect(connect).toHaveTextContent("No Devices");
    expect(connect).toBeDisabled();
  });

  it("moves the sidebar with its pop-up button", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="sidecar" />);
    const position = screen.getByRole("combobox", { name: "Sidebar position" });
    await user.click(position);
    await user.click(await screen.findByRole("option", { name: "on the right" }));
    expect(position).toHaveTextContent("on the right");
  });

  it("keeps a checkbox's state while another pane is shown", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="sidecar" />);
    const doubleTap = () =>
      screen.getByRole("checkbox", { name: "Enable double tap on Apple Pencil" });
    await user.click(doubleTap());
    await user.click(screen.getByRole("checkbox", { name: "Show Touch Bar" }));
    expect(doubleTap()).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(paneButton("Sidecar"));
    expect(doubleTap()).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show Touch Bar" })).not.toBeChecked();
  });
});

describePaneControls("sidecar");
