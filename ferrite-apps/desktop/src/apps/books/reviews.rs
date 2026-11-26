//! The ratings and reviews of this desktop. Neither source has any, so a book's
//! reviews are what the people of this desktop wrote: one per person, in the space
//! everyone shares, under `reviews/<book>`.
//!
//! * `GET /api/books/reviews/<book>`: `{"reviews": [{"stars", "text", "at",
//!   "mine"}], "average": n | null}`, newest first. Who wrote a review is kept
//!   only to let them change it, and is never answered.
//! * `PUT` with `{"stars": 1..=5, "text"}`: writes the person's own review, and
//!   answers as `GET` does.
//! * `DELETE`: removes the person's own review, and answers as `GET` does.

use std::collections::BTreeMap;

use ferrite_app::{serde, serde_json};

use super::document;
use super::source::BookId;
use crate::http::Response;
use crate::module::{Request, Space};
use crate::session::Session;

/// The most characters of a review's text.
pub const MAX_TEXT: usize = 2_000;
/// The most reviews kept of one book.
pub const MAX_REVIEWS: usize = 200;
/// How many times a change meeting another's change is made again.
const ATTEMPTS: usize = 8;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Review {
    pub stars: u8,
    pub text: String,
    pub at: u64,
}

/// A book's reviews by who wrote them.
type Reviews = BTreeMap<String, Review>;

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    stars: u8,
    #[serde(default)]
    text: String,
}

/// Why a review may not be kept.
fn refusal(body: &Body) -> Option<String> {
    if !(1..=5).contains(&body.stars) {
        return Some("a rating is 1 to 5 stars".into());
    }
    (body.text.chars().count() > MAX_TEXT)
        .then(|| format!("a review has at most {MAX_TEXT} characters"))
}

/// What a person is answered: no review says who wrote it but their own, as `mine`.
fn listing(reviews: &Reviews, principal: &str) -> serde_json::Value {
    let mut listed: Vec<(&String, &Review)> = reviews.iter().collect();
    listed.sort_by(|a, b| b.1.at.cmp(&a.1.at));
    let answered: Vec<serde_json::Value> = listed
        .iter()
        .map(|(who, review)| {
            serde_json::json!({
                "stars": review.stars,
                "text": review.text,
                "at": review.at,
                "mine": who.as_str() == principal,
            })
        })
        .collect();
    let stars: u32 = reviews.values().map(|review| u32::from(review.stars)).sum();
    let average = (!reviews.is_empty()).then(|| f64::from(stars) / reviews.len() as f64);
    serde_json::json!({ "reviews": answered, "average": average })
}

/// Apply `change` to the stored reviews, again from what is stored if another's change came first.
async fn change(
    space: &mut Space<'_>,
    key: &str,
    change: impl Fn(&mut Reviews) -> Result<(), String>,
) -> std::io::Result<Result<Reviews, String>> {
    for _ in 0..ATTEMPTS {
        let current = document::read::<Reviews>(space, key).await?;
        let mut reviews = current.doc.unwrap_or_default();
        if let Err(message) = change(&mut reviews) {
            return Ok(Err(message));
        }
        match document::write(space, key, Some(current.rev), Some(&reviews)).await? {
            document::Saved::Stored(_) => return Ok(Ok(reviews)),
            document::Saved::Conflict(_) => continue,
        }
    }
    Err(std::io::Error::other(
        "the reviews kept changing during the save",
    ))
}

pub async fn answer(
    book: &str,
    request: &Request<'_>,
    session: &Session,
    space: &mut Space<'_>,
    now_ms: u64,
) -> Response {
    let Some(id) = BookId::parse(book) else {
        return Response::error(404, &format!("{book:?} is not a book of the Book Store"));
    };
    let key = format!("reviews/{}", id.as_string());
    let principal = session.principal.clone();
    let outcome = match request.method {
        "GET" => document::read::<Reviews>(space, &key)
            .await
            .map(|current| Ok(current.doc.unwrap_or_default())),
        "PUT" => {
            let body = match request.json::<Body>() {
                Ok(body) => body,
                Err(response) => return response,
            };
            if let Some(message) = refusal(&body) {
                return Response::error(400, &message);
            }
            change(space, &key, |reviews| {
                if reviews.len() >= MAX_REVIEWS && !reviews.contains_key(&principal) {
                    return Err(format!("a book keeps at most {MAX_REVIEWS} reviews"));
                }
                reviews.insert(
                    principal.clone(),
                    Review {
                        stars: body.stars,
                        text: body.text.clone(),
                        at: now_ms,
                    },
                );
                Ok(())
            })
            .await
        }
        "DELETE" => {
            change(space, &key, |reviews| {
                reviews.remove(&principal);
                Ok(())
            })
            .await
        }
        _ => return Response::method_not_allowed(),
    };
    match outcome {
        Ok(Ok(reviews)) => Response::json(200, &listing(&reviews, &principal)),
        Ok(Err(message)) => Response::error(400, &message),
        Err(error) => Response::error(503, &format!("storage failed: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn review(stars: u8, at: u64) -> Review {
        Review {
            stars,
            text: format!("{stars} stars"),
            at,
        }
    }

    #[test]
    fn a_listing_says_whose_is_mine_and_no_other_name() {
        let reviews = Reviews::from([
            ("person-a".to_string(), review(5, 10)),
            ("person-b".to_string(), review(2, 20)),
        ]);
        let answered = listing(&reviews, "person-a");
        assert_eq!(
            answered,
            serde_json::json!({
                "reviews": [
                    { "stars": 2, "text": "2 stars", "at": 20, "mine": false },
                    { "stars": 5, "text": "5 stars", "at": 10, "mine": true },
                ],
                "average": 3.5,
            })
        );
        assert!(!answered.to_string().contains("person-b"));
    }

    #[test]
    fn no_reviews_have_no_average() {
        let answered = listing(&Reviews::new(), "person-a");
        assert_eq!(answered["average"], serde_json::Value::Null);
    }

    #[test]
    fn a_review_is_held_to_its_limits() {
        let body = |stars, text: String| Body { stars, text };
        assert_eq!(refusal(&body(1, String::new())), None);
        assert_eq!(refusal(&body(5, "x".repeat(MAX_TEXT))), None);
        assert!(refusal(&body(0, String::new())).is_some());
        assert!(refusal(&body(6, String::new())).is_some());
        assert!(refusal(&body(5, "x".repeat(MAX_TEXT + 1))).is_some());
    }
}
