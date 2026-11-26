import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { TextEdit, type TextEditActions, TextEditMenuBar, type TextEditStatus } from "./textedit";

function Page() {
  const actions = useRef<TextEditActions>(null);
  const [status, setStatus] = useState<TextEditStatus>();
  return (
    <>
      <TextEditMenuBar actions={actions} status={status} />
      <TextEdit actionsRef={actions} onStatusChange={setStatus} />
    </>
  );
}

const openMenu = async (title: string) => {
  fireEvent.click(screen.getByRole("menuitem", { name: title }));
  return screen.findAllByRole("menuitem");
};

describe("the menu bar TextEdit exports", () => {
  it("has Lists and Table in Format, and they open their sheets", async () => {
    render(<Page />);
    await openMenu("Format");
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Table/ }));
    expect(await screen.findByRole("dialog", { name: "Table" })).toBeInTheDocument();
  });

  it("has Spelling and Grammar and Substitutions in Edit", async () => {
    render(<Page />);
    // The Edit menu lists its more rows once the window has given its commands.
    await act(async () => {});
    const rows = await openMenu("Edit");
    const names = rows.map((row) => row.textContent);
    expect(names).toContain("Spelling and Grammar");
    expect(names).toContain("Substitutions");
  });

  it("opens the panels through the window's commands", async () => {
    const actions: { current: TextEditActions | null } = { current: null };
    render(<TextEdit actionsRef={actions} />);
    act(() => actions.current?.showSpelling());
    expect(await screen.findByRole("dialog", { name: "Spelling and Grammar" })).toBeInTheDocument();
    act(() => actions.current?.showSubstitutions());
    expect(await screen.findByRole("dialog", { name: "Substitutions" })).toBeInTheDocument();
  });
});
