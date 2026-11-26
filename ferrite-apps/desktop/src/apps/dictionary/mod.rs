//! Dictionary's server half: real look-ups in public sources, cached for
//! everyone, and each person's recent look-ups.
//!
//! Sources, all keyless and reached through the egress handle [`EGRESS`]:
//!
//! * definitions and examples: Wiktionary's REST definitions
//!   ([`WIKTIONARY`], CC BY-SA 4.0, credited in every reply);
//! * pronunciation and its recording: the Free Dictionary API
//!   ([`FREE_DICTIONARY`]), which reads Wiktionary too; it answers slowly for
//!   a word it lacks, so it gets what is left of the budget and the entry
//!   goes without a pronunciation when it is late;
//! * thesaurus and the word list: Datamuse ([`DATAMUSE`]): words of similar
//!   meaning (its `ml` query, which reaches past strict synonyms for a word
//!   such as "serendipity" that has none) and antonyms with their parts of
//!   speech, and spelling suggestions for what is typed;
//! * encyclopedia: Wikipedia's API ([`WIKIPEDIA`]): the plain-text
//!   introduction of the article, redirects resolved (CC BY-SA 4.0).
//!
//! Routes:
//!
//! * `GET /api/dictionary/suggest?prefix=<text>`: `{"prefix", "words"}`, at
//!   most [`SUGGESTIONS`] words Datamuse suggests for what was typed.
//! * `GET /api/dictionary/entry?word=<text>`: `{"word", "found",
//!   "dictionary": {"pronunciation", "audio", "accents": {code: {"pronunciation",
//!   "audio"}}, "parts": [{"part",
//!   "senses": [{"text", "examples"}]}]} | null, "thesaurus": [{"part",
//!   "synonyms", "antonyms"}], "wikipedia": {"title", "extract", "url"} |
//!   null, "credits": [{"text", "href"}], "failed": [source], "at"}`.
//!   `found` is false when no source knows the word (still 200). A source
//!   that could not be reached is named in `failed`; when every source
//!   failed the reply is 502. A source that answered in a shape other than
//!   its documented one fails the look-up with 502, naming the source and
//!   the mismatch. A complete answer is kept in the shared space
//!   for [`CACHE_MS`], so the next person to look the word up waits for
//!   nothing. Each found word goes to the front of the person's history,
//!   unless the request says `history=0` (Spotlight's look-ups as you type,
//!   which are not the person's own look-ups).
//! * `GET /api/dictionary/history`: `{"history": [{"word", "at"}], "rev"}`,
//!   newest first, at most [`HISTORY`], `null` before the first look-up.
//! * `DELETE /api/dictionary/history`: forgets it (`document.rs`).
//! * `DELETE /api/dictionary/history?word=<word>`: takes that one word out of it.
//!
//! The "Apple" scope of the window has no public source; its entries are the page's own
//! (`demos/dictionary/dictionary-apple.ts`).

use ferrite_app::{serde, serde_json};
use serde_json::{json, Value};

use super::document;
use super::fetch::strict::{self, Strict};
use super::fetch::{self, Fetched};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "dictionary",
    title: "Dictionary",
    handle,
};

/// The egress handle `ferrite.json` declares for the four sources.
pub const EGRESS: &str = "dictionary";
pub const WIKTIONARY: &str = "https://en.wiktionary.org/api/rest_v1/page/definition/";
pub const FREE_DICTIONARY: &str = "https://api.dictionaryapi.dev/api/v2/entries/en/";
pub const DATAMUSE: &str = "https://api.datamuse.com/";
pub const WIKIPEDIA: &str = "https://en.wikipedia.org/w/api.php";

/// The most words a suggestion answers.
pub const SUGGESTIONS: usize = 40;
/// The most look-ups the history keeps.
pub const HISTORY: usize = 50;
/// How long a complete entry, and a suggestion list, is kept for everyone.
pub const CACHE_MS: u64 = 7 * 24 * 60 * 60 * 1000;
const SUGGEST_CACHE_MS: u64 = 24 * 60 * 60 * 1000;
/// The most a look-up spends on its sources, under the 8 s API deadline.
const BUDGET_MS: u64 = 6_000;
/// The most the whole look-up spends, its second asking included: the rest
/// of the 8 s API deadline is kept for the cache, the history and the reply.
const LOOKUP_MS: u64 = 6_500;
/// The least time worth giving Wiktionary to answer a second asking.
const MIN_RETRY_MS: u64 = 500;
/// The most a second asking of Wiktionary spends.
const RETRY_MS: u64 = 2_000;
/// The longest word or phrase looked up, in characters.
pub const MAX_WORD: usize = 80;
const MAX_SENSES: usize = 12;
const MAX_EXAMPLES: usize = 2;
const MAX_SYNONYMS: usize = 24;
const MAX_EXTRACT: usize = 1_200;
const HISTORY_KEY: &str = "history";
/// The sources whose failure together leaves nothing to show: dictionary,
/// thesaurus and wikipedia. An entry also names `pronunciation` in `failed`
/// when the Free Dictionary API did not answer readably; that alone leaves the
/// entry incomplete (not cached) but still worth showing.
const CONTENT_SOURCES: [&str; 3] = ["dictionary", "thesaurus", "wikipedia"];

/// One look-up in the history.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Past {
    pub word: String,
    pub at: u64,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    match (cx.request.method, cx.request.path) {
        ("GET", "/suggest") => match decoded(&cx, "prefix") {
            Ok(prefix) => suggest(&mut cx, &prefix).await,
            Err(response) => response,
        },
        ("GET", "/entry") => match decoded(&cx, "word") {
            Ok(word) => entry(&mut cx, &word).await,
            Err(response) => response,
        },
        (_, "/suggest" | "/entry") => Response::method_not_allowed(),
        ("GET", "/history") => {
            match document::read::<Vec<Past>>(&mut cx.storage.user(), HISTORY_KEY).await {
                Ok(current) => {
                    document::for_session(history_reply(current.doc.as_ref(), current.rev), session)
                }
                Err(error) => Response::error(503, &format!("storage failed: {error}")),
            }
        }
        ("DELETE", "/history") if cx.request.query_param("word").is_some() => {
            match decoded(&cx, "word") {
                Ok(word) => forget_word(&mut cx, &word).await,
                Err(response) => response,
            }
        }
        ("DELETE", "/history") => {
            match document::write::<Vec<Past>>(&mut cx.storage.user(), HISTORY_KEY, None, None)
                .await
            {
                Ok(saved) => document::answer(saved, None, history_reply),
                Err(error) => Response::error(503, &format!("storage failed: {error}")),
            }
        }
        (_, "/history") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

fn history_reply(history: Option<&Vec<Past>>, rev: u64) -> Value {
    json!({ "history": history, "rev": rev })
}

/// Query parameter `name`, decoded and checked by [`word_of`].
fn decoded(cx: &ApiCtx<'_>, name: &str) -> Result<String, Response> {
    let raw = cx.request.query_param(name).unwrap_or("");
    let text = super::spotlight::decode(raw).ok_or_else(|| {
        Response::error(
            400,
            &format!("the {name} is not valid percent-encoded UTF-8"),
        )
    })?;
    word_of(&text).map_err(|message| Response::error(400, &message))
}

/// What may be looked up: 1 to [`MAX_WORD`] characters of letters, digits,
/// spaces, hyphens, apostrophes and full stops, trimmed, inner spaces made
/// single.
pub fn word_of(typed: &str) -> Result<String, String> {
    let word = typed.split_whitespace().collect::<Vec<_>>().join(" ");
    if word.is_empty() {
        return Err("type a word to look up".into());
    }
    if word.chars().count() > MAX_WORD {
        return Err(format!("a look-up is at most {MAX_WORD} characters"));
    }
    if !word
        .chars()
        .all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '\'' | '’' | '.'))
    {
        return Err(format!(
            "{word:?} has characters a dictionary does not list"
        ));
    }
    Ok(word)
}

