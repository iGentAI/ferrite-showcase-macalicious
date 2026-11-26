import { describe, expect, it, vi } from "vitest";
import {
  registerFileReceivers,
  SHARE_FILES_EVENT,
  takeSharedFiles,
} from "../desktop/desktop-share-link";
import { addImageToPhotos, imageFile, readPageHit } from "./safari-page-menu";

describe("Safari's page menu", () => {
  it("hands a picture of the page to Photos, with its bytes", async () => {
    const stop = registerFileReceivers([{ id: "photos", takesSharedFiles: true }]);
    const heard = vi.fn();
    window.addEventListener(SHARE_FILES_EVENT, heard);
    addImageToPhotos("data:image/png;base64,QQ==");
    addImageToPhotos("https://a.test/x.png");
    window.removeEventListener(SHARE_FILES_EVENT, heard);
    const shares = takeSharedFiles("photos");
    stop();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(shares).toHaveLength(1);
    const item = shares[0]?.items[0];
    expect(shares[0]?.from).toBe("safari");
    expect(item?.name).toBe("image.png");
    expect(item?.type).toBe("image/png");
    expect(await (await item?.bytes?.())?.text()).toBe("A");
  });
  it("takes from the frame only what has the expected shape", () => {
    expect(
      readPageHit({
        link: "javascript:alert(1)",
        linkText: 3,
        image: "https://a.test/x.png",
        text: "words",
      }),
    ).toEqual({ link: null, linkText: "", image: null, text: "words" });
    expect(
      readPageHit({ link: "https://a.test/", linkText: "A", image: "data:image/png;base64,QQ==" }),
    ).toEqual({
      link: "https://a.test/",
      linkText: "A",
      image: "data:image/png;base64,QQ==",
      text: "",
    });
    expect(readPageHit({ image: "data:text/html;base64,QQ==" }).image).toBeNull();
  });

  it("makes a file of a picture written into the page", async () => {
    const file = imageFile("data:image/svg+xml;base64,PHN2Zz4=");
    expect(file?.name).toBe("image.svg");
    expect(file?.blob.type).toBe("image/svg+xml");
    expect(await file?.blob.text()).toBe("<svg>");
    expect(imageFile("data:image/png;base64,***")).toBeNull();
    expect(imageFile("https://a.test/x.png")).toBeNull();
  });
});
