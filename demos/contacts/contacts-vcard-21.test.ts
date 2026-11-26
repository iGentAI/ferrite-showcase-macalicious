import { describe, expect, it } from "vitest";
import type { Contact } from "./contacts-data";
import { cardsToVCard, parseVCards } from "./contacts-vcard";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";
const ANNA: Contact = {
  id: "a",
  account: "icloud",
  first: "Åsa",
  last: "Lind",
  phones: [{ label: "mobile", value: "555 0100" }],
  note: "Köper, gärna\nandra raden",
};

describe("vCard 2.1", () => {
  it("writes bare types, and quoted-printable where a value is not plain ASCII", () => {
    const text = cardsToVCard([{ contact: ANNA }], "2.1");
    const lines = text.split("\r\n");
    expect(lines).toContain("VERSION:2.1");
    expect(lines).toContain("TEL;CELL:555 0100");
    expect(lines).toContain("N;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:Lind;=C3=85sa;;;");
    expect(text.replace(/=\r\n/g, "")).toContain(
      "NOTE;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:K=C3=B6per, g=C3=A4rna=0Aandra raden",
    );
  });

  it("is read back with what it held", () => {
    const [read] = parseVCards(cardsToVCard([{ contact: ANNA }], "2.1"));
    expect(read?.card.first).toBe("Åsa");
    expect(read?.card.last).toBe("Lind");
    expect(read?.card.phones?.[0]?.value).toBe("555 0100");
    expect(read?.card.note).toBe("Köper, gärna\nandra raden");
  });

  it("folds a long quoted-printable line with a soft break, which reads back whole", () => {
    const note = "Å".repeat(60);
    const text = cardsToVCard([{ contact: { ...ANNA, note } }], "2.1");
    expect(text).toMatch(/=\r\n/);
    expect(parseVCards(text)[0]?.card.note).toBe(note);
  });

  it("writes a picture as BASE64", () => {
    const text = cardsToVCard([{ contact: ANNA, photo: JPEG }], "2.1").replace(/\r\n /g, "");
    expect(text).toContain("PHOTO;ENCODING=BASE64;JPEG:/9j/");
  });

  it("stays 3.0 unless asked", () => {
    expect(cardsToVCard([{ contact: ANNA }])).toContain("VERSION:3.0");
  });

  it("writes Windows Latin 1 for Outlook, and reads it back", () => {
    const card = { ...ANNA, note: "Köper €5\nandra" };
    const text = cardsToVCard([{ contact: card }], "2.1", "windows-1252");
    expect(text.split("\r\n")).toContain(
      "N;ENCODING=QUOTED-PRINTABLE;CHARSET=WINDOWS-1252:Lind;=C5sa;;;",
    );
    expect(text).toContain(
      "NOTE;ENCODING=QUOTED-PRINTABLE;CHARSET=WINDOWS-1252:K=F6per =805=0D=0Aandra",
    );
    const [read] = parseVCards(text);
    expect(read?.card.first).toBe("Åsa");
    expect(read?.card.note).toBe("Köper €5\nandra");
  });

  it("keeps a value Windows Latin 1 cannot hold in UTF-8, and says so", () => {
    const text = cardsToVCard([{ contact: { ...ANNA, first: "陈" } }], "2.1", "windows-1252");
    expect(text.split("\r\n")).toContain(
      "N;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:Lind;=E9=99=88;;;",
    );
    expect(parseVCards(text)[0]?.card.first).toBe("陈");
  });
});