async fn suggest(cx: &mut ApiCtx<'_>, prefix: &str) -> Response {
    let key = format!("suggest/{}", prefix.to_lowercase());
    match cx.storage.shared().get_json::<Vec<String>>(&key).await {
        Ok(Some(cached)) => {
            return Response::json(200, &json!({ "prefix": prefix, "words": cached }))
        }
        Ok(None) => {}
        Err(error) => return Response::error(503, &format!("storage failed: {error}")),
    }
    let url = format!(
        "{DATAMUSE}sug?max={SUGGESTIONS}&s={}",
        fetch::encode(&prefix.to_lowercase())
    );
    let fetched = fetch::get(cx.ctx, EGRESS, &url, "application/json", BUDGET_MS).await;
    let words = match &fetched {
        Fetched::Body(body) => suggestions(body)
            .map_err(|mismatch| format!("Datamuse's answer could not be read: {mismatch}")),
        Fetched::Missing => Err("Datamuse has no such list".to_string()),
        Fetched::Failed(why) => Err(why.clone()),
    };
    let words = match words {
        Ok(words) => words,
        Err(why) => return Response::error(502, &format!("no suggestions: {why}")),
    };
    let expires = cx.now_ms + SUGGEST_CACHE_MS;
    if let Ok(bytes) = serde_json::to_vec(&words) {
        let _ = cx
            .storage
            .shared()
            .put_expiring(&key, &bytes, expires)
            .await;
    }
    Response::json(200, &json!({ "prefix": prefix, "words": words }))
}

/// The words of Datamuse's `/sug` answer, read strictly: a list of objects
/// with a `word` text. A word this module would refuse to look up
/// ([`word_of`]) is not offered.
pub fn suggestions(body: &[u8]) -> Strict<Vec<String>> {
    let answer = strict::json(body)?;
    let words = strict::each(strict::list(&answer, "the answer")?, "words", |item| {
        Ok(strict::text(strict::object(item, "a word")?, "word")?.to_string())
    })?;
    Ok(words
        .into_iter()
        .filter(|word| word_of(word).is_ok())
        .take(SUGGESTIONS)
        .collect())
}

async fn entry(cx: &mut ApiCtx<'_>, word: &str) -> Response {
    // Versioned: an entry cached by an earlier build of the look-up is not served.
    let key = format!("entries/v4/{word}");
    let cached = match cx.storage.shared().get(&key).await {
        Ok(Some(bytes)) => match cached_entry(&bytes) {
            Ok(entry) => Some(entry),
            Err(mismatch) => {
                return Response::error(503, &format!("a kept entry could not be read: {mismatch}"))
            }
        },
        Ok(None) => None,
        Err(error) => return Response::error(503, &format!("storage failed: {error}")),
    };
    let body = match cached {
        Some(body) => body,
        None => {
            let body = match look_up(cx, word).await {
                Ok(body) => body,
                Err(why) => return Response::error(502, &why),
            };
            if none_answered(&body) {
                return Response::error(502, "none of the dictionary's sources could be reached");
            }
            // Only a complete answer is kept: one with a source missing is
            // asked again next time.
            if body["failed"].as_array().is_some_and(Vec::is_empty) {
                if let Ok(bytes) = serde_json::to_vec(&body) {
                    let expires = cx.now_ms + CACHE_MS;
                    let _ = cx
                        .storage
                        .shared()
                        .put_expiring(&key, &bytes, expires)
                        .await;
                }
            }
            body
        }
    };
    // `remembered` says whether this look-up went into the person's history
    // (absent when it is not one that goes there: nothing found, or
    // `history=0`).
    let mut body = body;
    if body["found"] == true && keeps_history(cx.request.query_param("history")) {
        let remembered = match remember(cx, word).await {
            Ok(()) => true,
            Err(error) => {
                ferrite_app::tracing::warn!(%error, "could not keep the look-up in the history");
                false
            }
        };
        body["remembered"] = json!(remembered);
    }
    Response::json(200, &body)
}

/// Whether no source with content answered: nothing was found and the
/// dictionary, the thesaurus and Wikipedia are all listed as failed. The
/// entry route then answers 502. A thesaurus listed as failed because one of
/// its two requests failed can still have contributed words, and an entry
/// with any content is answered.
pub fn none_answered(entry: &Value) -> bool {
    let failed = entry["failed"].as_array().cloned().unwrap_or_default();
    entry["found"] != true
        && CONTENT_SOURCES
            .iter()
            .all(|source| failed.iter().any(|f| f == source))
}

