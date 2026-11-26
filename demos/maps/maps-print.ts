import { canvasBlob, downloadBlob, JPEG_QUALITY, writePdf } from "../preview/preview-export";
import { type LatLon, type MapView, project, TILE_SIZE, turned, visibleTiles } from "./maps-geo";

/*
 * The map as a picture of its own, without the window: what File > Print and Export as PDF put
 * on paper. The tiles are read again with CORS (OpenStreetMap's answer `*`), or the canvas could
 * not be encoded.
 */

/** What the picture shows over the tiles. */
export interface MapPicture {
  view: MapView;
  /** The direction that is up on the map, in degrees clockwise from north. */
  heading?: number;
  width: number;
  height: number;
  pins: readonly LatLon[];
  route: readonly LatLon[];
  /** The colours of the page, which a canvas cannot read from tokens by name. */
  pinColor: string;
  routeColor: string;
}

const ATTRIBUTION = "© OpenStreetMap contributors";

/** The tile at `url`, or `null` when it does not load: the paper then has a gap, as the map does. */
const tileImage = (url: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });

/** The picture, or why there is none. */
export async function drawMap(picture: MapPicture): Promise<HTMLCanvasElement> {
  const { view, heading = 0, width, height, pins, route } = picture;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not draw the map.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const side = heading === 0 ? 0 : Math.ceil(Math.hypot(width, height));
  const tiles = side > 0 ? visibleTiles(view, side, side) : visibleTiles(view, width, height);
  const images = await Promise.all(tiles.map((tile) => tileImage(tile.url)));
  if (images.every((image) => image === null))
    throw new Error("The map's tiles could not be loaded.");
  context.save();
  if (side > 0) {
    context.translate(width / 2, height / 2);
    context.rotate((-heading * Math.PI) / 180);
    context.translate(-side / 2, -side / 2);
  }
  tiles.forEach((tile, at) => {
    const image = images[at];
    if (image) context.drawImage(image, tile.left, tile.top, TILE_SIZE, TILE_SIZE);
  });
  context.restore();
  const at = (point: LatLon) =>
    turned(project(point, view, width, height), -heading, width, height);
  if (route.length > 1) {
    context.strokeStyle = picture.routeColor;
    context.lineWidth = 5;
    context.lineJoin = "round";
    context.beginPath();
    route.forEach((point, index) => {
      const pixel = at(point);
      if (index === 0) context.moveTo(pixel.x, pixel.y);
      else context.lineTo(pixel.x, pixel.y);
    });
    context.stroke();
  }
  context.fillStyle = picture.pinColor;
  for (const pin of pins) {
    const pixel = at(pin);
    context.beginPath();
    context.arc(pixel.x, pixel.y, 7, 0, Math.PI * 2);
    context.fill();
  }
  context.font = "11px sans-serif";
  const credit = context.measureText(ATTRIBUTION).width + 8;
  context.fillStyle = "rgba(255, 255, 255, 0.8)";
  context.fillRect(canvas.width - credit, canvas.height - 16, credit, 16);
  context.fillStyle = "#000000";
  context.fillText(ATTRIBUTION, canvas.width - credit + 4, canvas.height - 4);
  return canvas;
}

/** A PDF of the picture, one page the size of the map, handed to the browser as a download. */
export async function exportMapPdf(canvas: HTMLCanvasElement, name: string): Promise<void> {
  const blob = await canvasBlob(canvas, "image/jpeg", JPEG_QUALITY);
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const pdf = writePdf(
    [
      {
        jpeg,
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
        width: canvas.width,
        height: canvas.height,
      },
    ],
    name,
  );
  downloadBlob(new Blob([pdf.slice().buffer], { type: "application/pdf" }), `${name}.pdf`);
}

/**
 * Prints the picture through the browser's print dialog, from a frame of its own that holds it
 * alone. The frame goes when printing has ended, or when the next map is printed.
 */
export function printMap(canvas: HTMLCanvasElement, name: string, host: Document = document): void {
  for (const earlier of host.querySelectorAll("iframe[data-maps-print]")) earlier.remove();
  const frame = host.createElement("iframe");
  frame.setAttribute("data-maps-print", name);
  frame.setAttribute("sandbox", "allow-modals allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  frame.srcdoc = `<!doctype html><html><body style="margin:0"><img alt="" style="width:100%" src="${canvas.toDataURL("image/jpeg", JPEG_QUALITY)}"></body></html>`;
  frame.addEventListener(
    "load",
    () => {
      const view = frame.contentWindow;
      view?.addEventListener("afterprint", () => frame.remove(), { once: true });
      view?.focus();
      view?.print();
    },
    { once: true },
  );
  host.body.append(frame);
}
