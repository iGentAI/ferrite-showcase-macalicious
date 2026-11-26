//! The desktop's app catalogue: every Macalicious app the desktop hosts, as
//! the server registers it.
//!
//! `GET /api/apps` answers it as `catalogue`. Launchpad and the Dock show the
//! apps that come with the desktop (`preinstalled`) and those the session got
//! from the App Store (`src/apps/app_store`); Launchpad keeps its order and
//! page per session (`src/apps/launchpad`). The App Store sells the apps that
//! are not preinstalled. Each `id` is the app's demo folder, `demos/<id>`; the
//! test `demos/desktop/desktop-library.test.ts` checks that this list and the
//! desktop's demos name the same apps. Finder is not listed: it is always
//! running and is in no Launchpad. Nor are the demos `not-deployed.json`
//! names: they are not apps on Ferrite, and the Ferrite build of the desktop
//! leaves them out (`docs/desktop/vite.config.ts`).

use ferrite_app::serde_json;

/// One app of the catalogue.
pub struct CatalogueApp {
    /// The demo folder's name.
    pub id: &'static str,
    /// The app's name, as its Dock tile shows it.
    pub name: &'static str,
    /// One of [`CATEGORIES`]: where the App Store lists it.
    pub category: &'static str,
    /// One line about the app, under its name in the App Store.
    pub summary: &'static str,
    /// Whether the app comes with the desktop. The others are got from the
    /// App Store.
    pub preinstalled: bool,
}

/// The categories an app may have.
pub const CATEGORIES: &[&str] = &[
    "productivity",
    "internet",
    "media",
    "creativity",
    "utilities",
    "system",
    "games",
];

const fn app(
    id: &'static str,
    name: &'static str,
    category: &'static str,
    summary: &'static str,
    preinstalled: bool,
) -> CatalogueApp {
    CatalogueApp {
        id,
        name,
        category,
        summary,
        preinstalled,
    }
}