/// Ask every source at once and put their answers together; `Err` is the
/// 502 message of a source that answered in a shape other than its own.
async fn look_up(cx: &ApiCtx<'_>, word: &str) -> Result<Value, String> {
    let ctx = cx.ctx;
    let started = ctx.now_ms();
    let term = fetch::encode(word);
    let lower = fetch::encode(&word.to_lowercase());
    let urls = [
        format!("{WIKTIONARY}{}", fetch::encode(&word.replace(' ', "_"))),
        format!("{FREE_DICTIONARY}{lower}"),
        format!("{DATAMUSE}words?md=p&max=40&ml={lower}"),
        format!("{DATAMUSE}words?md=p&max=20&rel_ant={lower}"),
        format!(
            "{WIKIPEDIA}?action=query&format=json&formatversion=2&redirects=1&prop=extracts%7Cinfo&inprop=url&exintro=1&explaintext=1&titles={term}"
        ),
    ];
    let work: Vec<fetch::Pending<'_>> = urls
        .iter()
        .map(|url| {
            Box::pin(fetch::get(ctx, EGRESS, url, "application/json", BUDGET_MS))
                as fetch::Pending<'_>
        })
        .collect();
    let mut answers = fetch::all(work).await;
    // Wiktionary's titles are case-sensitive: "Paris" is not "paris". A word
    // typed with capitals that it lacks is asked again in lower case, within
    // what is left of the look-up's one budget. Without time for it, the
    // dictionary counts as failed, so the answer is not kept as complete.
    if answers[0] == Fetched::Missing && word.to_lowercase() != word {
        answers[0] = match retry_budget(started, ctx.now_ms()) {
            Some(ms) => {
                let url = format!(
                    "{WIKTIONARY}{}",
                    fetch::encode(&word.to_lowercase().replace(' ', "_"))
                );
                fetch::get(ctx, EGRESS, &url, "application/json", ms).await
            }
            None => Fetched::Failed("no time was left to ask Wiktionary in lower case".into()),
        };
    }
    let [definitions, pronunciation, synonyms, antonyms, wikipedia] =
        <[Fetched; 5]>::try_from(answers)
            .unwrap_or_else(|_| std::array::from_fn(|_| Fetched::Failed("not run".into())));
    assemble(
        word,
        cx.now_ms,
        &definitions,
        &pronunciation,
        &synonyms,
        &antonyms,
        &wikipedia,
    )
}

/// How long a second asking of Wiktionary may take, for a look-up that
/// began at `started` and is at `now`: what is left of [`LOOKUP_MS`], at most
/// [`RETRY_MS`], or `None` when less than [`MIN_RETRY_MS`] is left.
pub fn retry_budget(started: u64, now: u64) -> Option<u64> {
    let left = LOOKUP_MS.saturating_sub(now.saturating_sub(started));
    (left >= MIN_RETRY_MS).then(|| left.min(RETRY_MS))
}

/// The reply of an entry from what each source answered, or the 502 message
/// when one answered in a shape other than the one it documents
/// ([`fetch::strict`]): such an answer fails the whole look-up, with the
/// mismatch named, and nothing of it is answered or kept. A source that
/// could not be reached is named in `failed`, and the entry is not kept as
/// complete; 404 is "nothing for this word", readably.
pub fn assemble(
    word: &str,
    at: u64,
    definitions: &Fetched,
    pronunciation: &Fetched,
    synonyms: &Fetched,
    antonyms: &Fetched,
    wikipedia: &Fetched,
) -> Result<Value, String> {
    let mut failed = Vec::new();
    let unreadable = |source: &str, mismatch: strict::Mismatch| {
        format!("{source}'s answer could not be read: {mismatch}")
    };
    let parts = match definitions {
        Fetched::Body(body) => {
            Some(wiktionary_parts(body).map_err(|m| unreadable("Wiktionary", m))?)
        }
        Fetched::Missing => Some(Vec::new()),
        Fetched::Failed(_) => None,
    };
    if parts.is_none() {
        failed.push("dictionary".to_string());
    }
    let words = |fetched: &Fetched| -> Result<Option<Vec<(String, String)>>, String> {
        Ok(match fetched {
            Fetched::Body(body) => {
                Some(datamuse_words(body).map_err(|m| unreadable("Datamuse", m))?)
            }
            Fetched::Missing => Some(Vec::new()),
            Fetched::Failed(_) => None,
        })
    };
    let (same, opposite) = (words(synonyms)?, words(antonyms)?);
    if same.is_none() || opposite.is_none() {
        failed.push("thesaurus".to_string());
    }
    let encyclopedia = match wikipedia {
        Fetched::Body(body) => {
            Some(wikipedia_summary(body).map_err(|m| unreadable("Wikipedia", m))?)
        }
        Fetched::Missing => Some(None),
        Fetched::Failed(_) => None,
    };
    if encyclopedia.is_none() {
        failed.push("wikipedia".to_string());
    }
    let encyclopedia = encyclopedia.flatten();
    // The Free Dictionary API answers 404 for a word it lacks (no
    // pronunciation, readably); a timeout leaves the entry incomplete.
    let spoken_audio = match pronunciation {
        Fetched::Body(body) => {
            Some(phonetics(body).map_err(|m| unreadable("The Free Dictionary API", m))?)
        }
        Fetched::Missing => Some((None, None)),
        Fetched::Failed(_) => None,
    };
    if spoken_audio.is_none() {
        failed.push("pronunciation".to_string());
    }
    let (spoken, audio) = spoken_audio.unwrap_or((None, None));
    let said = match pronunciation {
        Fetched::Body(body) => accents(body),
        _ => json!({}),
    };
    let parts = parts.unwrap_or_default();
    let pronounced = spoken.is_some() || audio.is_some();
    let dictionary = (!parts.is_empty()).then(
        || json!({ "pronunciation": spoken, "audio": audio, "accents": said, "parts": parts }),
    );
    let thesaurus = thesaurus(same.unwrap_or_default(), opposite.unwrap_or_default());
    let mut credits = Vec::new();
    if dictionary.is_some() {
        credits.push(json!({
            "text": "Definitions from Wiktionary, CC BY-SA 4.0",
            "href": format!("https://en.wiktionary.org/wiki/{}", fetch::encode(&word.replace(' ', "_"))),
        }));
        if pronounced {
            credits.push(json!({
                "text": "Pronunciation from the Free Dictionary API",
                "href": "https://dictionaryapi.dev/",
            }));
        }
    }
    if !thesaurus.is_empty() {
        credits.push(
            json!({ "text": "Thesaurus from Datamuse", "href": "https://www.datamuse.com/api/" }),
        );
    }
    if let Some(found) = &encyclopedia {
        credits.push(json!({ "text": "From Wikipedia, CC BY-SA 4.0", "href": found["url"] }));
    }
    let found = dictionary.is_some() || !thesaurus.is_empty() || encyclopedia.is_some();
    Ok(json!({
        "word": word,
        "found": found,
        "dictionary": dictionary,
        "thesaurus": thesaurus,
        "wikipedia": encyclopedia,
        "credits": credits,
        "failed": failed,
        "at": at,
    }))
}

/// The English parts of speech of Wiktionary's definitions answer, each with
/// its senses as plain text and up to [`MAX_EXAMPLES`] examples, read
/// strictly ([`fetch::strict`]): the answer is an object of languages, and
/// its `en` section, where present, a list of usages, each with a
/// `partOfSpeech` text and a `definitions` list of objects with a
/// `definition` text, and, where present, `parsedExamples` (objects with an
/// `example` text) and `examples` (texts). Every other language is ignored
/// entirely: it is neither read nor checked, and nothing of it is answered
/// or cached. An answer without an `en` section is a word with no English
/// definitions: none. An answer with an `error` field is a failure.
pub fn wiktionary_parts(body: &[u8]) -> Strict<Vec<Value>> {
    let answer = strict::json(body)?;
    let languages = strict::object(&answer, "the answer")?;
    if languages.contains_key("error") {
        return strict::fail("Wiktionary answered an error");
    }
    let Some(english) = languages.get("en") else {
        return Ok(Vec::new());
    };
    let parts = strict::each(strict::list(english, "en")?, "en", wiktionary_usage)?;
    Ok(parts.into_iter().flatten().collect())
}

