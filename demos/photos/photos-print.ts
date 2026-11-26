/**
 * Prints pictures: the browser's print dialog over a hidden page holding them, one to a sheet. `done`
 * runs when the page has gone, so its caller can give back the addresses.
 */
export function printPictures(urls: readonly string[], title: string, done: () => void) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;";
  document.body.append(frame);
  const page = frame.contentDocument;
  if (!page) {
    frame.remove();
    done();
    return;
  }
  page.title = title;
  page.body.style.margin = "0";
  const images = urls.map((url) => {
    const image = page.createElement("img");
    image.src = url;
    image.style.cssText =
      "display:block;max-width:100%;max-height:100vh;margin:auto;break-after:page;";
    page.body.append(image);
    return image.decode().catch(() => {});
  });
  void Promise.all(images).then(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => {
      frame.remove();
      done();
    }, 1000);
  });
}
