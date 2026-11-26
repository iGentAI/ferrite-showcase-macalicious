import { describe, expect, it } from "vitest";
import { type Contact, tidy, withField } from "./contacts-data";
import {
  addToGroup,
  draggedCards,
  groupFileName,
  nextGroupName,
  removeFromGroups,
  sortGroups,
} from "./contacts-groups";
import { cardPrintLines } from "./contacts-print";
import { cardsFromServer } from "./contacts-server";
import { cardsToVCard, parseVCards } from "./contacts-vcard";

const group = (id: string, name: string, members: string[] = []) => ({ id, name, members });

describe("groups of the person's own", () => {
  it("numbers a new group's name when it is taken", () => {
    expect(nextGroupName([])).toBe("untitled group");
    expect(nextGroupName([group("a", "untitled group")])).toBe("untitled group 2");
    expect(nextGroupName([group("a", "untitled group"), group("b", "untitled group 2")])).toBe(
      "untitled group 3",
    );
  });

  it("adds a card once and takes it out of one group or of all", () => {
    const groups = [group("a", "A", ["x"]), group("b", "B", ["x", "y"])];
    expect(addToGroup(groups, "a", ["x", "y"])[0]?.members).toEqual(["x", "y"]);
    expect(removeFromGroups(groups, ["x"], "b").map(({ members }) => members)).toEqual([
      ["x"],
      ["y"],
    ]);
    expect(removeFromGroups(groups, ["x"]).map(({ members }) => members)).toEqual([[], ["y"]]);
  });

  it("sorts by name whatever the case, and makes a file name of it", () => {
    expect(sortGroups([group("a", "zed"), group("b", "Ann")]).map(({ id }) => id)).toEqual([
      "b",
      "a",
    ]);
    expect(groupFileName("Ferry / Crew")).toBe("Ferry - Crew.vcf");
  });

  it("reads only ids from a dragged row's data", () => {
    expect(draggedCards('["a",1,"b"]')).toEqual(["a", "b"]);
    expect(draggedCards("not json")).toEqual([]);
  });
});

const full: Contact = {
  id: "a",
  account: "icloud",
  first: "Ines",
  last: "Okafor",
  company: "Harbor Ferry",
  department: "Crossings",
  jobTitle: "Skipper",
  nickname: "Captain",
  phoneticFirst: "Ee-ness",
  phoneticLast: "Oh-ka-for",
  relatedNames: [{ label: "mother", value: "Ada Okafor" }],
  dates: [{ label: "anniversary", value: "June 2, 2015" }],
  socials: [{ label: "Twitter", value: "ines" }],
  addresses: [
    { label: "home", street: "1 Quay", city: "Port", state: "ME", zip: "04101", country: "USA" },
    { label: "boat", street: "Slip 4", city: "", state: "", zip: "", country: "" },
  ],
};