/// One usage of Wiktionary's answer: its part of speech and its senses, or
/// `None` when it has no sense with text.
fn wiktionary_usage(usage: &Value) -> Strict<Option<Value>> {
    let usage = strict::object(usage, "a usage")?;
    let part = strict::text(usage, "partOfSpeech")?.to_lowercase();
    let definitions = strict::list(strict::field(usage, "definitions")?, "`definitions`")?;
    let senses = strict::each(definitions, "definitions", |definition| {
        let definition = strict::object(definition, "a definition")?;
        let text = fetch::text_of(strict::text(definition, "definition")?);
        let parsed = match strict::optional_list(definition, "parsedExamples")? {
            Some(list) => Some(strict::each(list, "parsedExamples", |example| {
                Ok(fetch::text_of(strict::text(
                    strict::object(example, "an example")?,
                    "example",
                )?))
            })?),
            None => None,
        };
        let plain = match strict::optional_list(definition, "examples")? {
            Some(list) => Some(strict::each(list, "examples", |example| {
                example
                    .as_str()
                    .map(fetch::text_of)
                    .ok_or_else(|| strict::Mismatch("an example is not text".into()))
            })?),
            None => None,
        };
        let examples: Vec<String> = parsed
            .or(plain)
            .unwrap_or_default()
            .into_iter()
            .filter(|example| !example.is_empty())
            .take(MAX_EXAMPLES)
            .collect();
        Ok((!text.is_empty()).then(|| json!({ "text": text, "examples": examples })))
    })?;
    let senses: Vec<Value> = senses.into_iter().flatten().take(MAX_SENSES).collect();
    Ok((!senses.is_empty()).then(|| json!({ "part": part, "senses": senses })))
}

/// The pronunciation and a recording's address from the Free Dictionary
/// API's answer: the first phonetic text and the first non-empty `https`
/// audio, read strictly: a list of entries, each an object with a `word`
/// text, a `phonetic` text where present, and a `phonetics` list where
/// present, of objects whose `text` and `audio` are texts where present.
pub fn phonetics(body: &[u8]) -> Strict<(Option<String>, Option<String>)> {
    let answer = strict::json(body)?;
    let entries = strict::list(&answer, "the answer")?;
    let mut spoken = None;
    let mut audio = None;
    strict::each(entries, "entries", |entry| {
        let entry = strict::object(entry, "an entry")?;
        strict::text(entry, "word")?;
        if let Some(text) = strict::optional_text(entry, "phonetic")? {
            spoken = spoken.take().or(Some(text.to_string()));
        }
        let phonetics = strict::optional_list(entry, "phonetics")?;
        strict::each(
            phonetics.map_or(&[][..], Vec::as_slice),
            "phonetics",
            |item| {
                let item = strict::object(item, "a phonetic")?;
                let text = strict::optional_text(item, "text")?.filter(|t| !t.is_empty());
                let recording =
                    strict::optional_text(item, "audio")?.filter(|a| a.starts_with("https://"));
                if spoken.is_none() {
                    spoken = text.map(str::to_string);
                }
                if audio.is_none() {
                    audio = recording.map(str::to_string);
                }
                Ok(())
            },
        )?;
        Ok(())
    })?;
    Ok((spoken, audio))
}

/// Each accent's pronunciation and recording from the Free Dictionary API's
/// answer, by the code its recording's file name ends in (`run-uk.mp3`), the
/// first of each. The answer has already been read by [`phonetics`]; what
/// is not such a recording is passed over.
pub fn accents(body: &[u8]) -> Value {
    let mut found = serde_json::Map::new();
    let answer = strict::json(body).unwrap_or(Value::Null);
    let entries = answer.as_array().map_or(&[][..], Vec::as_slice);
    for item in entries
        .iter()
        .filter_map(|entry| entry.get("phonetics")?.as_array())
        .flatten()
    {
        let Some(audio) = item.get("audio").and_then(Value::as_str) else {
            continue;
        };
        let Some(code) = audio
            .strip_prefix("https://")
            .and_then(|rest| rest.strip_suffix(".mp3"))
            .and_then(|rest| rest.rsplit('-').next())
            .filter(|code| ["us", "uk", "au"].contains(code))
        else {
            continue;
        };
        let text = item
            .get("text")
            .and_then(Value::as_str)
            .filter(|text| !text.is_empty());
        found
            .entry(code.to_string())
            .or_insert_with(|| json!({ "pronunciation": text, "audio": audio }));
    }
    Value::Object(found)
}

/// Datamuse's words with the part of speech it tags each with, read
/// strictly: a list of objects with a `word` text and, where present, a
/// `tags` list of texts.
pub fn datamuse_words(body: &[u8]) -> Strict<Vec<(String, String)>> {
    let answer = strict::json(body)?;
    strict::each(strict::list(&answer, "the answer")?, "words", |item| {
        let item = strict::object(item, "a word")?;
        let word = strict::text(item, "word")?.to_string();
        let tags = strict::optional_list(item, "tags")?;
        let tags = strict::each(tags.map_or(&[][..], Vec::as_slice), "tags", |tag| {
            tag.as_str()
                .map(str::to_string)
                .ok_or_else(|| strict::Mismatch("a tag is not text".into()))
        })?;
        let part = tags
            .iter()
            .find_map(|tag| match tag.as_str() {
                "n" => Some("noun"),
                "v" => Some("verb"),
                "adj" => Some("adjective"),
                "adv" => Some("adverb"),
                _ => None,
            })
            .unwrap_or("other");
        Ok((word, part.to_string()))
    })
}

/// The thesaurus: synonyms and antonyms grouped by part of speech, in the
/// order noun, verb, adjective, adverb, other; a part with neither is left
/// out.
pub fn thesaurus(synonyms: Vec<(String, String)>, antonyms: Vec<(String, String)>) -> Vec<Value> {
    ["noun", "verb", "adjective", "adverb", "other"]
        .iter()
        .filter_map(|part| {
            let of = |list: &[(String, String)], max: usize| -> Vec<String> {
                list.iter()
                    .filter(|(_, p)| p == part)
                    .map(|(w, _)| w.clone())
                    .take(max)
                    .collect()
            };
            let same = of(&synonyms, MAX_SYNONYMS);
            let opposite = of(&antonyms, MAX_SYNONYMS / 2);
            (!same.is_empty() || !opposite.is_empty())
                .then(|| json!({ "part": part, "synonyms": same, "antonyms": opposite }))
        })
        .collect()
}

