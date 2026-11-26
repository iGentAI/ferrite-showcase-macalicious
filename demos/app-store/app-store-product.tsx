"use client";

import { LevelIndicator } from "macalicious/level-indicator";
import { PushButton } from "macalicious/push-button";
import { ShareMenu } from "macalicious/share-menu";
import { TextField } from "macalicious/text-field";
import { type ReactNode, useState } from "react";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { LinkShareItems } from "../desktop/desktop-share-link";
import type { AppStoreApp } from "./app-store-data";

/** The person's own rating of an app; nobody else's reaches this desktop. */
export interface AppRating {
  stars: number;
  review: string;
}

export type AppRatings = Readonly<Record<string, AppRating>>;

export const APP_RATINGS = "app-store.ratings";
const NO_RATINGS: AppRatings = {};
export const MAX_REVIEW = 500;
const MAX_STARS = 5;
const NEEDS_STARS = "Choose a rating first.";

/** The ratings kept in the desktop's settings, with whatever of them reads. */
export function readRatings(stored: unknown): AppRatings | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const ratings: Record<string, AppRating> = {};
  for (const [id, rating] of Object.entries(stored)) {
    const { stars, review } = (rating ?? {}) as Partial<AppRating>;
    if (typeof stars !== "number" || !Number.isInteger(stars)) continue;
    if (stars < 1 || stars > MAX_STARS) continue;
    ratings[id] = { stars, review: typeof review === "string" ? review : "" };
  }
  return ratings;
}

export interface AppStoreProductProps {
  app: AppStoreApp;
  /** The app's id in the catalogue, which its rating is kept under. */
  id: string;
  icon: ReactNode;
  /** The offer button, as the lists show it. */
  offer: ReactNode;
  installed: boolean;
  link: string;
  /** Other apps of the category. */
  related: ReactNode;
}

/** An app's page: its offer and Share, the person's own rating and review, and what is known of it. */
export function AppStoreProduct({
  app,
  id,
  icon,
  offer,
  installed,
  link,
  related,
}: AppStoreProductProps) {
  const [ratings, setRatings] = useDesktopSetting(APP_RATINGS, readRatings, NO_RATINGS);
  const mine = ratings[id];
  // What is typed and not saved; otherwise the field shows the review as it is kept.
  const [draft, setDraft] = useState<string | null>(null);
  const review = draft ?? mine?.review ?? "";
  const keep = (stars: number, text: string) =>
    setRatings({ ...ratings, [id]: { stars, review: text } });
  const clear = () => {
    const { [id]: _gone, ...others } = ratings;
    setRatings(others);
    setDraft(null);
  };
  return (
    <>
      <div className="mac-app-store-product-head">
        <span className="mac-app-store-product-icon">{icon}</span>
        <div className="mac-app-store-product-name">
          <h1 className="mac-app-store-product-title">{app.title}</h1>
          <p className="mac-app-store-product-line">{app.subtitle}</p>
        </div>
        <div className="mac-app-store-product-actions">
          {offer}
          <ShareMenu modal={false} trigger={<PushButton aria-label="Share">Share</PushButton>}>
            <LinkShareItems url={link} title={app.title} from="app-store" />
          </ShareMenu>
        </div>
      </div>
      <section className="mac-app-store-product-part" aria-labelledby="app-store-ratings">
        <h2 id="app-store-ratings" className="mac-app-store-product-heading">
          Ratings &amp; Reviews
        </h2>
        <p className="mac-app-store-product-note">
          {mine
            ? `You rated this app ${mine.stars} of ${MAX_STARS}.`
            : "You have not rated this app."}{" "}
          Only your own rating is here: nobody else&rsquo;s reaches this desktop.
        </p>
        <div className="mac-app-store-product-rating">
          <LevelIndicator
            variant="rating"
            editable
            min={0}
            max={MAX_STARS}
            value={mine?.stars ?? 0}
            aria-label="Your rating"
            onValueChange={(stars) => {
              if (stars === 0) clear();
              else keep(stars, mine?.review ?? "");
            }}
          />
          <PushButton disabled={!mine && review === ""} onClick={clear}>
            Clear
          </PushButton>
        </div>
        <div className="mac-app-store-product-rating">
          <TextField
            className="mac-app-store-product-review"
            aria-label="Your review"
            placeholder="Write a review"
            maxLength={MAX_REVIEW}
            value={review}
            onValueChange={(value) => setDraft(String(value))}
          />
          <PushButton
            disabled={!mine || review === mine.review}
            title={mine ? undefined : NEEDS_STARS}
            onClick={() => {
              if (mine) keep(mine.stars, review);
              setDraft(null);
            }}
          >
            Save Review
          </PushButton>
        </div>
      </section>
      <section className="mac-app-store-product-part" aria-labelledby="app-store-information">
        <h2 id="app-store-information" className="mac-app-store-product-heading">
          Information
        </h2>
        <dl className="mac-app-store-product-facts">
          <dt>Category</dt>
          <dd>{app.category}</dd>
          <dt>Price</dt>
          <dd>Free</dd>
          <dt>In-App Purchases</dt>
          <dd>None</dd>
          <dt>On This Desktop</dt>
          <dd>{installed ? "Installed" : "Not installed"}</dd>
        </dl>
      </section>
      {related}
    </>
  );
}
