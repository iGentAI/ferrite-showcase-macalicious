import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  beginDesktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { AppStore } from "./app-store";
import { APP_STORE_AUTO_UPDATES } from "./app-store-preferences";

afterEach(() => {
  cleanup();
  forgetDesktopValues();
  beginDesktopValues();
});

it("the demo's Updates page follows Automatic Updates both ways", () => {
  render(<AppStore defaultSection="updates" />);
  expect(screen.getByText(/^Automatic Updates is on/)).toBeInTheDocument();
  act(() => receiveDesktopValues({ [APP_STORE_AUTO_UPDATES]: false }));
  expect(screen.getByText(/^Automatic Updates is off/)).toBeInTheDocument();
  act(() => receiveDesktopValues({ [APP_STORE_AUTO_UPDATES]: true }));
  expect(screen.getByText(/^Automatic Updates is on/)).toBeInTheDocument();
});
