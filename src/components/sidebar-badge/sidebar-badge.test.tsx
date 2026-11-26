import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { SidebarBadge } from "./index";

describe("SidebarBadge", () => {
  it("renders its count as plain text in a pill by default", () => {
    render(<SidebarBadge>12</SidebarBadge>);
    const badge = screen.getByText("12");
    expect(badge).toHaveClass("mac-sidebar-badge");
    expect(badge).toHaveAttribute("data-variant", "pill");
    expect(badge).not.toHaveAttribute("data-selected");
    expect(badge).not.toHaveAttribute("data-emphasized");
    expect(badge).not.toHaveAttribute("role");
    expect(badge).not.toHaveAttribute("aria-hidden");
    expect(badge).not.toHaveAttribute("tabindex");
  });

  it("reflects the variant and the row's selection", () => {
    render(
      <SidebarBadge variant="plain" selected emphasized>
        5
      </SidebarBadge>,
    );
    const badge = screen.getByText("5");
    expect(badge).toHaveAttribute("data-variant", "plain");
    expect(badge).toHaveAttribute("data-selected");
    expect(badge).toHaveAttribute("data-emphasized");
  });

  it("is emphasised only on a selected row", () => {
    render(<SidebarBadge emphasized>5</SidebarBadge>);
    expect(screen.getByText("5")).not.toHaveAttribute("data-emphasized");
  });

  it("contributes its count to the accessible name of the row that holds it", () => {
    render(
      <ul>
        <li>
          <button type="button">
            Drafts <SidebarBadge>1</SidebarBadge>
          </button>
        </li>
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Drafts 1" })).toBeInTheDocument();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <SidebarBadge ref={ref} className="extra" id="count" aria-label="3 unread">
        3
      </SidebarBadge>,
    );
    expect(ref.current).toHaveClass("mac-sidebar-badge", "extra");
    expect(ref.current).toHaveAttribute("id", "count");
    expect(ref.current).toHaveAttribute("aria-label", "3 unread");
  });
});
