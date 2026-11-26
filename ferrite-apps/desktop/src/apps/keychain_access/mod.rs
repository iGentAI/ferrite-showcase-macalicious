//! Keychain Access's server half: a session's keychain, encrypted in the
//! browser.
//!
//! The server never sees a password, a note or an item's name. The Keychain
//! Access window derives a key from the keychain password the person types
//! (PBKDF2 with SHA-256 over a random salt, in WebCrypto), encrypts the whole
//! list of items with AES-GCM under a fresh 12-byte IV on every save, and
//! sends only the salt, the iteration count, the IV and the ciphertext. The
//! keychain password itself is never sent. A forgotten keychain password
//! cannot be recovered here: the only way back is to forget the keychain
//! (`DELETE`) and start a new one. `ctx.secret` is not used: it holds the
//! application's own secrets, not its users'.
//!
//! * `GET /api/keychain-access/vault`: `{"vault": {...} | null, "rev": n,
//!   "session": id}`; `null` before the session has made a keychain.
//! * `PUT /api/keychain-access/vault` with `{"vault": {...}, "rev": n}`:
//!   replaces the keychain, or 409 with the current one (`document.rs`).
//! * `DELETE /api/keychain-access/vault`: forgets it.
//! * `GET /api/keychain-access/keychains`: `{"keychains": [{"id", "name", "vault"}] | null,
//!   "rev": n, "session": id}`: the keychains the person made beside "login", each with
//!   a password of its own that the server never sees. A keychain's name is stored as
//!   written, so that the list can show it while it is locked, and the window says so as
//!   it asks for the name; what is in it is sealed in its `vault`.
//! * `PUT /api/keychain-access/keychains` with `{"keychains": [...], "rev": n}`: replaces
//!   them, or 409 with the current ones. At most [`MAX_KEYCHAINS`], whose ciphertexts
//!   together take at most [`MAX_CIPHERTEXT_CHARS`].
//! * `DELETE /api/keychain-access/keychains`: forgets them.
//!
//! A vault is `{"version": 1, "kdf": {"name": "PBKDF2-SHA-256",
//! "iterations": n, "salt": b64}, "iv": b64, "ciphertext": b64}`, base64 as
//! RFC 4648 writes it. The server checks only the envelope: the salt is 16
//! bytes, the IV 12, the ciphertext at least the 16-byte GCM tag and at most
//! [`MAX_CIPHERTEXT_CHARS`] characters, and the iteration count within
//! [`MIN_ITERATIONS`]..=[`MAX_ITERATIONS`]. Whether the ciphertext decrypts is
//! something only the browser that knows the password can tell.

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "keychain-access",
    title: "Keychain Access",
    handle,
};

/// The key derivation the window uses.
pub const KDF: &str = "PBKDF2-SHA-256";
/// The fewest PBKDF2 iterations the server accepts.
pub const MIN_ITERATIONS: u32 = 100_000;
/// The most PBKDF2 iterations the server accepts.
pub const MAX_ITERATIONS: u32 = 10_000_000;
/// The longest ciphertext, in base64 characters (about 150 KB of items).
pub const MAX_CIPHERTEXT_CHARS: usize = 200_000;
const SALT_BYTES: usize = 16;
const IV_BYTES: usize = 12;
const TAG_BYTES: usize = 16;
const KEY: &str = "vault";
const KEYCHAINS_KEY: &str = "keychains";
/// The most keychains a person keeps beside "login".
pub const MAX_KEYCHAINS: usize = 8;
/// The longest keychain's name.
const MAX_NAME_CHARS: usize = 64;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Kdf {
    pub name: String,
    pub iterations: u32,
    pub salt: String,
}

/// The encrypted keychain, as stored.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Vault {
    pub version: u32,
    pub kdf: Kdf,
    pub iv: String,
    pub ciphertext: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    vault: Vault,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

