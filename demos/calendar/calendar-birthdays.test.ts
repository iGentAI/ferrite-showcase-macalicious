import { describe, expect, it } from "vitest";
import type { Contact } from "../contacts/contacts-data";
import { birthdayEntries, parseBirthday } from "./calendar-birthdays";
import { occurrences } from "./calendar-recurrence";

describe("parseBirthday", () => {
  it.each([
    ["March 14", 2, 14],
    ["Mar 14, 1980", 2, 14],
    ["sept. 3", 8, 3],
    ["14 March", 2, 14],
    ["3rd May 1999", 4, 3],
    ["3/14", 2, 14],
    ["3/14/1980", 2, 14],
    ["1980-03-14", 2, 14],
    ["February 29", 1, 29],
  ])("reads %s", (typed, month, day) => {
    expect(parseBirthday(typed)).toEqual({ month, day });
  });

  it.each(["", "soon", "Marvel 4", "13/2", "February 30", "April 31", "March 0", "Ma 3"])(
    "reads no date in %j",
    (typed) => {
      expect(parseBirthday(typed)).toBeNull();
    },
  );
});

describe("birthdayEntries", () => {
  const card = (fields: Partial<Contact>) => ({ id: "a", ...fields }) as Contact;

  it("makes a birthday that comes back each year under the card's name", () => {
    const [entry, ...rest] = birthdayEntries([
      card({ first: "Ada", last: "Byron", birthday: "December 10" }),
      card({ id: "b", first: "No", last: "Date" }),
      card({ id: "c", first: "Bad", last: "Date", birthday: "sometime" }),
    ]);
    expect(rest).toEqual([]);
    expect(entry?.title).toBe("Ada Byron\u2019s Birthday");
    expect(entry?.calendar).toBe("birthdays");
    const [seen] = occurrences(
      entry as NonNullable<typeof entry>,
      new Date(2031, 11, 1),
      new Date(2031, 11, 31),
    );
    expect(seen?.start).toEqual(new Date(2031, 11, 10));
    expect(seen?.end).toEqual(new Date(2031, 11, 11));
    expect(seen?.allDay).toBe(true);
  });

  const onDays = (birthday: string, year: number) => {
    const [entry] = birthdayEntries([card({ first: "Ada", last: "Byron", birthday })]);
    return occurrences(
      entry as NonNullable<typeof entry>,
      new Date(year, 0, 1),
      new Date(year + 1, 0, 1),
    ).map((seen) => seen.start);
  };

  it("shows a birthday in the years before 2000", () => {
    expect(onDays("3/14/1980", 1999)).toEqual([new Date(1999, 2, 14)]);
  });

  it("keeps February 29 to the leap years", () => {
    expect(onDays("February 29", 2024)).toEqual([new Date(2024, 1, 29)]);
    expect(onDays("February 29", 2023)).toEqual([]);
  });
});
