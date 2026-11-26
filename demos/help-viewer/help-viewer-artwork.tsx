import { AppTile, FinderTile, hasIcon } from "../desktop/desktop-artwork";
import { pagePicture, pictureUrl } from "./help-viewer-pictures";

/** The round picture over the welcome page's title: this desktop, 109 pt across. */
export function HeroArtwork() {
  return <img className="mac-help-viewer-hero-art" src={pictureUrl("desktop-round")} alt="" />;
}

/** The picture on the welcome page, where the captures have an illustration of a laptop. */
export function DeviceArtwork() {
  return (
    <img
      className="mac-help-viewer-device-art"
      src={pictureUrl("desktop")}
      alt="This desktop, with Finder and Notes open."
    />
  );
}

/** A page's picture, when it has one. */
export function PagePicture({ page }: { page: string }) {
  const picture = pagePicture(page);
  return picture ? (
    <img
      className="mac-help-viewer-page-picture"
      src={picture.url}
      alt={picture.alt}
      loading="lazy"
    />
  ) : null;
}

/** The Finder's icon before a search result, 18 pt. */
export function ResultIcon() {
  return (
    <span className="mac-help-viewer-result-icon" aria-hidden="true">
      <FinderTile />
    </span>
  );
}

/** An application's icon in the Share menu, 16 pt; a rounded square for what is no application. */
export function ServiceIcon({ app }: { app: string }) {
  return (
    <span className="mac-help-viewer-service-icon" aria-hidden="true">
      {hasIcon(app) ? <AppTile id={app} name={app} /> : null}
    </span>
  );
}