/// The article's title, its introduction (clipped) and address from
/// Wikipedia's query answer, read strictly: an object without an `error`,
/// with a `query.pages` list whose every page, unless marked `missing` or
/// `invalid` (no article: `None`), has a `title` and an `extract` text and,
/// where present, a `fullurl` text. The first page is the one answered. An
/// empty introduction is no article.
pub fn wikipedia_summary(body: &[u8]) -> Strict<Option<Value>> {
    let answer = strict::json(body)?;
    let answer = strict::object(&answer, "the answer")?;
    if answer.contains_key("error") {
        return strict::fail("Wikipedia answered an error");
    }
    let query = strict::object(strict::field(answer, "query")?, "`query`")?;
    let pages = strict::list(strict::field(query, "pages")?, "`pages`")?;
    let summaries = strict::each(pages, "pages", |page| {
        summary_of(strict::object(page, "a page")?)
    })?;
    Ok(summaries.into_iter().next().flatten())
}

fn summary_of(page: &ferrite_app::serde_json::Map<String, Value>) -> Strict<Option<Value>> {
    if page.contains_key("missing") || page.contains_key("invalid") {
        return Ok(None);
    }
    let title = strict::text(page, "title")?;
    let extract = strict::text(page, "extract")?.trim();
    let address = strict::optional_text(page, "fullurl")?;
    if extract.is_empty() {
        return Ok(None);
    }
    let url = address.map(str::to_string).unwrap_or_else(|| {
        format!(
            "https://en.wikipedia.org/wiki/{}",
            fetch::encode(&title.replace(' ', "_"))
        )
    });
    let first = extract
        .split('\n')
        .find(|p| !p.trim().is_empty())
        .unwrap_or(extract);
    Ok(Some(
        json!({ "title": title, "extract": fetch::clip(first.trim(), MAX_EXTRACT), "url": url }),
    ))
}

/// Whether a look-up goes into the person's history: unless its request
/// says `history=0`.
pub fn keeps_history(history: Option<&str>) -> bool {
    history != Some("0")
}

fn texts(item: &serde_json::Map<String, Value>, key: &str) -> Strict<()> {
    let list = strict::list(strict::field(item, key)?, &format!("`{key}`"))?;
    strict::each(list, key, |text| match text {
        Value::String(_) => Ok(()),
        _ => strict::fail("not text"),
    })?;
    Ok(())
}

fn nullable_object<'a>(
    item: &'a serde_json::Map<String, Value>,
    key: &str,
) -> Strict<Option<&'a serde_json::Map<String, Value>>> {
    match item.get(key) {
        None => strict::fail(format!("`{key}` is missing")),
        Some(Value::Null) => Ok(None),
        Some(value) => strict::object(value, &format!("`{key}`")).map(Some),
    }
}

/// The field `key`, which must be there: text, or `null`.
fn nullable_text(item: &serde_json::Map<String, Value>, key: &str) -> Strict<()> {
    match item.get(key) {
        None => strict::fail(format!("`{key}` is missing")),
        Some(Value::Null | Value::String(_)) => Ok(()),
        Some(_) => strict::fail(format!("`{key}` is not text")),
    }
}

/// An entry kept in the shared cache, read strictly in the shape
/// [`assemble`] writes: one of any other shape is a mismatch.
pub fn cached_entry(bytes: &[u8]) -> Strict<Value> {
    let entry = strict::json(bytes)?;
    let item = strict::object(&entry, "the entry")?;
    strict::text(item, "word")?;
    if !strict::field(item, "found")?.is_boolean() {
        return strict::fail("`found` is not true or false");
    }
    strict::number(item, "at")?;
    texts(item, "failed")?;
    if let Some(dictionary) = nullable_object(item, "dictionary")? {
        nullable_text(dictionary, "pronunciation")?;
        nullable_text(dictionary, "audio")?;
        for said in strict::object(strict::field(dictionary, "accents")?, "`accents`")?.values() {
            let said = strict::object(said, "an accent")?;
            nullable_text(said, "pronunciation")?;
            strict::text(said, "audio")?;
        }
        let parts = strict::list(strict::field(dictionary, "parts")?, "`parts`")?;
        strict::each(parts, "parts", |part| {
            let part = strict::object(part, "a part")?;
            strict::text(part, "part")?;
            let senses = strict::list(strict::field(part, "senses")?, "`senses`")?;
            strict::each(senses, "senses", |sense| {
                let sense = strict::object(sense, "a sense")?;
                strict::text(sense, "text")?;
                texts(sense, "examples")
            })?;
            Ok(())
        })?;
    }
    let groups = strict::list(strict::field(item, "thesaurus")?, "`thesaurus`")?;
    strict::each(groups, "thesaurus", |group| {
        let group = strict::object(group, "a group")?;
        strict::text(group, "part")?;
        texts(group, "synonyms")?;
        texts(group, "antonyms")
    })?;
    if let Some(wikipedia) = nullable_object(item, "wikipedia")? {
        for key in ["title", "extract", "url"] {
            strict::text(wikipedia, key)?;
        }
    }
    let credits = strict::list(strict::field(item, "credits")?, "`credits`")?;
    strict::each(credits, "credits", |credit| {
        let credit = strict::object(credit, "a credit")?;
        strict::text(credit, "text")?;
        strict::text(credit, "href")?;
        Ok(())
    })?;
    Ok(entry)
}

/// Add a look-up to the history, keeping [`HISTORY`] and one entry per word,
/// newest first by when each look-up was asked (`at`): a look-up that
/// finishes after a newer one goes behind it, and an older look-up of a word
/// never replaces a newer one of the same word.
pub fn add(history: Vec<Past>, past: Past) -> Vec<Past> {
    if history
        .iter()
        .any(|old| old.word == past.word && old.at >= past.at)
    {
        return history;
    }
    let mut next: Vec<Past> = history
        .into_iter()
        .filter(|old| old.word != past.word)
        .collect();
    let at = next
        .iter()
        .position(|old| old.at < past.at)
        .unwrap_or(next.len());
    next.insert(at, past);
    next.truncate(HISTORY);
    next
}

/// The history without `word`.
pub fn without(history: Vec<Past>, word: &str) -> Vec<Past> {
    history.into_iter().filter(|old| old.word != word).collect()
}

