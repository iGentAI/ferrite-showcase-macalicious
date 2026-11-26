import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { SectionHeader, SectionHeaderAction } from "./index";

describe("SectionHeader", () => {
  it("renders the title as a level 2 heading in a plain bar", () => {
    render(<SectionHeader data-testid="bar">Documents</SectionHeader>);
    const bar = screen.getByTestId("bar");
    expect(bar).toHaveClass("mac-section-header");
    expect(bar).toHaveAttribute("data-variant", "plain");
    expect(screen.getByRole("heading", { name: "Documents", level: 2 })).toHaveClass(
      "mac-section-header-title",
    );
    expect(bar.querySelector(".mac-section-header-accessory")).toBeNull();
  });

  it("reflects the variant and the heading level", () => {
    render(
      <SectionHeader data-testid="bar" variant="pinned" level={3}>
        Folders
      </SectionHeader>,
    );
    expect(screen.getByTestId("bar")).toHaveAttribute("data-variant", "pinned");
    expect(screen.getByRole("heading", { name: "Folders", level: 3 })).toBeInTheDocument();
  });

  it("puts the accessory after the title, outside the heading", () => {
    render(
      <SectionHeader accessory={<SectionHeaderAction>Show All (553)</SectionHeaderAction>}>
        Documents
      </SectionHeader>,
    );
    const heading = screen.getByRole("heading", { name: "Documents" });
    const action = screen.getByRole("button", { name: "Show All (553)" });
    expect(heading).not.toContainElement(action);
    expect(heading.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("names a group by the title alone through titleId, also with an accessory", () => {
    render(
      <>
        <SectionHeader
          titleId="documents-title"
          accessory={<SectionHeaderAction>Show All (553)</SectionHeaderAction>}
        >
          Documents
        </SectionHeader>
        <ul aria-labelledby="documents-title">
          <li>Aqua and Bondi.pdf</li>
        </ul>
      </>,
    );
    expect(screen.getByRole("heading", { name: "Documents" })).toHaveAttribute(
      "id",
      "documents-title",
    );
    expect(screen.getByRole("list", { name: "Documents" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /Show All/ })).not.toBeInTheDocument();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SectionHeader ref={ref} className="extra" id="documents">
        Documents
      </SectionHeader>,
    );
    expect(ref.current).toHaveClass("mac-section-header", "extra");
    expect(ref.current).toHaveAttribute("id", "documents");
  });
});

describe("SectionHeaderAction", () => {
  it("is a button that is pressed with the pointer and the keyboard", async () => {
    const onClick = vi.fn();
    render(<SectionHeaderAction onClick={onClick}>Show Less</SectionHeaderAction>);
    const action = screen.getByRole("button", { name: "Show Less" });
    expect(action).toHaveClass("mac-section-header-action");
    await userEvent.click(action);
    action.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does nothing while disabled", async () => {
    const onClick = vi.fn();
    render(
      <SectionHeaderAction disabled onClick={onClick}>
        Show All
      </SectionHeaderAction>,
    );
    const action = screen.getByRole("button", { name: "Show All" });
    expect(action).toBeDisabled();
    await userEvent.click(action);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps its class with a string or a state function, and forwards ref", () => {
    const ref = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <SectionHeaderAction ref={ref} className="extra">
        Show All
      </SectionHeaderAction>,
    );
    expect(ref.current).toHaveClass("mac-section-header-action", "extra");
    rerender(<SectionHeaderAction className={() => "from-state"}>Show All</SectionHeaderAction>);
    expect(screen.getByRole("button")).toHaveClass("mac-section-header-action", "from-state");
  });
});
