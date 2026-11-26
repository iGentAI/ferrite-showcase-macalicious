# Save panel (`save-panel`)

- **Status:** not seen in the screenshots
- **AppKit:** `NSSavePanel` (`nameFieldStringValue`, `nameFieldLabel`, `prompt`, `allowedFileTypes`, `canCreateDirectories`, `isExpanded`, `showsTagField`, `accessoryView`), normally presented as a sheet with `beginSheetModal(for:)`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/dialogs/ ("Save Dialogs")
- **Appearances shown:** none (searched the 72 assigned screenshots and the manifest captions; no "Save" surface exists in the library)

## Purpose and behaviour

The Save dialog names a document and chooses its location and format. It is document-modal (a sheet on
the document window) and has two forms: **collapsed** (name field, tags field, a "Where" pop-up of
recent and favourite places, optional format pop-up) and **expanded** (the same fields above a full
file browser identical to the Open panel). A disclosure button to the right of the name field toggles
the forms. The default button is "Save" [D: HIG Dialogs, Save Dialogs].

## Anatomy

Collapsed (all [I] unless tagged; built from measured parts of this library):

```
=========== attached under the parent's title bar (see sheet) ===========
|        Save As: [ Untitled                         ] [v]              |   name field 22 pt; disclosure button 20 pt
|           Tags: [                                  ]                  |   token field 22 pt
|          Where: [ (folder) Documents              ^v]                 |   pop-up 20 pt
|    File Format: [ Rich Text Document              ^v]                 |   optional accessory
|                                              [ Cancel ]  [  Save  ]   |
=========================================================================
```

Expanded: the `open-panel` toolbar, sidebar and browser appear between the name/tags rows and the
bottom bar; the bottom bar holds "New Folder" (left), optional "Hide extension" checkbox and format
accessory, then Cancel and Save (right).

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| form | collapsed, expanded | collapsed (remembered) | `isExpanded` | no |
| tags field | shown, hidden | shown | `showsTagField` | no |
| accessory | none, format pop-up, custom | none | `accessoryView` | no |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Any | no | not captured in the library |

## Measurements

### Geometry (pt)

| Property | Value | Tag | Evidence / basis |
|---|---|---|---|
| Sheet attachment, material, shadow | as `sheet` | [I] | measured on the Print sheet |
| Collapsed width | about 450 pt | [I] | typical 10.15 collapsed save sheet; not measurable here |
| Label column | right-aligned 13 pt labels, 8.5 pt before the control | [I] | same form metrics as the Print sheet (`print-panel`) |
| Field / pop-up heights | text field 22 pt, pop-up 20 pt, row pitch 30 pt | [I] | measured values of the same controls in `preferences-window` and `dialog` |
| Buttons | 20 pt tall, Cancel and Save min 69..83 pt wide, 13 pt apart, 20.5 pt margins | [I] | `dialog` measurements |
| Expanded browser | identical to `open-panel` (toolbar 42 pt, sidebar 155 pt, bottom bar 41 pt) | [I] | NSSavePanel and NSOpenPanel share the browser |

### Colours and fills

As `sheet` (background material) and `open-panel` (browser) [I].

### Text and icons

Labels "Save As:", "Tags:", "Where:" in 13 pt regular, right-aligned; the name field is focused with
the base name selected (extension excluded) when the sheet opens [D: NSSavePanel behaviour].

### Shadows and effects

As `sheet`.

## Layout and spacing

The disclosure button sits 8 pt to the right of the name field and toggles between a down chevron
(collapsed) and up chevron (expanded); expanding animates the sheet's height [D/I].

## Keyboard and accessibility

Return = Save, Escape = Cancel, Command-D = Desktop, Command-Shift-G = Go to Folder, Command-Shift-N =
New Folder, typing "/" or "~" opens Go to Folder [D]. AX: AXSheet with AXTextField "Save As:". ARIA:
`dialog` with a labelled text input focused on open.

## Browser notes

Same constraints as `open-panel`; saving maps to a download or the File System Access API.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| - | none | - | not present in the 294 screenshots; closest relatives: 10-15-Catalina-Light-Finder-Open.png (browser) and 10-15-Catalina-Light-Print.png (sheet form) |
