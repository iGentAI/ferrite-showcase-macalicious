//! Daily allowances: how many times one person may, in a day, do something
//! that writes into other people's spaces or into the shared space (send
//! mail, start a conversation, write a message). A person's own documents
//! are bounded by their own limits; these bound what one account can make
//! another account, or everyone, keep.
//!
//! Each allowance is one value in the person's own space,
//! `allowance/<what>`: the day (UTC, counted from the epoch) and how many
//! were taken that day, changed by compare-and-set. A new day starts the
//! count again in the same value, so a person keeps one value per allowance
//! (a Guest User's goes with the rest of the guest's data).

use std::io;

use crate::module::Space;

const DAY_MS: u64 = 24 * 60 * 60 * 1000;
const CAS_ATTEMPTS: usize = 8;

/// The day and count a stored value holds, `"<day> <count>"`; anything else
/// reads as nothing taken.
fn parse(bytes: &[u8]) -> Option<(u64, u32)> {
    let text = std::str::from_utf8(bytes).ok()?;
    let (day, count) = text.split_once(' ')?;
    Some((day.parse().ok()?, count.parse().ok()?))
}

/// Take one use of `what` for the day of `now_ms`, if fewer than `limit`
/// have been taken that day: `Ok(false)` when the day's allowance is spent.
pub async fn take(space: &mut Space<'_>, what: &str, limit: u32, now_ms: u64) -> io::Result<bool> {
    let day = now_ms / DAY_MS;
    let key = format!("allowance/{what}");
    for _ in 0..CAS_ATTEMPTS {
        let stored = space.get_versioned(&key).await?;
        let used = match stored.as_ref().and_then(|(bytes, _)| parse(bytes)) {
            Some((on, count)) if on == day => count,
            _ => 0,
        };
        if used >= limit {
            return Ok(false);
        }
        let next = format!("{day} {}", used + 1);
        let version = stored.map(|(_, version)| version);
        if space.put_if_version(&key, next.as_bytes(), version).await? {
            return Ok(true);
        }
    }
    Err(io::Error::other("the day's allowance kept changing; retry"))
}

/// Give back one use of `what` taken on the day of `now_ms` (by an attempt
/// that turned out to repeat one already counted). Nothing is given back on
/// another day, nor below none.
pub async fn give_back(space: &mut Space<'_>, what: &str, now_ms: u64) -> io::Result<()> {
    let day = now_ms / DAY_MS;
    let key = format!("allowance/{what}");
    for _ in 0..CAS_ATTEMPTS {
        let Some((bytes, version)) = space.get_versioned(&key).await? else {
            return Ok(());
        };
        let used = match parse(&bytes) {
            Some((on, count)) if on == day && count > 0 => count,
            _ => return Ok(()),
        };
        let next = format!("{day} {}", used - 1);
        if space
            .put_if_version(&key, next.as_bytes(), Some(version))
            .await?
        {
            return Ok(());
        }
    }
    Err(io::Error::other("the day's allowance kept changing; retry"))
}

#[cfg(test)]
mod tests {
    use super::parse;

    #[test]
    fn a_stored_count_is_read_or_ignored() {
        assert_eq!(parse(b"20380 7"), Some((20380, 7)));
        for bad in [&b""[..], b"7", b"x 7", b"20380 -1", b"20380 7 8"] {
            assert_eq!(parse(bad), None, "{bad:?}");
        }
    }
}
