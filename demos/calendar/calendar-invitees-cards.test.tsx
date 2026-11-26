import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DesktopDragItem } from "../desktop/desktop-drag";
import { accountOfAddress, accountOfCard, InviteesEditor, notInvitable } from "./calendar-invitees";

const card = (user: string, name: string) =>
  ({ id: `address:card:${user}:c1`, name, kind: "file" }) as unknown as DesktopDragItem;

function Editor({
  lookup,
}: {
  lookup: (name: string) => Promise<{ name: string; fullName: string }>;
}) {
  const [names, setNames] = useState<string[]>([]);
  return (
    <InviteesEditor names={names} options={{ lookup }} onChange={setNames} onDone={() => {}} />
  );
}

const typeAndInvite = async (words: string) => {
  const field = screen.getByRole("textbox", { name: "Invitee" });
  await userEvent.type(field, words);
  fireEvent.keyDown(field, { key: "Enter" });
};

describe("inviting a card or an address", () => {
  it("takes this desktop's own addresses for their accounts", () => {
    expect(accountOfAddress("Ann@Macalicious")).toBe("ann");
    expect(accountOfAddress("ann@example.com")).toBe("");
    expect(accountOfCard(card("bob", "robert@example.com"))).toBe("bob");
    expect(accountOfCard(card("", "ann@macalicious"))).toBe("ann");
    expect(accountOfCard(card("", "ann@example.com"))).toBe("");
  });

  it("says why for each address outside the desktop", () => {
    expect(notInvitable(["a@x.org", "b@y.org"])).toBe(
      "“a@x.org” cannot be invited: invitations go between this desktop's accounts, and its Mail delivers only to them (name@macalicious). “b@y.org” cannot be invited: invitations go between this desktop's accounts, and its Mail delivers only to them (name@macalicious).",
    );
  });

  it("does not look an outside address up, and says why", async () => {
    const lookup = vi.fn();
    render(<Editor lookup={lookup} />);
    await typeAndInvite("pat@example.com");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "“pat@example.com” cannot be invited: invitations go between this desktop's accounts",
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it("invites the account a typed address of this desktop names", async () => {
    const lookup = vi.fn(async (name: string) => ({ name, fullName: "Ann Other" }));
    render(<Editor lookup={lookup} />);
    await typeAndInvite("ann@macalicious");
    await waitFor(() => expect(screen.getByText("Ann Other")).toBeInTheDocument());
    expect(lookup).toHaveBeenCalledWith("ann");
  });
});
