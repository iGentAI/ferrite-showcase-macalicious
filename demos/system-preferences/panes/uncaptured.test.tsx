import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { describe, expect, it } from "vitest";
import { Uncaptured } from "./uncaptured";

describe("Uncaptured", () => {
  it("keeps the button as it is and answers a click with a popover that Escape closes", async () => {
    const user = userEvent.setup();
    render(
      <Uncaptured action="Advanced…">
        <PushButton style={{ width: 99 }}>Advanced…</PushButton>
      </Uncaptured>,
    );
    const button = screen.getByRole("button", { name: "Advanced…" });
    expect(button).toHaveStyle({ width: "99px" });
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(button);
    const popover = await screen.findByRole("dialog", { name: "Not part of this demo" });
    expect(popover).toHaveTextContent("No reference screenshot shows what “Advanced…” opens");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("answers for a link, which stays a link", async () => {
    const user = userEvent.setup();
    render(
      <Uncaptured action="Details…" nativeButton={false}>
        <Label color="link" render={<a href="#details" />}>
          Details…
        </Label>
      </Uncaptured>,
    );
    const link = screen.getByRole("link", { name: "Details…" });
    expect(link).toHaveAttribute("aria-expanded", "false");
    await user.click(link);
    expect(await screen.findByRole("dialog", { name: "Not part of this demo" })).toHaveTextContent(
      "“Details…”",
    );
    expect(link).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(link).toHaveAttribute("aria-expanded", "false");
    expect(link).toHaveFocus();
  });
});
