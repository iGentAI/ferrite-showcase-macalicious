import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  beginDesktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { APPS } from "./app-store-data";
import { APP_RATINGS, AppStoreProduct, readRatings } from "./app-store-product";

afterEach(() => {
  cleanup();
  forgetDesktopValues();
  beginDesktopValues();
});

describe("readRatings", () => {
  it("keeps whole ratings of one to five stars, and nothing else", () => {
    expect(
      readRatings({
        books: { stars: 4, review: "Reads well" },
        maps: { stars: 1 },
        zero: { stars: 0, review: "" },
        six: { stars: 6, review: "" },
        half: { stars: 2.5, review: "" },
        words: { stars: "3", review: "" },
        none: null,
      }),
    ).toEqual({
      books: { stars: 4, review: "Reads well" },
      maps: { stars: 1, review: "" },
    });
  });

  it("reads nothing from what is not a record", () => {
    expect(readRatings("4")).toBeUndefined();
    expect(readRatings(null)).toBeUndefined();
  });
});

describe("the review field", () => {
  const page = () => (
    <AppStoreProduct
      app={APPS[0] as (typeof APPS)[number]}
      id="books"
      icon={null}
      offer={null}
      installed={false}
      link="https://desktop.example/#app-store/books"
      related={null}
    />
  );
  const field = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Your review" });
  const save = () => screen.getByRole("button", { name: "Save Review" });
  const stored = (review: string) =>
    act(() => receiveDesktopValues({ [APP_RATINGS]: { books: { stars: 3, review } } }));

  it("shows a saved review that arrives after the page opened, with nothing to save", () => {
    render(page());
    expect(field().value).toBe("");
    stored("Reads well");
    expect(field().value).toBe("Reads well");
    expect(save()).toBeDisabled();
  });

  it("follows a review changed elsewhere, but keeps what is being typed", async () => {
    stored("First");
    render(page());
    stored("Second");
    expect(field().value).toBe("Second");
    await userEvent.type(field(), " draft");
    stored("Third");
    expect(field().value).toBe("Second draft");
    expect(save()).toBeEnabled();
  });
});
