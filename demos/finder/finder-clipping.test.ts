import { describe, expect, it } from "vitest";
import { addressOfLinkFile, isLinkFile } from "../safari/safari-files";
import { carriesClipping, clippingFile } from "./finder-clipping";

const reading = (data: Record<string, string>) => (type: string) => data[type] ?? "";

describe("what a drop of words or a link leaves in a folder", () => {
  it("takes a drag of words or a link, and leaves files to the upload", () => {
    expect(carriesClipping(["text/plain", "text/html"])).toBe(true);
    expect(carriesClipping(["text/uri-list"])).toBe(true);
    expect(carriesClipping(["Files", "text/plain"])).toBe(false);
    expect(carriesClipping(["text/html"])).toBe(false);
    expect(carriesClipping(["text/vcard"])).toBe(true);
    expect(carriesClipping(["Files", "text/vcard"])).toBe(false);
  });

  it("makes a card a .vcf file Contacts opens, before the words dragged with it", async () => {
    const card = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ann O\\, Lee\r\nEND:VCARD\r\n";
    const file = clippingFile(reading({ "text/vcard": card, "text/plain": "Ann" }));
    expect(file?.name).toBe("Ann O, Lee.vcf");
    expect(file?.type).toBe("text/vcard");
    expect(await file?.text()).toBe(card);
  });

  it("names a drag of several cards by how many it holds, and a card with no name by its words", () => {
    const one = "BEGIN:VCARD\r\nFN:A\r\nEND:VCARD\r\n";
    expect(clippingFile(reading({ "text/vcard": one + one }))?.name).toBe("2 Cards.vcf");
    expect(
      clippingFile(
        reading({ "text/vcard": "BEGIN:VCARD\r\nEND:VCARD\r\n", "text/plain": "Ann\nBo" }),
      )?.name,
    ).toBe("Ann.vcf");
  });

  it("saves a link as a file Safari opens, with its address intact", async () => {
    const file = clippingFile(
      reading({
        "text/uri-list": "# a comment\r\nhttps://a.test/?x=1&y=2\r\n",
        "text/plain": "A page: on links",
      }),
    );
    expect(file?.name).toBe("A page on links.webloc");
    expect(isLinkFile(file as File)).toBe(true);
    expect(addressOfLinkFile(await (file as File).text())).toBe("https://a.test/?x=1&y=2");
  });

  it("names a bare address by its host", () => {
    expect(clippingFile(reading({ "text/plain": "https://a.test/b" }))?.name).toBe("a.test.webloc");
  });

  it("keeps words in a text file named by the first of them", async () => {
    const file = clippingFile(reading({ "text/plain": "  one two/three four five six seven\n " }));
    expect(file?.name).toBe("one two three four five six seven.txt");
    expect(file?.type).toBe("text/plain");
    expect(await file?.text()).toBe("one two/three four five six seven");
  });

  it("keeps what only looks like an address as words", async () => {
    for (const words of ["https://%", "https://?"]) {
      const file = clippingFile(reading({ "text/plain": words }));
      expect(file?.type).toBe("text/plain");
      expect(await file?.text()).toBe(words);
    }
  });

  it("answers nothing for an empty drop", () => {
    expect(clippingFile(reading({}))).toBeNull();
  });
});
