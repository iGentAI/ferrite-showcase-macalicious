import { describe, expect, it } from "vitest";
import type { Contact } from "./contacts-data";
import {
  birthdayFromVCard,
  birthdayToVCard,
  cardsToVCard,
  parseVCards,
  vCardFileName,
} from "./contacts-vcard";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";

const MARTIN: Contact = {
  id: "m",
  account: "icloud",
  first: "Martin",
  last: "Klein",
  company: "Harbor; Ferry, Inc.",
  phones: [
    { label: "mobile", value: "(555) 010-0142" },
    { label: "iPhone", value: "(555) 010-0143" },
    { label: "boat", value: "(555) 010-0144" },
  ],
  emails: [
    { label: "work", value: "martin@harborferry.example" },
    { label: "other", value: "mk@klein.example" },
  ],
  urls: [{ label: "home page", value: "https://klein.example/a,b;c" }],
  ims: [{ label: "home", value: "martin.k", service: "Jabber" }],
  birthday: "March 14",
  note: "Runs the Saturday crossings.\nBring a coat; it is cold, \\ windy.",
  user: "martin",
};

/** What a card keeps through a vCard: everything but its id, account, tones and picture. */
const kept = ({ id: _id, account: _account, ...card }: Contact) => card;

describe("Contacts' vCard files", () => {
  it("writes vCard 3.0 that reads back to the same card", () => {
    const text = cardsToVCard([{ contact: MARTIN }]);
    expect(text.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(text.endsWith("END:VCARD\r\n")).toBe(true);
    expect(text).toContain("N:Klein;Martin;;;\r\n");
    expect(text).toContain("FN:Martin Klein\r\n");
    expect(text).toContain("ORG:Harbor\\; Ferry\\, Inc.;\r\n");
    expect(text).toContain("TEL;TYPE=CELL:(555) 010-0142\r\n");
    expect(text).toContain("item1.TEL:(555) 010-0144\r\nitem1.X-ABLabel:boat\r\n");
    expect(text).toContain("EMAIL;TYPE=INTERNET;TYPE=WORK:martin@harborferry.example\r\n");
    expect(text).toContain("BDAY:--03-14\r\n");
    expect(text).toContain("X-MACALICIOUS-USER:martin\r\n");
    const [read, ...rest] = parseVCards(text);
    expect(rest).toEqual([]);
    expect(read).toEqual({ card: kept(MARTIN) });
  });

  it("keeps a company's card, a birthday with its year and the picture", () => {
    const company: Contact = {
      id: "c",
      account: "mac",
      first: "",
      last: "",
      company: "Island Post",
      isCompany: true,
      phones: [{ label: "main", value: "(555) 010-0100" }],
      birthday: "October 7, 1990",
    };
    const text = cardsToVCard([{ contact: company, photo: JPEG }, { contact: MARTIN }]);
    expect(text).toContain("FN:Island Post\r\nORG:Island Post;\r\nX-ABShowAs:COMPANY\r\n");
    expect(text).toContain("BDAY:1990-10-07\r\n");
    expect(text).toContain("PHOTO;ENCODING=b;TYPE=JPEG:/9j/");
    const cards = parseVCards(text);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({ card: kept(company), photo: JPEG, hadPhoto: true });
    expect(cards[1]?.card.user).toBe("martin");
  });

  it("folds long lines at 75 octets without cutting a character, and unfolds them", () => {
    const note = `${"é".repeat(60)} ${"x".repeat(100)}`;
    const text = cardsToVCard([{ contact: { ...MARTIN, note } }]);
    for (const line of text.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(parseVCards(text)[0]?.card.note).toBe(note);
  });

  it("reads what other address books write", () => {
    const apple = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Okafor;Ines;;;",
      "FN:Ines Okafor",
      "ORG:Harbor Ferry;Crossings",
      "TEL;type=IPHONE;type=CELL;type=VOICE;type=pref:(555) 010-0142",
      "item1.URL;type=pref:http://harborferry.example",
      "item1.X-ABLabel:_$!<HomePage>!$_",
      "IMPP;X-SERVICE-TYPE=AIM;type=HOME;type=pref:aim:ines",
      "X-JABBER;type=WORK:ines@jabber.example",
      "BDAY;value=date:1985-03-14",
      "NOTE:Two\\nlines",
      "PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRgABAQAA",
      "  AQABAAD/2wBDAA==",
      "END:VCARD",
    ].join("\n");
    const older = [
      "BEGIN:VCARD",
      "VERSION:2.1",
      "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Lindqvist;Tom=C3=A1s;;;",
      "TEL;CELL:(555) 010-0118",
      "TEL;HOME;FAX:(555) 010-0119",
      "EMAIL;INTERNET:tomas@lindqvist.example",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:4.0",
      "FN:Jun Watanabe",
      "PHOTO:data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:3.0",
      "END:VCARD",
    ].join("\r\n");
    const [ines] = parseVCards(apple);
    expect(ines?.card).toEqual({
      first: "Ines",
      last: "Okafor",
      company: "Harbor Ferry",
      department: "Crossings",
      phones: [{ label: "iPhone", value: "(555) 010-0142" }],
      urls: [{ label: "home page", value: "http://harborferry.example" }],
      ims: [
        { label: "home", value: "ines", service: "AIM" },
        { label: "work", value: "ines@jabber.example", service: "Jabber" },
      ],
      birthday: "March 14, 1985",
      note: "Two\nlines",
    });
    expect(ines?.photo).toBe(JPEG);
    const [tomas, jun, ...none] = parseVCards(older);
    expect(tomas?.card).toEqual({
      first: "Tomás",
      last: "Lindqvist",
      phones: [
        { label: "mobile", value: "(555) 010-0118" },
        { label: "home fax", value: "(555) 010-0119" },
      ],
      emails: [{ label: "other", value: "tomas@lindqvist.example" }],
    });
    expect(jun).toEqual({
      card: { first: "Jun", last: "Watanabe" },
      photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      hadPhoto: true,
    });
    expect(none).toEqual([]);
  });

  it("leaves out an account name that cannot be one, and a picture that is not a JPEG or PNG", () => {
    const text = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Vega;Robin;;;",
      "X-MACALICIOUS-USER:Robin Vega",
      "PHOTO;ENCODING=b;TYPE=GIF:R0lGODlhAQABAAAAACw=",
      "END:VCARD",
    ].join("\r\n");
    expect(parseVCards(text)).toEqual([{ card: { first: "Robin", last: "Vega" }, hadPhoto: true }]);
    expect(parseVCards("not a vCard")).toEqual([]);
  });

  it("turns birthdays into vCard dates and back", () => {
    expect(birthdayToVCard("March 14")).toBe("--03-14");
    expect(birthdayToVCard("Oct 7, 1990")).toBe("1990-10-07");
    expect(birthdayToVCard("10/7/1990")).toBe("1990-10-07");
    expect(birthdayToVCard("1990-10-07")).toBe("1990-10-07");
    expect(birthdayToVCard("next spring")).toBeUndefined();
    expect(birthdayToVCard("13/40")).toBeUndefined();
    expect(birthdayFromVCard("--0314")).toBe("March 14");
    expect(birthdayFromVCard("19901007")).toBe("October 7, 1990");
    const text = cardsToVCard([{ contact: { ...MARTIN, birthday: "next spring" } }]);
    expect(text).toContain("BDAY;VALUE=text:next spring\r\n");
    expect(parseVCards(text)[0]?.card.birthday).toBe("next spring");
  });

  it("names the file after the card, or counts the cards", () => {
    expect(vCardFileName([MARTIN])).toBe("Martin Klein.vcf");
    expect(vCardFileName([{ ...MARTIN, first: "A/B", last: "" }])).toBe("A-B.vcf");
    expect(vCardFileName([MARTIN, MARTIN])).toBe("2 Contacts.vcf");
  });
});
