import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const open = () => render(<SystemPreferences defaultPane="desktop-and-screen-saver" />);
const sources = () => screen.getByRole("treegrid", { name: "Picture sources" });
const source = (name: string) => within(sources()).getByRole("row", { name });
const picture = (name: string) => screen.getByRole("button", { name });
const mode = () => screen.getByRole("combobox", { name: "Appearance of the desktop picture" });
const sentence = "This desktop picture changes throughout the day, based on your location.";

describe("Desktop & Screen Saver pane", () => {
  it("opens on Desktop at its frame size with the dynamic Catalina picture", () => {
    open();
    expect(screen.getByRole("region", { name: "Desktop & Screen Saver" })).toHaveStyle({
      width: "668px",
      height: "562px",
    });
    expect(screen.getByRole("tab", { name: "Desktop" })).toHaveAttribute("aria-selected", "true");
    expect(mode()).toHaveTextContent("Dynamic");
    expect(screen.getByText(sentence)).toBeVisible();

    expect(source("Desktop Pictures")).toHaveAttribute("aria-selected", "true");
    expect(source("Apple")).toHaveAttribute("aria-expanded", "true");
    expect(source("Folders")).toHaveAttribute("aria-expanded", "false");
    const dynamic = screen.getByRole("group", { name: "Dynamic Desktop" });
    expect(within(dynamic).getAllByRole("button")).toHaveLength(3);
    expect(within(dynamic).getByRole("button", { name: "Catalina" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    const stills = screen.getByRole("group", { name: "Desktop Pictures" });
    expect(within(stills).getAllByRole("button")).toHaveLength(8);

    // Under a dynamic desktop nothing changes the picture, as captured.
    expect(screen.getByRole("checkbox", { name: "Change picture:" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Random order" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "Change picture" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove the selected folder" })).toBeDisabled();
  });

  it("says why each dimmed control of the Desktop tab is dimmed", async () => {
    const user = userEvent.setup();
    open();
    const titled = (role: string, name: string) =>
      screen.getByRole(role, { name }).closest("[title]")?.getAttribute("title");
    const dynamic = "A Dynamic picture changes by itself through the day. Choose a still picture.";
    expect(titled("checkbox", "Change picture:")).toBe(dynamic);
    expect(titled("combobox", "Change picture")).toBe(dynamic);
    expect(titled("checkbox", "Random order")).toBe(dynamic);
    expect(titled("button", "Remove the selected folder")).toBe("Select a folder you added.");

    await user.click(picture("Mountains"));
    expect(titled("checkbox", "Change picture:")).toBeUndefined();
    expect(titled("combobox", "Change picture")).toBe("Turn on Change picture first.");
    expect(titled("checkbox", "Random order")).toBe("Turn on Change picture first.");
  });

  it("shows the sentence about the time of day only while the picture is Dynamic", async () => {
    const user = userEvent.setup();
    open();
    await user.click(mode());
    await user.click(await screen.findByRole("option", { name: "Dark (Still)" }));
    expect(mode()).toHaveTextContent("Dark (Still)");
    expect(screen.queryByText(sentence)).toBeNull();
  });

  it("takes a still picture, lets it change, and keeps that after leaving the pane", async () => {
    const user = userEvent.setup();
    open();
    await user.click(picture("Mountains"));
    expect(picture("Mountains")).toHaveAttribute("aria-current", "true");
    expect(picture("Catalina")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Mountains")).toBeVisible();
    // A still picture has no looks to choose from.
    expect(screen.queryByRole("combobox", { name: /Appearance/ })).toBeNull();

    const change = () => screen.getByRole("checkbox", { name: "Change picture:" });
    const random = () => screen.getByRole("checkbox", { name: "Random order" });
    expect(random()).toHaveAttribute("aria-disabled", "true");
    await user.click(change());
    expect(change()).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Change picture" })).toBeEnabled();
    await user.click(random());
    expect(random()).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(picture("Mountains")).toHaveAttribute("aria-current", "true");
    expect(change()).toBeChecked();
    expect(random()).toBeChecked();
  });

  it("lists colours for the desktop, says so for what is not captured, and removes a folder", async () => {
    const user = userEvent.setup();
    open();
    await user.click(within(sources()).getByText("Colors"));
    expect(source("Colors")).toHaveAttribute("aria-selected", "true");
    await user.click(picture("Teal"));
    expect(picture("Teal")).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("group", { name: "Dynamic Desktop" })).toBeNull();
    await user.click(within(sources()).getByText("Photos"));
    expect(screen.getByText("The pictures of Photos are not part of this demo.")).toBeVisible();

    // Folders opens with the Right Arrow key, and its folder can be taken away.
    await user.click(within(sources()).getByText("Folders"));
    await user.keyboard("{ArrowRight}");
    expect(source("Folders")).toHaveAttribute("aria-expanded", "true");
    await user.click(within(sources()).getByText("Pictures"));
    const remove = screen.getByRole("button", { name: "Remove the selected folder" });
    expect(remove).toBeEnabled();
    await user.click(remove);
    expect(within(sources()).queryByRole("row", { name: "Pictures" })).toBeNull();
    expect(source("Desktop Pictures")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("group", { name: "Dynamic Desktop" })).toBeVisible();

    // The panel that chooses a folder is in no screenshot.
    await user.click(screen.getByRole("button", { name: "Add a folder" }));
    expect(await screen.findByRole("dialog", { name: "Not part of this demo" })).toHaveTextContent(
      "“Add a folder”",
    );
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("tab", { name: "Screen Saver" }));
    expect(screen.getByRole("checkbox", { name: "Show with clock" })).toBeVisible();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Hot Corners are in Mission Control");
  });
});

describePaneControls("desktop-and-screen-saver");
