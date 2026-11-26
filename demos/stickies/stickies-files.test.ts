import { describe, expect, it, vi } from "vitest";
import { printPage } from "../textedit/textedit-drive";
import { exportName, noteAsRtf, printableNotes } from "./stickies-files";
import { noteRichText, storedHtml } from "./stickies-format";
import {
  MAX_PICTURE,
  MAX_WITH_PICTURES,
  notePictureAddress,
  pictureMarkup,
  roomForPicture,
} from "./stickies-pictures";
import { readStickiesTimes, timesTooltip } from "./stickies-settings";

const PICTURE = "data:image/webp;base64,UklGRg==";

function held(html: string) {
  const field = document.createElement("div");
  field.append(noteRichText(html, document));
  return field;
}

describe("a picture in a note", () => {
  it("takes a picture smaller than the smallest size it would shrink a large one to", async () => {
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 1;
        naturalHeight = 1;
        decode = async () => {};
      },
    );
    vi.stubGlobal("URL", { createObjectURL: () => "blob:p", revokeObjectURL: () => {} });
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage: () => {} } as unknown as RenderingContext);
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(PICTURE);
    await expect(notePictureAddress(new Blob())).resolves.toBe(PICTURE);
    getContext.mockRestore();
    toDataURL.mockRestore();
    vi.unstubAllGlobals();
  });

  it("comes back from its saved markup, with its name and in its place", () => {
    const field = held(`<div>Trip</div><img src="${PICTURE}" alt="Beach.png"><div>after</div>`);
    const image = field.querySelector("img");
    expect(image?.getAttribute("src")).toBe(PICTURE);
    expect(image?.alt).toBe("Beach.png");
    expect(field.textContent).toBe("Tripafter");
    expect(storedHtml(field)).toBe(
      `<div>Trip</div><img src="${PICTURE}" alt="Beach.png"><div>after</div>`,
    );
  });

  it("keeps nothing that loads or runs", () => {
    for (const html of [
      `<img src="https://example.com/p.png">`,
      `<img src="data:image/svg+xml;base64,PHN2Zz4=">`,
      `<img src="data:text/html;base64,PHNjcmlwdD4=">`,
      `<span data-note-picture="0"></span>`,
    ]) {
      expect(held(html).querySelector("img, [data-note-picture]"), html).toBeNull();
    }
    const field = held(`<img src="${PICTURE}" onerror="steal()" alt="&lt;b&gt;">`);
    expect(field.innerHTML).toBe(`<img src="${PICTURE}" alt="">`);
  });

  it("goes on a line of its own after text, with its name escaped", () => {
    expect(pictureMarkup(PICTURE, 'a "b" & <c>.png', true)).toBe(
      `<br><img src="${PICTURE}" alt="a &quot;b&quot; &amp; c.png">`,
    );
    expect(pictureMarkup(PICTURE, "a.png", false)).toBe(`<img src="${PICTURE}" alt="a.png">`);
  });

  it("has room while the note stays under what typing needs", () => {
    const address = "x".repeat(MAX_PICTURE);
    expect(roomForPicture("", address)).toBe(true);
    expect(roomForPicture("x".repeat(MAX_WITH_PICTURES - MAX_PICTURE), address)).toBe(true);
    expect(roomForPicture("x".repeat(MAX_WITH_PICTURES - MAX_PICTURE + 1), address)).toBe(false);
  });
});

describe("Export Text", () => {
  it("writes a note's formats as RTF, from its html or its lines", () => {
    const fromHtml = noteAsRtf("Bold\nplain", "<div><b>Bold</b></div><div>plain</div>");
    expect(fromHtml.startsWith("{\\rtf1")).toBe(true);
    expect(fromHtml).toMatch(/\\b\b[^}]*Bold/);
    expect(fromHtml).toContain("plain");
    expect(noteAsRtf("one\ntwo")).toContain("two");
  });

  it("gives the name the format's extension", () => {
    expect(exportName("Note", "plain")).toBe("Note.txt");
    expect(exportName("Note", "rtf")).toBe("Note.rtf");
    expect(exportName("Note.txt", "rtf")).toBe("Note.rtf");
    expect(exportName("Note.rtf", "plain")).toBe("Note.txt");
    expect(exportName("Note.md", "plain")).toBe("Note.md");
  });

  it("runs nothing of what a note's html holds", () => {
    const ran = vi.fn();
    vi.stubGlobal("ran", ran);
    noteAsRtf("x", '<img src="x" onerror="ran()"><script>ran()</script>x');
    expect(ran).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("a note's dates", () => {
  it("says only the dates it knows", () => {
    expect(timesTooltip(undefined)).toBeUndefined();
    expect(timesTooltip({ modified: 0 })).toMatch(/^Modified: /);
    expect(timesTooltip({ created: 0, modified: 0 })).toMatch(/^Created: .*\nModified: /);
  });

  it("reads only numbers back", () => {
    expect(readStickiesTimes({ a: { created: 5, modified: "x" } })).toEqual({
      a: { created: 5, modified: undefined },
    });
    expect(readStickiesTimes([])).toBeUndefined();
  });
});

describe("what Stickies prints", () => {
  it("prints on the paper Page Setup chose", () => {
    const page = { paper: "a4", orientation: "landscape", scale: 150 } as const;
    const printed = printableNotes([{ text: "Bold" }], page);
    expect(printed.page).toEqual(page);
    expect(printPage(printed)).toContain("@page{size:A4 landscape;margin:1in}");
    expect(printPage(printed)).toContain("html{zoom:1.5}");
    expect(printableNotes([{ text: "Bold" }]).page).toBeUndefined();
  });

  it("gives each note a page, its formats kept and plain text escaped", () => {
    const printed = printableNotes([
      { text: "Bold", html: "<b>Bold</b>" },
      { text: "a < b\n\nend" },
    ]);
    expect(printed.name).toBe("Bold");
    expect(printed.html).toBe(
      '<div style="break-after:page"><b>Bold</b></div>' +
        "<div>a &lt; b</div><div><br></div><div>end</div>",
    );
  });
});
