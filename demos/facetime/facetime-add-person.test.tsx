import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AddPerson } from "./facetime-add-person";

const PEOPLE = [
  { name: "Cara Mendes", to: "cara" },
  { name: "Martin Example", to: "martin" },
];

function Panel({ onAdd, unavailable }: { onAdd: (to: string) => void; unavailable?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <AddPerson
      people={PEOPLE}
      taken={["martin"]}
      open={open}
      unavailable={unavailable}
      onOpenChange={setOpen}
      onAdd={onAdd}
    />
  );
}

describe("Add Person", () => {
  it("opens a field that offers Contacts not in the call, and adds the one chosen", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<Panel onAdd={onAdd} />);
    await user.click(screen.getByRole("button", { name: "Add Person" }));
    const field = screen.getByRole("textbox", { name: "Person to add" });
    expect(field).toHaveFocus();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    await user.type(field, "mart");
    expect(screen.queryByRole("group", { name: "Contacts" })).toBeNull();
    await user.clear(field);
    await user.type(field, "car");
    const offered = screen.getByRole("group", { name: "Contacts" });
    await user.click(within(offered).getByRole("button", { name: "Cara Mendes" }));
    expect(field).toHaveValue("cara");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("cara");
  });

  it("adds what is typed on Return, and Escape puts the button back with nothing kept", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<Panel onAdd={onAdd} />);
    await user.click(screen.getByRole("button", { name: "Add Person" }));
    await user.keyboard("  someone {Enter}");
    expect(onAdd).toHaveBeenCalledWith("someone");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Add Person" }));
    expect(screen.getByRole("textbox", { name: "Person to add" })).toHaveValue("");
  });

  it("is dimmed and says why while the call has no room", () => {
    render(<Panel onAdd={() => {}} unavailable="A call holds at most 4 people." />);
    const button = screen.getByRole("button", { name: "Add Person" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "A call holds at most 4 people.");
  });
});