describe("the added fields of a card", () => {
  it("write a social profile as its page, with the user name beside it", () => {
    const text = cardsToVCard([{ contact: full }]);
    expect(text.replace(/\r\n /g, "")).toContain(
      "X-SOCIALPROFILE;TYPE=TWITTER;X-USER=ines:https://twitter.com/ines\r\n",
    );
    const mine = {
      ...full,
      socials: [{ label: "Mastodon", value: "https://social.example/@ines" }],
    };
    const [read] = parseVCards(cardsToVCard([{ contact: mine }]));
    expect(read?.card.socials).toEqual(mine.socials);
  });

  it("keep a custom service's page, which its user name cannot make, and a known service's name", () => {
    const page = "https://social.example/@ines";
    const profile = (type: string, url: string) =>
      parseVCards(
        `BEGIN:VCARD\r\nN:Okafor;Ines;;;\r\nX-SOCIALPROFILE;TYPE=${type};X-USER=ines:${url}\r\nEND:VCARD\r\n`,
      )[0]?.card;
    const custom = profile("MASTODON", page);
    expect(custom?.socials?.[0]?.value).toBe(page);
    expect(cardsToVCard([{ contact: { ...full, ...custom } }])).toContain(page);
    expect(profile("TWITTER", "https://twitter.com/ines")?.socials?.[0]?.value).toBe("ines");
    const old = "https://www.linkedin.com/pub/ines/1/2/3";
    expect(profile("LINKEDIN", old)?.socials?.[0]?.value).toBe(old);
  });

  it("keep a card whose only fields are its nickname or job title", () => {
    const card = (lines: string) => parseVCards(`BEGIN:VCARD\r\n${lines}\r\nEND:VCARD\r\n`);
    expect(card("NICKNAME:Captain")[0]?.card.nickname).toBe("Captain");
    expect(card("TITLE:Skipper")[0]?.card.jobTitle).toBe("Skipper");
  });

  it("keep an imported address's PO box, extended address and street lines on its street", () => {
    const [read] = parseVCards(
      "BEGIN:VCARD\r\nN:Vega;Robin;;;\r\nADR;TYPE=WORK:PO Box 9;Pier 2;1 Quay\\nFloor 3;Port;ME;04101;USA\r\nEND:VCARD\r\n",
    );
    expect(read?.card.addresses).toEqual([
      {
        label: "work",
        street: "PO Box 9, Pier 2, 1 Quay, Floor 3",
        city: "Port",
        state: "ME",
        zip: "04101",
        country: "USA",
      },
    ]);
  });
  it("come back from a vCard as they went", () => {
    const [read] = parseVCards(cardsToVCard([{ contact: full }]));
    const { id: _id, account: _account, ...expected } = full;
    expect(read?.card).toEqual(expected);
  });

  it("are read from what Contacts on a Mac writes", () => {
    const [read] = parseVCards(
      [
        "BEGIN:VCARD",
        "N:Vega;Robin;;;",
        "item1.X-ABRELATEDNAMES;type=pref:Sam",
        "item1.X-ABLabel:_$!<Sister>!$_",
        "item2.X-ABDATE:2015-06-02",
        "item2.X-ABLabel:_$!<Anniversary>!$_",
        "X-SOCIALPROFILE;type=linkedin;x-user=rvega:http://www.linkedin.com/in/rvega",
        "item3.ADR;type=HOME:;;2 Pier;Bath;ME;04530;",
        "END:VCARD",
      ].join("\r\n"),
    );
    expect(read?.card.relatedNames).toEqual([{ label: "sister", value: "Sam" }]);
    expect(read?.card.dates).toEqual([{ label: "anniversary", value: "June 2, 2015" }]);
    expect(read?.card.socials).toEqual([{ label: "LinkedIn", value: "rvega" }]);
    expect(read?.card.addresses).toEqual([
      { label: "home", street: "2 Pier", city: "Bath", state: "ME", zip: "04530", country: "" },
    ]);
  });

  it("stay empty until they are filled in, and go when Done leaves them empty", () => {
    const plain: Contact = { id: "b", account: "mac", first: "R", last: "V" };
    const added = withField(withField(plain, "nickname"), "address");
    expect(added.nickname).toBe("");
    expect(added.addresses).toEqual([]);
    const done = tidy({
      ...added,
      addresses: [{ label: "", street: " ", city: "", state: "", zip: "", country: "" }],
    });
    expect(done.nickname).toBeUndefined();
    expect(done.addresses).toBeUndefined();
    expect(withField({ ...plain, nickname: "Rob" }, "nickname").nickname).toBe("Rob");
  });

  it("are kept when read back from the server, and a card with a bad address is left out", () => {
    expect(cardsFromServer({ cards: [full] })).toEqual([full]);
    expect(cardsFromServer({ cards: [{ ...full, addresses: [{ label: "home" }] }] })).toEqual([]);
  });

  it("are printed", () => {
    expect(cardPrintLines(full)).toEqual([
      "Ee-ness Oh-ka-for",
      "Ines Okafor",
      "\u201cCaptain\u201d",
      "Skipper",
      "Crossings",
      "Harbor Ferry",
      "",
      "mother: Ada Okafor",
      "anniversary: June 2, 2015",
      "Twitter: ines",
      "home: 1 Quay, Port, ME 04101, USA",
      "boat: Slip 4",
    ]);
  });
});