/// Remove from Recents: tried again while another look-up writes the history.
async fn forget_word(cx: &mut ApiCtx<'_>, word: &str) -> Response {
    for _ in 0..4 {
        let mut user = cx.storage.user();
        let current = match document::read::<Vec<Past>>(&mut user, HISTORY_KEY).await {
            Ok(current) => current,
            Err(error) => return Response::error(503, &format!("storage failed: {error}")),
        };
        let next = without(current.doc.unwrap_or_default(), word);
        match document::write(&mut user, HISTORY_KEY, Some(current.rev), Some(&next)).await {
            Ok(document::Saved::Conflict(_)) => continue,
            Ok(saved) => return document::answer(saved, None, history_reply),
            Err(error) => return Response::error(503, &format!("storage failed: {error}")),
        }
    }
    Response::error(503, "the history kept changing")
}

async fn remember(cx: &mut ApiCtx<'_>, word: &str) -> std::io::Result<()> {
    let past = Past {
        word: word.to_string(),
        at: cx.now_ms,
    };
    for _ in 0..4 {
        let mut user = cx.storage.user();
        let current = document::read::<Vec<Past>>(&mut user, HISTORY_KEY).await?;
        let next = add(current.doc.unwrap_or_default(), past.clone());
        match document::write(&mut user, HISTORY_KEY, Some(current.rev), Some(&next)).await? {
            document::Saved::Stored(_) => return Ok(()),
            document::Saved::Conflict(_) => continue,
        }
    }
    Err(std::io::Error::other("the history kept changing"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn words_are_checked_and_tidied() {
        assert_eq!(word_of("  ice   cream ").unwrap(), "ice cream");
        assert_eq!(word_of("rock'n'roll").unwrap(), "rock'n'roll");
        assert_eq!(word_of("café").unwrap(), "café");
        assert_eq!(word_of("e.g.").unwrap(), "e.g.");
        for bad in ["", "   ", "a/b", "x&y", "<b>", "what?"] {
            assert!(word_of(bad).is_err(), "{bad:?} is refused");
        }
        assert!(word_of(&"a".repeat(MAX_WORD + 1)).is_err());
        assert!(word_of(&"a".repeat(MAX_WORD)).is_ok());
    }

    #[test]
    fn wiktionary_definitions_become_plain_senses_with_examples() {
        let body = br#"{"en":[{"partOfSpeech":"Noun","language":"English","definitions":[
            {"definition":"The <a href=\"/wiki/x\">phenomenon</a> of luck.",
             "parsedExamples":[{"example":"It was pure <b>serendipity</b>."}]},
            {"definition":""}]},
            {"partOfSpeech":"Verb","definitions":[{"definition":"To run.","examples":["<i>run</i> fast"]}]}],
            "fr":[{"partOfSpeech":"Nom","definitions":[{"definition":"chance"}]}]}"#;
        let parts = wiktionary_parts(body).unwrap();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0]["part"], "noun");
        assert_eq!(parts[0]["senses"][0]["text"], "The phenomenon of luck.");
        assert_eq!(
            parts[0]["senses"][0]["examples"][0],
            "It was pure serendipity."
        );
        assert_eq!(
            parts[0]["senses"].as_array().unwrap().len(),
            1,
            "an empty sense is dropped"
        );
        assert_eq!(parts[1]["senses"][0]["examples"][0], "run fast");
        assert!(
            wiktionary_parts(b"<html>").is_err(),
            "not Wiktionary's answer"
        );
        assert!(wiktionary_parts(b"[]").is_err(), "not Wiktionary's shape");
        assert_eq!(
            wiktionary_parts(br#"{"fr":[]}"#),
            Ok(Vec::new()),
            "only English counts"
        );
    }

    #[test]
    fn accents_go_by_the_recording_file_name() {
        let body = r#"[{"word":"tomato","phonetics":[
            {"text":"/təˈmɑːtəʊ/","audio":"https://example.org/tomato-uk.mp3"},
            {"text":"","audio":"https://example.org/tomato-us.mp3"},
            {"text":"/x/","audio":"https://example.org/tomato-uk.mp3"},
            {"text":"/y/","audio":""},
            {"text":"/z/","audio":"https://example.org/tomato.mp3"}]}]"#
            .as_bytes();
        assert_eq!(
            accents(body),
            json!({
                "uk": {"pronunciation": "/təˈmɑːtəʊ/", "audio": "https://example.org/tomato-uk.mp3"},
                "us": {"pronunciation": null, "audio": "https://example.org/tomato-us.mp3"},
            })
        );
    }

    #[test]
    fn pronunciation_takes_the_first_text_and_https_recording() {
        let body = r#"[{"word":"run","phonetics":[{"text":"/ɹʌn/","audio":""},
            {"audio":"https://example.org/run-us.mp3"}]}]"#
            .as_bytes();
        assert_eq!(
            phonetics(body),
            Ok((
                Some("/ɹʌn/".into()),
                Some("https://example.org/run-us.mp3".into())
            ))
        );
        assert!(
            phonetics(br#"{"title":"No Definitions Found"}"#).is_err(),
            "not the API's list of entries: unreadable"
        );
        assert!(phonetics(br#"["run"]"#).is_err());
        assert_eq!(
            phonetics(b"[{}]"),
            strict::fail("entries[0]: `word` is missing"),
            "an entry names its word, and the mismatch says so"
        );
        assert!(phonetics(br#"[{"error":"busy"}]"#).is_err());
        assert!(phonetics(br#"[{"word":"run","phonetics":"x"}]"#).is_err());
        assert!(
            phonetics(br#"[{"word":"run","phonetic":123}]"#).is_err(),
            "a phonetic that is not text"
        );
        assert!(
            phonetics(br#"[{"word":"run","phonetics":[{"text":false}]}]"#).is_err(),
            "a phonetic text that is not text"
        );
        assert!(
            phonetics(br#"[{"word":"run","phonetics":[{"audio":42}]}]"#).is_err(),
            "a recording address that is not text"
        );
        assert_eq!(phonetics(b"[]"), Ok((None, None)));
    }

    #[test]
    fn the_thesaurus_groups_by_part_of_speech() {
        let syn = datamuse_words(
            br#"[{"word":"glad","tags":["syn","adj"]},{"word":"felicity","tags":["n"]},{"word":"x"}]"#,
        )
        .unwrap();
        let ant = datamuse_words(br#"[{"word":"sad","tags":["adj"]}]"#).unwrap();
        let groups = thesaurus(syn, ant);
        assert_eq!(groups.len(), 3);
        assert_eq!(groups[0]["part"], "noun");
        assert_eq!(groups[1]["part"], "adjective");
        assert_eq!(groups[1]["synonyms"], json!(["glad"]));
        assert_eq!(groups[1]["antonyms"], json!(["sad"]));
        assert_eq!(groups[2]["part"], "other");
        assert!(thesaurus(vec![], vec![]).is_empty());
    }

    #[test]
    fn wikipedia_gives_the_first_paragraph_of_the_introduction() {
        let body = br#"{"query":{"pages":[{"title":"United States","fullurl":"https://en.wikipedia.org/wiki/United_States",
            "extract":"The United States is a country.\nIts capital is Washington."}]}}"#;
        let summary = wikipedia_summary(body).unwrap().unwrap();
        assert_eq!(summary["title"], "United States");
        assert_eq!(summary["extract"], "The United States is a country.");
        assert_eq!(
            wikipedia_summary(br#"{"query":{"pages":[{"title":"Qq","missing":true}]}}"#),
            Ok(None),
            "no such article"
        );
        // An answer that is not a query answer is a failure, not "no article".
        assert!(wikipedia_summary(b"<html>busy</html>").is_err());
        assert!(wikipedia_summary(br#"{"error":{"code":"maxlag","info":"Waiting"}}"#).is_err());
        assert!(wikipedia_summary(br#"{"batchcomplete":true}"#).is_err());
    }

    #[test]
    fn an_unreadable_answer_fails_the_whole_look_up_and_names_its_source() {
        let entry = assemble(
            "luck",
            1,
            &Fetched::Body(b"<html>Service Unavailable</html>".to_vec()),
            &Fetched::Missing,
            &Fetched::Body(b"[]".to_vec()),
            &Fetched::Body(b"[]".to_vec()),
            &Fetched::Missing,
        );
        let why = entry.unwrap_err();
        assert!(
            why.starts_with("Wiktionary's answer could not be read: not JSON"),
            "{why}"
        );
        // Each of these answered readably except one: the look-up fails, and
        // names the one that did not.
        let cases: [(&[u8], usize, &str); 4] = [
            (br#"{"error":"busy"}"#, 0, "Wiktionary"),
            (br#"[{"score":1}]"#, 2, "Datamuse"),
            (br#"{"query":{"pages":[{"pageid":1}]}}"#, 4, "Wikipedia"),
            (
                br#"[{"word":"luck","phonetic":123}]"#,
                1,
                "The Free Dictionary API",
            ),
        ];
        for (body, at, source) in cases {
            let mut answers: Vec<Fetched> = (0..5).map(|_| Fetched::Missing).collect();
            answers[at] = Fetched::Body(body.to_vec());
            let why = assemble(
                "luck",
                1,
                &answers[0],
                &answers[1],
                &answers[2],
                &answers[3],
                &answers[4],
            )
            .unwrap_err();
            assert!(
                why.starts_with(&format!("{source}'s answer could not be read: ")),
                "{why}"
            );
        }
    }

    #[test]
    fn an_answer_of_the_wrong_shape_is_a_mismatch_not_an_empty_answer() {
        // Each of these is JSON, but not the shape its source documents.
        assert!(wiktionary_parts(br#"{"error":"busy"}"#).is_err());
        assert!(wiktionary_parts(br#"{"en":["chance"]}"#).is_err());
        assert!(wiktionary_parts(br#"{"en":[{}]}"#).is_err());
        assert!(
            wiktionary_parts(br#"{"en":[{"partOfSpeech":"Noun","definitions":"chance"}]}"#)
                .is_err()
        );
        assert!(wiktionary_parts(
            br#"{"en":[{"partOfSpeech":"Noun","definitions":[{"text":"chance"}]}]}"#
        )
        .is_err());
        assert!(
            wiktionary_parts(
                br#"{"en":[{"partOfSpeech":"Noun","definitions":[{"definition":"x","examples":[1]}]}]}"#
            )
            .is_err(),
            "an example that is not text"
        );
        assert_eq!(
            wiktionary_parts(br#"{"fr":[{"partOfSpeech":"Noun","definitions":[]}]}"#),
            Ok(Vec::new()),
            "Wiktionary's shape without English is a word with no English definitions"
        );
        // Only the English section is read: another language, however malformed, is ignored.
        let english = r#""en":[{"partOfSpeech":"Noun","definitions":[{"definition":"chance"}]}]"#;
        let with_bad_french = format!(r#"{{{english},"fr":[{{"definitions":123}}],"de":7}}"#);
        assert_eq!(
            wiktionary_parts(with_bad_french.as_bytes()),
            wiktionary_parts(format!("{{{english}}}").as_bytes()),
        );
        assert_eq!(
            wiktionary_parts(with_bad_french.as_bytes()).unwrap()[0]["senses"][0]["text"],
            "chance"
        );
        assert_eq!(wiktionary_parts(br#"{"fr":"not a list"}"#), Ok(Vec::new()));
        assert!(datamuse_words(br#"[{"score":1},{"tags":["n"]}]"#).is_err());
        assert!(datamuse_words(br#"["luck"]"#).is_err());
        assert!(
            datamuse_words(br#"[{"word":"luck","tags":[1]}]"#).is_err(),
            "a tag that is not text"
        );
        assert_eq!(datamuse_words(b"[]"), Ok(Vec::new()));
        assert!(
            wikipedia_summary(br#"{"query":{"pages":[{"pageid":1}]}}"#).is_err(),
            "a page that is not missing has a title and an extract"
        );
        assert!(wikipedia_summary(br#"{"query":{"pages":[{"title":"Luck"}]}}"#).is_err());
        assert_eq!(
            wikipedia_summary(
                br#"{"query":{"pages":[{"title":"Luck","extract":"Luck."},{"pageid":2}]}}"#
            ),
            strict::fail("pages[1]: `title` is missing"),
            "every page is read, not only the first"
        );
        assert!(
            wikipedia_summary(
                br#"{"query":{"pages":[{"title":"Luck","extract":"Luck.","fullurl":7}]}}"#
            )
            .is_err(),
            "an address that is not text"
        );
        assert_eq!(
            wikipedia_summary(br#"{"query":{"pages":[{"title":"Luck","extract":""}]}}"#),
            Ok(None),
            "an article without an introduction is no summary, readably"
        );
    }

    #[test]
    fn a_look_up_marked_history_0_stays_out_of_the_history() {
        assert!(keeps_history(None), "the window's own look-ups are kept");
        assert!(keeps_history(Some("1")));
        assert!(!keeps_history(Some("0")), "Spotlight's are not");
    }

    #[test]
    fn the_second_asking_only_gets_what_is_left_of_one_budget() {
        // Early: the most a second asking spends.
        assert_eq!(retry_budget(1_000, 2_000), Some(RETRY_MS));
        // The first round took 6 s (a slow source): only the rest of the
        // look-up's budget, keeping time for storage and the reply.
        assert_eq!(retry_budget(1_000, 7_000), Some(LOOKUP_MS - 6_000));
        // Too little left to be worth asking.
        assert_eq!(retry_budget(1_000, 7_200), None);
        assert_eq!(retry_budget(1_000, 20_000), None);
        assert!(
            LOOKUP_MS + 1_000 < 8_000,
            "room is kept under the API deadline"
        );
    }

    #[test]
    fn an_entry_says_what_was_found_and_which_sources_failed() {
        let none = assemble(
            "qq",
            1,
            &Fetched::Missing,
            &Fetched::Failed("late".into()),
            &Fetched::Body(b"[]".to_vec()),
            &Fetched::Body(b"[]".to_vec()),
            &Fetched::Failed("down".into()),
        )
        .unwrap();
        assert_eq!(none["found"], false);
        assert_eq!(
            none["failed"],
            json!(["wikipedia", "pronunciation"]),
            "a pronunciation that did not come leaves the entry incomplete"
        );
        assert!(!none_answered(&none), "Wiktionary and Datamuse answered");
        // The dictionary and Wikipedia failed, and so did one thesaurus request, but
        // the other brought synonyms: there is something to show.
        let some = assemble(
            "luck",
            4,
            &Fetched::Failed("down".into()),
            &Fetched::Missing,
            &Fetched::Body(br#"[{"word":"chance","tags":["n"]}]"#.to_vec()),
            &Fetched::Failed("down".into()),
            &Fetched::Failed("down".into()),
        )
        .unwrap();
        assert_eq!(some["found"], true);
        assert_eq!(
            some["failed"],
            json!(["dictionary", "thesaurus", "wikipedia"])
        );
        assert!(!none_answered(&some), "the synonyms are answered");
        assert_eq!(none["dictionary"], Value::Null);
        let found = assemble(
            "luck",
            2,
            &Fetched::Body(
                br#"{"en":[{"partOfSpeech":"Noun","definitions":[{"definition":"chance"}]}]}"#
                    .to_vec(),
            ),
            &Fetched::Missing,
            &Fetched::Missing,
            &Fetched::Missing,
            &Fetched::Missing,
        )
        .unwrap();
        assert_eq!(found["found"], true);
        assert_eq!(
            found["dictionary"]["parts"][0]["senses"][0]["text"],
            "chance"
        );
        assert_eq!(
            found["credits"][0]["href"],
            "https://en.wiktionary.org/wiki/luck"
        );
        assert_eq!(found["failed"], json!([]), "complete: kept");
        assert_eq!(
            found["credits"].as_array().unwrap().len(),
            1,
            "no pronunciation, no credit for its source"
        );
        let pronounced = assemble(
            "luck",
            3,
            &Fetched::Body(
                br#"{"en":[{"partOfSpeech":"Noun","definitions":[{"definition":"chance"}]}]}"#
                    .to_vec(),
            ),
            &Fetched::Body(r#"[{"word":"luck","phonetic":"/lʌk/"}]"#.as_bytes().to_vec()),
            &Fetched::Missing,
            &Fetched::Missing,
            &Fetched::Missing,
        )
        .unwrap();
        assert_eq!(pronounced["dictionary"]["pronunciation"], "/lʌk/");
        assert_eq!(
            pronounced["credits"][1]["href"], "https://dictionaryapi.dev/",
            "the pronunciation's source is credited"
        );
    }

    #[test]
    fn suggestions_keep_only_words_that_can_be_looked_up() {
        let words = suggestions(br#"[{"word":"computer","score":9},{"word":"a/b"}]"#).unwrap();
        assert_eq!(words, vec!["computer".to_string()]);
        assert!(
            suggestions(br#"[{"word":"computer"},{"score":1}]"#).is_err(),
            "an item without its word fails the answer"
        );
    }

    #[test]
    fn a_kept_entry_is_read_in_the_shape_assemble_writes() {
        let entry = assemble(
            "luck",
            2,
            &Fetched::Body(
                br#"{"en":[{"partOfSpeech":"Noun","definitions":[{"definition":"chance"}]}]}"#
                    .to_vec(),
            ),
            &Fetched::Missing,
            &Fetched::Body(br#"[{"word":"chance","tags":["n"]}]"#.to_vec()),
            &Fetched::Missing,
            &Fetched::Missing,
        )
        .unwrap();
        let bytes = serde_json::to_vec(&entry).unwrap();
        assert_eq!(cached_entry(&bytes), Ok(entry.clone()));
        let broken = |change: &dyn Fn(&mut Value)| {
            let mut bad = entry.clone();
            change(&mut bad);
            cached_entry(&serde_json::to_vec(&bad).unwrap())
        };
        assert!(cached_entry(b"7").is_err());
        assert!(broken(&|e| e["found"] = json!("yes")).is_err());
        assert!(broken(&|e| e["failed"] = json!([1])).is_err());
        assert!(broken(&|e| e["dictionary"]["parts"][0]["senses"][0]["text"] = json!(3)).is_err());
        assert!(broken(&|e| e["thesaurus"][0]["synonyms"] = json!("chance")).is_err());
        assert!(broken(&|e| {
            e.as_object_mut().unwrap().remove("wikipedia");
        })
        .is_err());
        assert!(broken(&|e| e["credits"][0]["href"] = Value::Null).is_err());
        assert!(broken(&|e| {
            e["dictionary"].as_object_mut().unwrap().remove("accents");
        })
        .is_err());
        assert!(broken(&|e| e["dictionary"]["accents"]["uk"] = json!({"audio": 1})).is_err());
        assert!(broken(&|e| {
            e["dictionary"].as_object_mut().unwrap().remove("audio");
        })
        .is_err());
        assert!(broken(&|e| e["dictionary"]["pronunciation"] = json!(5)).is_err());
    }

    #[test]
    fn removing_a_word_leaves_the_others_in_their_order() {
        let history = add(add(add(vec![], past("c", 1)), past("b", 2)), past("a", 3));
        assert_eq!(
            without(history.clone(), "b"),
            vec![past("a", 3), past("c", 1)]
        );
        assert_eq!(without(history.clone(), "nothing"), history);
    }

    fn past(word: &str, at: u64) -> Past {
        Past {
            word: word.to_string(),
            at,
        }
    }

    #[test]
    fn the_history_keeps_the_newest_once_per_word() {
        let past = |word: &str, at| Past {
            word: word.into(),
            at,
        };
        let history = add(vec![past("a", 1), past("b", 2)], past("a", 3));
        assert_eq!(history, vec![past("a", 3), past("b", 2)]);
        // A look-up asked before another but finishing after it goes behind it.
        let late = add(vec![past("b", 5), past("c", 2)], past("a", 4));
        assert_eq!(late, vec![past("b", 5), past("a", 4), past("c", 2)]);
        // An older look-up of a word never replaces a newer one of it.
        let stale = add(vec![past("a", 6), past("b", 5)], past("a", 3));
        assert_eq!(stale, vec![past("a", 6), past("b", 5)]);
        assert_eq!(add(Vec::new(), past("a", 1)), vec![past("a", 1)]);
    }
}