/// Every app, in the order of their names.
pub const CATALOGUE: &[CatalogueApp] = &[
    app(
        "about-this-mac",
        "About This Mac",
        "system",
        "The Mac, its displays, storage and memory",
        true,
    ),
    app(
        "activity-monitor",
        "Activity Monitor",
        "utilities",
        "How fast Ferrite answers each app",
        true,
    ),
    app(
        "app-store",
        "App Store",
        "system",
        "Get more Macalicious apps",
        true,
    ),
    app(
        "automator",
        "Automator",
        "utilities",
        "Build workflows from actions",
        false,
    ),
    app(
        "books",
        "Books",
        "media",
        "A library of books to read",
        false,
    ),
    app(
        "calculator",
        "Calculator",
        "productivity",
        "Sums, with a paper tape kept on the server",
        true,
    ),
    app(
        "calendar",
        "Calendar",
        "productivity",
        "Events kept per session",
        true,
    ),
    app(
        "chess",
        "Chess",
        "games",
        "Play the computer, or another account by invitation",
        true,
    ),
    app(
        "console",
        "Console",
        "utilities",
        "Read the system's log messages",
        true,
    ),
    app(
        "contacts",
        "Contacts",
        "productivity",
        "Cards kept per session",
        true,
    ),
    app(
        "dictionary",
        "Dictionary",
        "productivity",
        "Definitions, thesaurus and Wikipedia",
        false,
    ),
    app("facetime", "FaceTime", "internet", "Video calls", true),
    app(
        "find-my",
        "Find My",
        "utilities",
        "Your browsers on a map, and Play Sound",
        false,
    ),
    app(
        "font-book",
        "Font Book",
        "creativity",
        "Fonts and collections kept per session",
        true,
    ),
    app(
        "force-quit",
        "Force Quit Applications",
        "system",
        "Quit an app that stopped responding",
        true,
    ),
    app(
        "help-viewer",
        "Help Viewer",
        "productivity",
        "Help books, searched on the server",
        true,
    ),
    app(
        "home",
        "Home",
        "utilities",
        "A home, rooms and scenes, with simulated accessories",
        true,
    ),
    app(
        "keychain-access",
        "Keychain Access",
        "utilities",
        "Passwords and certificates",
        true,
    ),
    app("mail", "Mail", "internet", "Mailboxes and messages", true),
    app("maps", "Maps", "internet", "Places and directions", true),
    app(
        "messages",
        "Messages",
        "internet",
        "A room that updates live",
        true,
    ),
    app("music", "Music", "media", "A library of songs", true),
    app(
        "network-utility",
        "Network Utility",
        "utilities",
        "Real DNS and registry lookups, and what a web service cannot do",
        true,
    ),
    app("news", "News", "media", "Stories from many sources", true),
    app(
        "notes",
        "Notes",
        "productivity",
        "Notes kept per session",
        true,
    ),
    app(
        "photo-booth",
        "Photo Booth",
        "creativity",
        "Snapshots with effects",
        false,
    ),
    app(
        "photos",
        "Photos",
        "creativity",
        "A library of pictures",
        true,
    ),
    app("podcasts", "Podcasts", "media", "Shows and episodes", true),
    app(
        "preview",
        "Preview",
        "creativity",
        "View pictures and documents",
        false,
    ),
    app(
        "quicktime-player",
        "QuickTime Player",
        "media",
        "Play a movie",
        false,
    ),
    app(
        "reminders",
        "Reminders",
        "productivity",
        "Lists kept per session",
        true,
    ),
    app("safari", "Safari", "internet", "Browse the web", true),
    app(
        "script-editor",
        "Script Editor",
        "utilities",
        "Write and run scripts",
        false,
    ),
    app(
        "stickies",
        "Stickies",
        "productivity",
        "Notes on the desktop, kept per session",
        true,
    ),
    app(
        "stocks",
        "Stocks",
        "productivity",
        "Real quotes, charts and price alerts",
        false,
    ),
    app(
        "storage-management",
        "Storage Management",
        "system",
        "Your drive against its quota",
        true,
    ),
    app(
        "system-information",
        "System Information",
        "system",
        "Every part of the Mac",
        true,
    ),
    app(
        "system-preferences",
        "System Preferences",
        "system",
        "Settings kept per session",
        true,
    ),
    app(
        "terminal",
        "Terminal",
        "utilities",
        "Command line for your files",
        true,
    ),
    app(
        "textedit",
        "TextEdit",
        "productivity",
        "Documents kept per session",
        true,
    ),
    app("tv", "TV", "media", "Shows and movies", true),
    app("voice-memos", "Voice Memos", "media", "Recordings", false),
];

/// The app `id` names.
pub fn find(id: &str) -> Option<&'static CatalogueApp> {
    CATALOGUE.iter().find(|app| app.id == id)
}

/// The catalogue as `GET /api/apps` answers it.
pub fn describe() -> serde_json::Value {
    CATALOGUE
        .iter()
        .map(|app| {
            serde_json::json!({
                "id": app.id,
                "name": app.name,
                "category": app.category,
                "summary": app.summary,
                "preinstalled": app.preinstalled,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_catalogue_is_well_formed() {
        let mut seen = std::collections::BTreeSet::new();
        for app in CATALOGUE {
            assert!(
                super::super::document::valid_key(app.id),
                "'{}' is not a plain id",
                app.id
            );
            assert!(seen.insert(app.id), "'{}' is listed twice", app.id);
            assert!(
                !app.name.is_empty() && !app.summary.is_empty(),
                "'{}'",
                app.id
            );
            assert!(
                CATEGORIES.contains(&app.category),
                "'{}' has no known category",
                app.id
            );
        }
        assert!(find("finder").is_none(), "Finder is not in Launchpad");
        assert!(find("app-store").is_some_and(|app| app.preinstalled));
        assert!(
            CATALOGUE.iter().any(|app| !app.preinstalled),
            "the App Store has something to sell"
        );
        let names: Vec<_> = CATALOGUE.iter().map(|app| app.id).collect();
        let mut sorted = names.clone();
        sorted.sort_unstable();
        assert_eq!(names, sorted, "kept in the order of their ids");
    }
}