/// A keychain beside "login": what can be listed while it is locked, and its envelope.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Keychain {
    pub id: String,
    pub name: String,
    pub vault: Vault,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct KeychainsBody {
    keychains: Vec<Keychain>,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/vault") => document::read(&mut cx.storage.user(), KEY)
            .await
            .map(|current| {
                document::for_session(reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/vault") => match cx.request.json::<Body>().map(|body| {
            let named = body.session;
            validate(&body.vault).map(|()| (body.vault, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((vault, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => document::write(&mut cx.storage.user(), KEY, Some(base), Some(&vault))
                        .await
                        .map(|saved| document::answer(saved, Some(&vault), reply)),
                }
            }
        },
        ("DELETE", "/vault") => document::write::<Vault>(&mut cx.storage.user(), KEY, None, None)
            .await
            .map(|saved| document::answer(saved, None, reply)),
        (_, "/vault") => Ok(Response::method_not_allowed()),
        ("GET", "/keychains") => document::read(&mut cx.storage.user(), KEYCHAINS_KEY)
            .await
            .map(|current| {
                document::for_session(reply_keychains(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/keychains") => match cx.request.json::<KeychainsBody>().map(|body| {
            let named = body.session;
            validate_keychains(&body.keychains).map(|()| (body.keychains, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((keychains, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => document::write(
                        &mut cx.storage.user(),
                        KEYCHAINS_KEY,
                        Some(base),
                        Some(&keychains),
                    )
                    .await
                    .map(|saved| document::answer(saved, Some(&keychains), reply_keychains)),
                }
            }
        },
        ("DELETE", "/keychains") => {
            document::write::<Vec<Keychain>>(&mut cx.storage.user(), KEYCHAINS_KEY, None, None)
                .await
                .map(|saved| document::answer(saved, None, reply_keychains))
        }
        (_, "/keychains") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// What a `GET` answers.
fn reply(vault: Option<&Vault>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "vault": vault, "rev": rev })
}

/// What a `GET` of the keychains answers.
fn reply_keychains(keychains: Option<&Vec<Keychain>>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "keychains": keychains, "rev": rev })
}

/// Check submitted keychains: plain unique ids, names that can be told apart, and envelopes that
/// together fit what one keychain may hold.
fn validate_keychains(keychains: &[Keychain]) -> Result<(), String> {
    if keychains.len() > MAX_KEYCHAINS {
        return Err(format!("at most {MAX_KEYCHAINS} keychains beside login"));
    }
    let mut ids = std::collections::BTreeSet::new();
    let mut names = std::collections::BTreeSet::from(["login".to_string()]);
    let mut total = 0;
    for keychain in keychains {
        if !document::valid_key(&keychain.id) || !ids.insert(keychain.id.as_str()) {
            return Err(format!("{:?} is not a keychain id here", keychain.id));
        }
        let length = keychain.name.chars().count();
        if keychain.name.trim().is_empty() || length > MAX_NAME_CHARS {
            return Err(format!(
                "a keychain's name has 1 to {MAX_NAME_CHARS} characters"
            ));
        }
        if !names.insert(keychain.name.to_lowercase()) {
            return Err(format!("a keychain is already called {:?}", keychain.name));
        }
        total += keychain.vault.ciphertext.len();
        validate_envelope(&keychain.vault, MAX_CIPHERTEXT_CHARS)?;
    }
    if total > MAX_CIPHERTEXT_CHARS {
        return Err(format!(
            "the keychains together are at most {MAX_CIPHERTEXT_CHARS} characters"
        ));
    }
    Ok(())
}

/// The bytes of a base64 field, or why it is not one.
fn bytes(what: &str, text: &str) -> Result<Vec<u8>, String> {
    crate::site::decode_base64(text).map_err(|e| format!("{what} is not base64: {e}"))
}

/// Check a submitted vault's envelope.
fn validate(vault: &Vault) -> Result<(), String> {
    validate_envelope(vault, MAX_CIPHERTEXT_CHARS)
}

/// Check an envelope whose ciphertext may be at most `max_chars` base64 characters.
pub fn validate_envelope(vault: &Vault, max_chars: usize) -> Result<(), String> {
    if vault.version != 1 {
        return Err("the vault's version is 1".into());
    }
    if vault.kdf.name != KDF {
        return Err(format!("the key derivation is {KDF}"));
    }
    if !(MIN_ITERATIONS..=MAX_ITERATIONS).contains(&vault.kdf.iterations) {
        return Err(format!(
            "the iteration count is {MIN_ITERATIONS} to {MAX_ITERATIONS}"
        ));
    }
    if bytes("the salt", &vault.kdf.salt)?.len() != SALT_BYTES {
        return Err(format!("the salt is {SALT_BYTES} bytes"));
    }
    if bytes("the IV", &vault.iv)?.len() != IV_BYTES {
        return Err(format!("the IV is {IV_BYTES} bytes"));
    }
    if vault.ciphertext.len() > max_chars {
        return Err(format!("the ciphertext is at most {max_chars} characters"));
    }
    if bytes("the ciphertext", &vault.ciphertext)?.len() < TAG_BYTES {
        return Err(format!(
            "the ciphertext holds at least its {TAG_BYTES}-byte tag"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 16 zero bytes, 12 zero bytes and 20 zero bytes in base64.
    fn vault() -> Vault {
        Vault {
            version: 1,
            kdf: Kdf {
                name: KDF.into(),
                iterations: 600_000,
                salt: "AAAAAAAAAAAAAAAAAAAAAA==".into(),
            },
            iv: "AAAAAAAAAAAAAAAA".into(),
            ciphertext: "AAAAAAAAAAAAAAAAAAAAAAAAAAA=".into(),
        }
    }

    #[test]
    fn keychains_beside_login_are_checked_one_by_one_and_together() {
        let keychain = |id: &str, name: &str| Keychain {
            id: id.into(),
            name: name.into(),
            vault: vault(),
        };
        assert_eq!(
            validate_keychains(&[keychain("a", "Work"), keychain("b", "Home")]),
            Ok(())
        );
        for (bad, says) in [
            (vec![keychain("a", "Login")], "already called"),
            (
                vec![keychain("a", "Work"), keychain("b", "work")],
                "already called",
            ),
            (
                vec![keychain("a", "Work"), keychain("a", "Home")],
                "not a keychain id",
            ),
            (vec![keychain("a/b", "Work")], "not a keychain id"),
            (vec![keychain("a", " ")], "1 to 64"),
        ] {
            let refusal = validate_keychains(&bad).unwrap_err();
            assert!(refusal.contains(says), "{refusal}");
        }
        let many: Vec<_> = (0..=MAX_KEYCHAINS)
            .map(|n| keychain(&format!("k{n}"), &format!("K{n}")))
            .collect();
        assert!(validate_keychains(&many).unwrap_err().contains("at most 8"));
        let mut large = vault();
        large.ciphertext = "A".repeat(MAX_CIPHERTEXT_CHARS / 4 * 3);
        let heavy = |id: &str| Keychain {
            id: id.into(),
            name: id.into(),
            vault: large.clone(),
        };
        assert!(validate_keychains(&[heavy("one"), heavy("two")])
            .unwrap_err()
            .contains("together"));
    }

    #[test]
    fn an_envelope_in_the_window_s_shape_is_accepted() {
        assert_eq!(validate(&vault()), Ok(()));
        let text = serde_json::to_string(&vault()).unwrap();
        assert_eq!(serde_json::from_str::<Vault>(&text).unwrap(), vault());
    }

    #[test]
    fn malformed_envelopes_are_refused() {
        let cases: Vec<(&str, Box<dyn Fn(&mut Vault)>)> = vec![
            ("version", Box::new(|v| v.version = 2)),
            ("kdf", Box::new(|v| v.kdf.name = "scrypt".into())),
            ("few iterations", Box::new(|v| v.kdf.iterations = 1_000)),
            ("short salt", Box::new(|v| v.kdf.salt = "AAAA".into())),
            (
                "long IV",
                Box::new(|v| v.iv = "AAAAAAAAAAAAAAAAAAAA".into()),
            ),
            (
                "not base64",
                Box::new(|v| v.ciphertext = "not base64!".into()),
            ),
            ("no tag", Box::new(|v| v.ciphertext = "AAAA".into())),
            (
                "too long",
                Box::new(|v| v.ciphertext = "A".repeat(MAX_CIPHERTEXT_CHARS + 4)),
            ),
        ];
        for (what, change) in cases {
            let mut bad = vault();
            change(&mut bad);
            assert!(validate(&bad).is_err(), "{what}");
        }
        assert!(
            serde_json::from_str::<Vault>(
                r#"{"version":1,"kdf":{"name":"PBKDF2-SHA-256","iterations":600000,"salt":""},"iv":"","ciphertext":"","password":"x"}"#
            )
            .is_err(),
            "no field beside the envelope, such as a password, is taken"
        );
    }
}
