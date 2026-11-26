import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./index";

describe("Avatar", () => {
  it("shows the silhouette without a picture or initials, and is named by alt", () => {
    render(<Avatar alt="Me" />);
    const avatar = screen.getByRole("img", { name: "Me" });
    expect(avatar).toHaveClass("mac-avatar");
    expect(avatar.tagName).toBe("SPAN");
    expect(avatar.querySelector(".mac-avatar-fallback svg.mac-avatar-glyph")).not.toBeNull();
    expect(avatar.querySelector("img")).toBeNull();
  });

  it("shows initials in place of the silhouette", () => {
    render(<Avatar alt="Stephen Hackett">SH</Avatar>);
    const avatar = screen.getByRole("img", { name: "Stephen Hackett" });
    expect(avatar).toHaveTextContent("SH");
    expect(avatar.querySelector("svg")).toBeNull();
  });

  it("is hidden from assistive technology when nothing names it", () => {
    render(<Avatar data-testid="avatar" />);
    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).not.toHaveAttribute("role");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps the fallback until the picture has loaded", () => {
    // The test environment never loads an image: the avatar must show the initials.
    render(
      <Avatar alt="Aqua Bondi" src="https://example.invalid/picture.png">
        AB
      </Avatar>,
    );
    const avatar = screen.getByRole("img", { name: "Aqua Bondi" });
    expect(avatar).toHaveTextContent("AB");
    expect(avatar.querySelector("img")).toBeNull();
  });

  it("sets the diameter from size, 29 pt by default", () => {
    const { rerender } = render(<Avatar alt="Me" />);
    const avatar = screen.getByRole("img", { name: "Me" });
    expect(avatar.style.getPropertyValue("--mac-avatar-size")).toBe("29px");
    rerender(<Avatar alt="Me" size={48} />);
    expect(avatar.style.getPropertyValue("--mac-avatar-size")).toBe("48px");
  });

  it("keeps the diameter when style is a function of the avatar's state", () => {
    render(<Avatar alt="Me" size={40} style={() => ({ margin: 4 })} />);
    const avatar = screen.getByRole("img", { name: "Me" });
    expect(avatar.style.getPropertyValue("--mac-avatar-size")).toBe("40px");
    expect(avatar).toHaveStyle({ margin: "4px" });
  });

  it("forwards ref, className, style and other attributes to the root", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <Avatar
        ref={ref}
        alt="Me"
        className="extra"
        style={{ margin: 4 }}
        id="me"
        data-person="7"
        aria-label="My picture"
      />,
    );
    expect(ref.current).toHaveClass("mac-avatar", "extra");
    expect(ref.current).toHaveStyle({ margin: "4px" });
    expect(ref.current).toHaveAttribute("id", "me");
    expect(ref.current).toHaveAttribute("data-person", "7");
    // An explicit label wins over alt.
    expect(screen.getByRole("img", { name: "My picture" })).toBe(ref.current);
  });
});
