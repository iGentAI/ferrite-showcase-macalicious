"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { type ReactNode, useEffect, useState } from "react";
import type { DesktopApp } from "../desktop/desktop-apps";
import { AppTile } from "../desktop/desktop-artwork";
import {
  LibraryUnreadable,
  removeFromLibrary,
  useAppLibrary,
  useCatalogue,
} from "../desktop/desktop-library";
import { servedByDesktopApp } from "../desktop/desktop-server";
import "./app-store.tokens.css";
import "./app-store-launchpad.css";

/** The class Launchpad gives an app that shows its delete badge (`app-store-launchpad.css`). */
export const REMOVABLE_CLASS = "mac-app-store-removable";

/** What Launchpad needs to delete an app got from the App Store. */
export interface LaunchpadRemoval {
  /** Whether Option is held while Launchpad is open: removable apps show their delete badge. */
  editing: boolean;
  /** Whether `id` is an app the person got from the App Store, which Launchpad can delete. */
  removable: (id: string) => boolean;
  /** Asks whether to delete the app, as Launchpad does. */
  ask: (app: Pick<DesktopApp, "id" | "name">) => void;
  /** The question, rendered beside Launchpad. */
  alert: ReactNode;
  /** Whether a question is showing: Launchpad stays open behind it, as on macOS. */
  asking: boolean;
}

/**
 * Deleting an app from Launchpad, when the desktop's Ferrite application serves the page: while
 * Option is held, the apps the person got from the App Store jiggle and show a delete badge, and
 * pressing one asks “Delete ‘Books’?”; Delete takes it out of the person's library
 * (`/api/app-store/library`, `removeFromLibrary`), which removes it from the Dock and Launchpad in
 * every window and browser of the person, and says so when the server could not keep the change.
 * Apps that come with the desktop cannot be deleted. Its data stays.
 */
export function useLaunchpadRemoval(open: boolean): LaunchpadRemoval {
  const served = servedByDesktopApp();
  const { catalogue } = useCatalogue(served);
  const library = useAppLibrary(served);
  const [option, setOption] = useState(false);
  const [asked, setAsked] = useState<Pick<DesktopApp, "id" | "name"> | null>(null);
  // A delete that failed: before anything was sent (`unread`), or a save the server did not keep.
  const [failed, setFailed] = useState<
    (Pick<DesktopApp, "id" | "name"> & { unread: boolean }) | null
  >(null);

  // Option is followed from the keyboard whether or not Launchpad is open, so holding it before
  // Launchpad opens starts editing as soon as it does; while Launchpad is open, pointer events
  // carry the modifier's state too (Option pressed while the browser window had no focus).
  useEffect(() => {
    if (!served) {
      setOption(false);
      return;
    }
    const follow = (event: KeyboardEvent) => setOption(event.altKey);
    const away = () => setOption(false);
    window.addEventListener("keydown", follow);
    window.addEventListener("keyup", follow);
    window.addEventListener("blur", away);
    return () => {
      window.removeEventListener("keydown", follow);
      window.removeEventListener("keyup", follow);
      window.removeEventListener("blur", away);
    };
  }, [served]);
  useEffect(() => {
    if (!served || !open) return;
    const follow = (event: PointerEvent) => setOption(event.altKey);
    window.addEventListener("pointerdown", follow);
    window.addEventListener("pointermove", follow);
    return () => {
      window.removeEventListener("pointerdown", follow);
      window.removeEventListener("pointermove", follow);
    };
  }, [served, open]);

  const removable = (id: string) =>
    served &&
    library.installed.includes(id) &&
    catalogue?.some((app) => app.id === id && !app.preinstalled) === true;

  const alert = (
    <>
      <Alert
        open={asked !== null}
        onOpenChange={(next) => {
          if (!next) setAsked(null);
        }}
      >
        <AlertPopup icon={asked ? <AppTile id={asked.id} name={asked.name} /> : undefined}>
          <AlertMessage>Delete “{asked?.name}”?</AlertMessage>
          <AlertInformativeText>
            It leaves your Dock and Launchpad in every browser. You can get it again from the App
            Store, and what it keeps for you stays.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                if (!asked) return;
                const app = asked;
                removeFromLibrary(app.id).catch((error: unknown) =>
                  setFailed({ ...app, unread: error instanceof LibraryUnreadable }),
                );
              }}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert
        open={failed !== null}
        onOpenChange={(next) => {
          if (!next) setFailed(null);
        }}
      >
        <AlertPopup icon={failed ? <AppTile id={failed.id} name={failed.name} /> : undefined}>
          <AlertMessage>
            {failed?.unread
              ? `“${failed.name}” could not be deleted.`
              : `“${failed?.name}” is not deleted on the server yet.`}
          </AlertMessage>
          <AlertInformativeText>
            {failed?.unread
              ? "Your apps could not be read. Check your connection, then try again."
              : "The change is sent again the next time this page reads your apps; if the page is reloaded first, the app comes back. Check your connection."}
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </>
  );

  return {
    editing: open && served && option,
    removable,
    ask: (app) => setAsked({ id: app.id, name: app.name }),
    alert,
    asking: asked !== null || failed !== null,
  };
}
