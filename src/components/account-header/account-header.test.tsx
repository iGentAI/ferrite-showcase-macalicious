import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PreferencePaneIcon } from "../preference-pane-icon";
import { AccountHeader } from "./index";

describe("AccountHeader", () => {
  it("is a group named by the account name, with the subtitle as readable text", () => {
    render(<AccountHeader name="Ada Appleseed" subtitle="Account, Cloud" />);
    const group = screen.getByRole("group", { name: "Ada Appleseed" });
    expect(group).toHaveClass("mac-account-header");
    expect(within(group).getByText("Account, Cloud")).toBeInTheDocument();
  });

  it("names two headers on one page separately", () => {
    render(
      <>
        <AccountHeader name="Ada" />
        <AccountHeader name="Grace" />
      </>,
    );
    expect(screen.getByRole("group", { name: "Ada" })).not.toBe(
      screen.getByRole("group", { name: "Grace" }),
    );
  });

  it("shows the picture as decoration: it adds nothing to the accessibility tree", () => {
    render(<AccountHeader name="Ada" avatar={<img src="data:," alt="portrait" />} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Ada" })).toBeInTheDocument();
  });

  it("leaves the picture's circle empty without an avatar, for the stylesheet's silhouette", () => {
    render(<AccountHeader name="Guest" data-testid="header" />);
    const avatar = screen.getByTestId("header").firstElementChild;
    expect(avatar).toHaveClass("mac-account-header-avatar");
    expect(avatar).toBeEmptyDOMElement();
  });

  it("renders no subtitle or destinations it was not given", () => {
    render(<AccountHeader name="Guest" data-testid="header" />);
    const header = screen.getByTestId("header");
    expect(header.querySelector(".mac-account-header-subtitle")).toBeNull();
    expect(header.querySelector(".mac-account-header-destinations")).toBeNull();
  });

  it("holds its destinations as separate buttons, reached in order and activated by keyboard", async () => {
    const user = userEvent.setup();
    const onAccount = vi.fn();
    const onFamily = vi.fn();
    render(
      <AccountHeader name="Ada" subtitle="Account, Cloud">
        <PreferencePaneIcon title="Account" onClick={onAccount} />
        <PreferencePaneIcon title={"Family\nSharing"} onClick={onFamily} />
      </AccountHeader>,
    );
    const group = screen.getByRole("group", { name: "Ada" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    await user.tab();
    expect(buttons[0]).toHaveFocus();
    await user.keyboard(" ");
    expect(onAccount).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(buttons[1]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onFamily).toHaveBeenCalledTimes(1);
  });

  it("has no action of its own: it is not focusable and clicking it does nothing", async () => {
    const user = userEvent.setup();
    render(<AccountHeader name="Ada" />);
    const group = screen.getByRole("group", { name: "Ada" });
    expect(group).not.toHaveAttribute("tabindex");
    await user.click(group);
    expect(document.body).toHaveFocus();
  });

  it("forwards ref, className, style and other attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <AccountHeader
        ref={ref}
        name="Ada"
        className="account"
        style={{ width: 400 }}
        id="account"
        data-signed-in=""
      />,
    );
    expect(ref.current).toHaveClass("mac-account-header", "account");
    expect(ref.current).toHaveStyle({ width: "400px" });
    expect(ref.current).toHaveAttribute("id", "account");
    expect(ref.current).toHaveAttribute("data-signed-in");
  });

  it("is named by a given aria-label or aria-labelledby instead of the account name", () => {
    render(
      <>
        <span id="heading">Signed-in account</span>
        <AccountHeader name="Ada" aria-label="Your account" data-testid="labelled" />
        <AccountHeader name="Grace" aria-labelledby="heading" />
      </>,
    );
    const labelled = screen.getByRole("group", { name: "Your account" });
    expect(labelled).toBe(screen.getByTestId("labelled"));
    expect(labelled).not.toHaveAttribute("aria-labelledby");
    expect(screen.getByRole("group", { name: "Signed-in account" })).toHaveTextContent("Grace");
    expect(screen.queryByRole("group", { name: "Ada" })).not.toBeInTheDocument();
  });
});
