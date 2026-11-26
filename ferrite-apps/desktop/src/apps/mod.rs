//! The app registry: every app module the desktop serves.
//!
//! To add an app, create `src/apps/<name>/mod.rs` exporting
//! `pub const MODULE: AppModule`, then add its `mod` line and its entry to
//! [`MODULES`] below, one line each, in alphabetical order. Nothing else in
//! the core changes. README.md, "Adding an app module", has the details.

use ferrite_app::serde_json;

use crate::module::AppModule;

mod about_this_mac;
mod activity_monitor;
mod allowance;
mod app_store;
pub mod attachments;
pub mod automator;
mod books;
mod calculator;
pub mod calendar;
pub mod catalogue;
mod chess;
mod console;
mod contacts;
mod dictionary;
mod document;
pub mod egress;
mod facetime;
mod fetch;
mod files;
mod find_my;
mod font_book;
mod help_viewer;
mod home;
mod keychain_access;
mod launchpad;
mod mail;
mod maps;
mod messages;
mod music;
mod network_utility;
pub mod news;
mod notes;
pub mod notification_center;
mod photo_booth;
mod photos;
mod podcasts;
mod preview;
mod quicktime_player;
pub mod reminders;
pub mod safari;
pub mod script_editor;
mod siri;
mod spotlight;
mod stickies;
mod stocks;
mod storage_management;
pub mod system;
mod system_information;
mod system_preferences;
mod textedit;
mod tv;
mod voice_memos;
mod weather;

/// Every registered module, by name.
pub const MODULES: &[AppModule] = &[
    about_this_mac::MODULE,
    activity_monitor::MODULE,
    app_store::MODULE,
    automator::MODULE,
    books::MODULE,
    calculator::MODULE,
    calendar::MODULE,
    chess::MODULE,
    console::MODULE,
    contacts::MODULE,
    dictionary::MODULE,
    facetime::MODULE,
    files::MODULE,
    find_my::MODULE,
    font_book::MODULE,
    help_viewer::MODULE,
    home::MODULE,
    keychain_access::MODULE,
    launchpad::MODULE,
    mail::MODULE,
    maps::MODULE,
    messages::MODULE,
    music::MODULE,
    network_utility::MODULE,
    news::MODULE,
    notes::MODULE,
    notification_center::MODULE,
    photo_booth::MODULE,
    photos::MODULE,
    podcasts::MODULE,
    preview::MODULE,
    quicktime_player::MODULE,
    reminders::MODULE,
    safari::MODULE,
    script_editor::MODULE,
    siri::MODULE,
    spotlight::MODULE,
    stickies::MODULE,
    stocks::MODULE,
    storage_management::MODULE,
    system_information::MODULE,
    system_preferences::MODULE,
    textedit::MODULE,
    tv::MODULE,
    voice_memos::MODULE,
    weather::MODULE,
];

/// Every module's live feed, served on the `/live/` stream route
/// (`src/live.rs`).
pub static FEEDS: &[crate::live::LiveFeed] = &[chess::FEED, messages::FEED];

/// The module serving `/api/<name>/`.
pub fn find(name: &str) -> Option<&'static AppModule> {
    MODULES.iter().find(|m| m.name == name)
}

/// The documents Storage Management offers to forget, as `(module, key)`:
/// each is forgotten by `DELETE /api/<module>/<key>`.
pub fn forgettable_documents() -> impl Iterator<Item = (&'static str, &'static str)> {
    storage_management::DOCUMENTS.iter().map(|d| (d.app, d.key))
}

/// Whether the router counts and logs requests for `name`: a registered
/// module, or one of its own endpoints. Any other first path segment is
/// answered 404 and not counted, so a request cannot make a counter of a
/// name of its choosing.
pub fn counted(name: &str) -> bool {
    matches!(name, "session" | "apps") || find(name).is_some()
}

/// The `GET /api/apps` body: `apps`, the apps with a server half, and
/// `catalogue`, every app the desktop hosts ([`catalogue`]).
pub fn describe() -> serde_json::Value {
    let apps: Vec<_> = MODULES
        .iter()
        .map(|m| serde_json::json!({ "name": m.name, "title": m.title, "api": format!("/api/{}/", m.name) }))
        .collect();
    serde_json::json!({ "apps": apps, "catalogue": catalogue::describe() })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Names the router reserves for itself.
    const RESERVED: &[&str] = &["session", "apps"];

    #[test]
    fn module_names_are_unique_url_safe_and_unreserved() {
        let mut seen = std::collections::BTreeSet::new();
        for module in MODULES {
            let name = module.name;
            assert!(
                !name.is_empty()
                    && name
                        .bytes()
                        .all(|b| matches!(b, b'a'..=b'z' | b'0'..=b'9' | b'-')),
                "'{name}' must be lowercase letters, digits and '-'"
            );
            assert!(
                !RESERVED.contains(&name),
                "'{name}' is reserved by the router"
            );
            assert!(seen.insert(name), "'{name}' is registered twice");
            assert!(!module.title.is_empty(), "'{name}' needs a title");
        }
    }

    #[test]
    fn every_feed_belongs_to_a_registered_module() {
        for feed in FEEDS {
            assert!(
                find(feed.app).is_some(),
                "feed '{}' has no module",
                feed.app
            );
        }
    }
}
