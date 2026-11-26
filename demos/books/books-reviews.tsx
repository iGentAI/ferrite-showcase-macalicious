"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { EmptyState } from "macalicious/empty-state";
import { LevelIndicator } from "macalicious/level-indicator";
import { PushButton } from "macalicious/push-button";
import { TextView } from "macalicious/text-view";
import { useCallback, useEffect, useState } from "react";
import {
  BOOKS_LIMITS,
  type BookReviews,
  type BooksHighlight,
  fetchReviews,
  removeReview,
  saveReview,
} from "./books-server";

const ratings = (count: number) => (count === 1 ? "1 rating" : `${count} ratings`);

/**
 * A book's Ratings and Reviews. Neither source has any, so they are what people of this desktop
 * wrote, without names: the window says so. Each person has one rating with an optional review.
 */
export function BookReviewsSection({ book }: { book: string }) {
  const [known, setKnown] = useState<BookReviews | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const take = useCallback((next: BookReviews) => {
    setKnown(next);
    const mine = next.reviews.find((review) => review.mine);
    setStars(mine?.stars ?? 0);
    setText(mine?.text ?? "");
    setError(null);
  }, []);
  useEffect(() => {
    let live = true;
    setKnown(null);
    fetchReviews(book).then(
      (next) => {
        if (live) take(next);
      },
      (failure: unknown) => {
        if (live) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      live = false;
    };
  }, [book, take]);
  const change = (asked: Promise<BookReviews>) => {
    setSaving(true);
    asked
      .then(take, (failure: unknown) =>
        setError(failure instanceof Error ? failure.message : String(failure)),
      )
      .finally(() => setSaving(false));
  };
  const mine = known?.reviews.find((review) => review.mine);
  const others = known?.reviews.filter((review) => !review.mine) ?? [];
  return (
    <section className="mac-books-reviews" aria-label="Ratings and Reviews">
      <h2 className="mac-books-store-heading">Ratings and Reviews</h2>
      <p className="mac-books-reviews-source">
        Project Gutenberg and Standard Ebooks have no ratings: these come from people of this
        desktop, and show no names.
      </p>
      {known ? (
        <div className="mac-books-reviews-summary">
          {known.average === null ? (
            "No ratings on this desktop yet"
          ) : (
            <>
              <LevelIndicator
                variant="rating"
                min={0}
                max={5}
                value={known.average}
                aria-label={`Average rating: ${known.average.toFixed(1)} of 5`}
              />
              <span>
                {known.average.toFixed(1)} from {ratings(known.reviews.length)}
              </span>
            </>
          )}
        </div>
      ) : null}
      {error ? (
        <EmptyState role="status" className="mac-books-reviews-error">
          Reviews could not be reached: {error}
        </EmptyState>
      ) : null}
      {known ? (
        <form
          className="mac-books-reviews-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (stars > 0) change(saveReview(book, stars, text));
          }}
        >
          <LevelIndicator
            variant="rating"
            editable
            min={0}
            max={5}
            value={stars}
            onValueChange={setStars}
            aria-label="Your rating"
          />
          <div className="mac-books-reviews-text">
            <TextView
              aria-label="Your review"
              placeholder="Write a review (optional)"
              maxLength={BOOKS_LIMITS.note}
              value={text}
              onValueChange={setText}
            />
          </div>
          <div className="mac-books-reviews-actions">
            {mine ? (
              <PushButton disabled={saving} onClick={() => change(removeReview(book))}>
                Remove
              </PushButton>
            ) : null}
            <PushButton
              type="submit"
              variant="primary"
              disabled={saving || stars === 0}
              title={stars === 0 ? "Choose a number of stars first." : undefined}
            >
              {mine ? "Update Review" : "Submit"}
            </PushButton>
          </div>
        </form>
      ) : null}
      {others.length > 0 ? (
        <ul className="mac-books-reviews-list" aria-label="Reviews">
          {others.map((review) => (
            <li key={review.at} className="mac-books-reviews-item">
              <LevelIndicator
                variant="rating"
                min={0}
                max={5}
                value={review.stars}
                aria-label={`${review.stars} of 5 stars`}
              />
              <span className="mac-books-reviews-date">
                {new Date(review.at).toLocaleDateString()}
              </span>
              {review.text ? <p>{review.text}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Study Cards, in the Notes panel: one card for each highlight, in the book's order, its words on
 * the front and its note on the back. A click on the card turns it over.
 */
export function StudyCards({
  highlights,
  onDone,
}: {
  highlights: readonly BooksHighlight[];
  onDone: () => void;
}) {
  const [at, setAt] = useState(0);
  const [back, setBack] = useState(false);
  const card = highlights[Math.min(at, highlights.length - 1)];
  const go = (next: number) => {
    setAt(next);
    setBack(false);
  };
  return (
    <div className="mac-books-study">
      <BorderlessButton
        className="mac-books-study-card"
        data-color={card?.color}
        aria-label={back ? "Show the words" : "Show the note"}
        onClick={() => setBack((now) => !now)}
      >
        {back ? card?.note || "No note on this highlight." : card?.text}
      </BorderlessButton>
      <p className="mac-books-study-count" role="status">
        Card {at + 1} of {highlights.length}
      </p>
      <div className="mac-books-study-actions">
        <PushButton onClick={onDone}>Done</PushButton>
        <PushButton disabled={at === 0} onClick={() => go(at - 1)}>
          Previous
        </PushButton>
        <PushButton disabled={at >= highlights.length - 1} onClick={() => go(at + 1)}>
          Next
        </PushButton>
      </div>
    </div>
  );
}
