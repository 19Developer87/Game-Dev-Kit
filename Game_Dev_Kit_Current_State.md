# Game Dev Kit Current State

## 1. Project Overview

This project is a reusable browser-based Game Dev Kit / Level Editor. It is currently a standalone browser tool for visually creating and editing level data, rather than a runtime game or a game integration layer.

The editor is intended to remain reusable so it can later sit on top of different game projects and save data those projects can consume.

Chrome is the main test browser. The editor uses browser file and folder functionality, including the File System Access API, which works in normal Chrome but may be unavailable or restricted in the Codex browser preview.

## 2. Relationship To `GAME_DEV_KIT_PLAN.md`

The existing roadmap file in this repository is [`GAME_DEV_KIT_PLAN.md`](./GAME_DEV_KIT_PLAN.md). It defines the long-term roadmap and phase plan.

This file, `Game_Dev_Kit_Current_State.md`, is the current-state reference. It describes behaviour that exists now, the present implementation shape, and the features future changes must preserve.

Future Codex sessions should read both files before making changes:

1. Read `GAME_DEV_KIT_PLAN.md` for intent and phase boundaries.
2. Read `Game_Dev_Kit_Current_State.md` for existing behaviour and regression constraints.

Update this current-state file whenever working behaviour changes.

## 3. Current Phase Status

- The project is currently in Phase 3.
- Phase 1 and Phase 2 functionality is working.
- Phase 3 has a solid asset import, categorisation, grid selection, and placement base and is being polished.
- Phase 4 has not started.
- Do not implement Phase 4 unless the user explicitly requests it.

## 4. Current Working Features

The editor currently supports:

- A standalone browser editor served locally by `dev-server.mjs`.
- Grid display and fixed coordinate headers.
- Grid size selection for `10x10`, `20x20`, `30x30`, `40x40`, `50x50`, and custom sizes up to `100x100`.
- Level selector with current-level display.
- Create New Level, Rename Level, Delete Level, and Clear Level.
- Level reordering by drag within the level selector.
- File menu with Save, Choose Project Folder, and Save As.
- Edit menu with Copy Level and Paste Level.
- Automatic browser persistence plus project-folder JSON saving.
- Separate project JSON, level JSON, and asset registry JSON output.
- Asset import from local image files.
- Single-file and multiple-file asset import.
- User-created asset categories.
- Category sections and imported asset previews in the left asset panel.
- Asset search filtering.
- Delete empty category controls.
- Delete unused imported asset controls.
- A `Clean Empty Categories` action.
- Grid area selection by left-click drag.
- A selected grid range that remains active after mouse release.
- Escape to clear the active selection.
- Hover coordinate display and selected range display.
- Imported asset placement into one grid cell or a selected multi-cell area.
- A Place Selected Asset button that is enabled when an asset and ready grid selection exist.
- Drag/drop of imported assets from a category onto the grid.
- Multi-cell placement as one stretched/fitted asset object, not one repeated asset per cell.
- Delete mode that removes a placed copy by clicking any covered grid cell, including a stretched object.
- Overwrite confirmation before a new placement removes overlapping objects.
- Browser refresh restoration of project data, levels, categories, imported image data, and placed objects.
- No visible default placeholder asset library.

Current limitations:

- This is still an editor only; it does not run player movement, NPC logic, battles, doors, or game integration.
- Palette asset deletion is blocked while that asset is placed on any level. Remove placed copies first.
- A category that contains assets is not deleted automatically; its assets must be removed or reorganised first.

## 5. Important Rules

- Do not re-add default placeholder assets.
- Do not automatically create `Custom Imported Assets`.
- Categories should be user-created only. A legacy populated category may be retained during safe data migration to avoid losing imported assets.
- New imported assets must belong to a real user-created category.
- Do not show Default width or Default height in the import modal.
- Do not show Collision, Solid, Blocks Movement, Transparent, or Visible in the import modal yet.
- Internal compatibility fields for those properties exist, but visible editing belongs to a future Phase 4-style properties feature.
- Do not change the grid coordinate system.
- Do not change save structures or storage keys without a migration path.
- Do not wipe browser storage, categories, assets, levels, or placed objects.
- Do not overwrite project JSON files unless the user chooses Save or Save As.
- Do not implement later phases unless explicitly requested.

## 6. Current File / Folder Structure

Current repository structure:

```text
Game Dev Kit/
  GAME_DEV_KIT_PLAN.md
  Game_Dev_Kit_Current_State.md
  index.html
  dev-server.mjs
  assets/
  src/
    devkit/
      AssetPalette.js
      DevEditor.js
      DevEditorUI.js
      EditorTypes.js
      GridEditor.js
      ImportExportManager.js
      LevelManager.js
      SaveManager.js
    styles/
      editor.css
```

Main implementation responsibilities:

- `index.html`: minimal page entry point loading the editor module and stylesheet.
- `dev-server.mjs`: local static development server, normally at `http://localhost:4173/`.
- `src/devkit/DevEditor.js`: app controller, user events, autosave coordination, import dialog, menus, selection-to-placement workflow, and folder save orchestration.
- `src/devkit/DevEditorUI.js`: editor HTML layout, toolbar, menus, status bar, sidebar and grid host elements.
- `src/devkit/GridEditor.js`: grid headers/cells, selection and drop overlays, asset object rendering, pointer selection, and grid drop target conversion.
- `src/devkit/AssetPalette.js`: category/asset sidebar, search, asset previews, delete controls, and draggable asset rows.
- `src/devkit/LevelManager.js`: project/level data operations, grid references, placed assets, asset registry normalisation, and category/asset mutations.
- `src/devkit/SaveManager.js`: browser persistence and IndexedDB-backed imported image restoration.
- `src/devkit/ImportExportManager.js`: File System Access API folder output and download fallback.
- `src/devkit/EditorTypes.js`: schema, editor, storage, tile, layer and legacy-migration constants.
- `src/styles/editor.css`: full editor, palette, grid overlay and import dialog styling.

Intended project-folder saved output structure:

```text
src/data/game-dev-kit/
  project/
    game-dev-kit-project.json
  levels/
    [level-id].json
  assets/
    assetRegistry.json
    imported/
      [imported image files]
```

The chosen folder must be `src/data/game-dev-kit` for the output to appear in exactly that structure. The editor creates `project`, `levels`, `assets`, and `assets/imported` below whichever folder the user selects.

## 7. Save / Load System

### Browser Storage

Browser persistence is independent of File menu saves. Meaningful edits call autosave and persist the live project for Chrome refresh restoration.

Storage constants currently visible in `EditorTypes.js`:

| Purpose | Storage location / key |
| --- | --- |
| Main saved project state | localStorage: `game-dev-kit-editor-project` |
| Destructive-action backups | localStorage: `game-dev-kit-editor-backups` |
| Copied level clipboard | localStorage: `game-dev-kit-copied-level` |
| Imported image store database | IndexedDB database: `game-dev-kit-assets` |
| Imported image object store | IndexedDB store: `imported-images` |

Imported images are initially read as data URLs for immediate preview and rendering. On browser autosave, imported data URLs are stored in IndexedDB using the asset ID as a stable image key. The localStorage project record stores an `indexeddb:[asset-id]` source marker and `imageStorageKey`; on load, the real data URL is restored from IndexedDB for image display.

If IndexedDB storage fails, the persistence code retains the asset source in project storage as a fallback.

### Startup Loading

On `DOMContentLoaded`, `DevEditor.js` awaits `loadProject()` before constructing the editor:

1. `SaveManager.js` checks localStorage for `game-dev-kit-editor-project`.
2. If saved project data exists, it normalises the data, restores imported image data from IndexedDB, selects the saved `lastOpenedLevelId`, then renders.
3. If there is no saved project data, it creates a new Starter Level project with an empty asset registry.
4. If saved JSON is unreadable, it reports recovery and creates a new Starter Level.

The normal startup path does not create a blank project after a valid saved project has loaded.

### File Menu Saves

- `File > Save`: autosaves browser state and writes to the already selected project folder. On the first folder save, it asks for a folder.
- `File > Choose Project Folder`: always prompts for a writable folder, then saves there.
- `File > Save As`: currently uses the same choose-folder-and-save path as Choose Project Folder.
- If the browser cannot use a directory picker, JSON files are downloaded instead.

Folder save writes:

- `project/game-dev-kit-project.json`: project index and ordered level metadata.
- `levels/[level-filename].json`: each full level with layer arrays and placed asset objects.
- `assets/assetRegistry.json`: categories and imported asset metadata.
- `assets/imported/[file-name]`: imported image file copies when an imported asset currently has a data URL available for writing.

Deleted level filenames are removed from the selected folder during a later successful folder save where possible.

## 8. Level System

- Project state stores ordered levels in `project.levels`.
- `project.lastOpenedLevelId` stores the currently opened level.
- A starter project begins with level ID `starter-level`, name `Starter Level`, filename `starter-level.json`, and a `30x30` grid of `32px` tiles.
- New level IDs are generated by slugifying the entered level name and adding `-2`, `-3`, and so on when needed.
- Level filenames use the level ID plus `.json`, with suffixing to avoid conflicts.
- Selecting a level in the level picker updates `lastOpenedLevelId`, clears active grid selection, autosaves, and rerenders.
- Dragging a level entry reorders the level array and autosaves that order.
- Create New Level creates and immediately selects a new empty level.
- Rename Level changes the current level display name. The existing filename is retained.
- Delete Level requires confirmation, refuses to delete the last remaining level, creates a browser backup, removes the level, and selects a remaining level.
- Clear Level requires confirmation and clears placed content from the current level layers only.
- Copy Level stores full copied level data in localStorage under `game-dev-kit-copied-level`.
- Paste Level pastes copied grid size and content into the current level while preserving that destination level's ID, name, and filename. It warns before replacing existing current-level content.
- Duplicate Level is not exposed in the UI. Copy Level and Paste Level are the supported workflow for copying level content.
- Grid resizing supports presets and a custom width/height, capped at `100`.
- If shrinking a grid would remove any wholly or partly out-of-bounds placed objects, the editor warns first and creates a browser backup before proceeding.

## 9. Grid System

- Grid X coordinates appear as numbers along the top.
- Grid Y coordinates appear as letters along the left.
- The top-left header corner is blank.
- The first editable square is `1.A`.
- Number `1` is above the first editable grid square, not above the row label `A`.
- Letter `A` is beside the first editable row, not inside the editable grid.
- Rows after `Z` use Excel-style labels: `AA`, `AB`, `AC`, and so on.
- The status bar shows a compact hover reference such as `Hover: 12.F`.
- The status bar shows an active selection such as `Selected: 3.B to 8.E`.
- Dragging with the left mouse button across cells creates a rectangular range.
- Releasing the mouse keeps the selected area active in a ready state.
- Pressing Escape clears the selection.
- Changing to Delete mode clears active placement selection and deletes objects rather than extending selection.
- The selected range drives one stretched/fitted asset placement.

Grid implementation notes:

- Coordinate headers occupy separate grid layout regions.
- Editable cells occupy `grid-surface`.
- Placed objects render in an absolutely positioned `asset-overlay-layer` above cells.
- Selection/drop feedback renders in a separate absolute overlay.
- Placed images therefore do not push or move the number or letter headers.

## 10. Asset System

Supported import types:

- PNG
- JPG
- JPEG
- WEBP

Not supported in the current import flow:

- SVG
- GIF
- Video
- Audio

There is no placeholder asset library. Available assets come from user file imports or, in future, compatible JSON entries added by Codex/AI tooling.

The asset palette:

- Displays user-created category sections in the left panel.
- Shows asset thumbnails and names inside each category.
- Filters asset names using the search input.
- Allows an imported asset row to be selected for placement.
- Supplies draggable asset IDs to grid drop handling.

The asset registry contains assets available to place. Individual level JSON files contain asset objects that have been placed onto grids.

## 11. Category System

- Categories are intended to be user-created only.
- The editor does not automatically create `Custom Imported Assets`.
- Safe legacy loading retains an old `Custom Imported Assets` category only if it contains assets or was explicitly created by a user; an empty automatic legacy category is omitted.
- If no categories exist, the left panel says: `No categories yet. Create a category or import assets into a new category.`
- If no categories exist when importing, the disabled category dropdown says: `No available categories`.
- The user must provide a new category name before importing when no existing category is available.
- A new category entered during import takes priority over a dropdown selection.
- Category names are trimmed and matched without case differences to avoid duplicates.
- Empty category names are rejected.
- Categories appear immediately in the left panel after creation.
- Categories persist in browser project state and are written to `assets/assetRegistry.json` during folder save.
- Empty categories can be deleted after confirmation.
- Categories containing assets cannot currently be deleted from the panel; the editor asks the user to remove or move assets first.
- `Clean Empty Categories` removes empty categories only and does not delete assets.
- Category deletion does not delete placed grid assets.

## 12. Import Asset Modal

The current import workflow accepts one or multiple selected image files.

Visible modal controls are:

- Image preview thumbnail(s).
- Editable Asset name field for each selected image.
- One Category dropdown for the import batch.
- One optional New category field for the import batch.
- Cancel.
- Add to Palette.

Fields that must not appear yet:

- Default width.
- Default height.
- Collision.
- Solid.
- Blocks Movement.
- Transparent.
- Visible.

The implementation stores internal compatibility defaults of width `1`, height `1`, layer `objects`, visible `true`, transparent `true`, and collision/solid/blocking `false`, but the user's placed grid range controls rendered placement size.

For one imported file while a grid range is already selected, the editor may offer immediate placement into that range. For multiple imported files, it adds the full batch to the category, selects the first imported asset, and prompts the user to select or drag one asset for placement rather than placing every imported image.

## 13. Placed Asset System

- Single-cell placement creates one `1x1` placed asset object.
- Multi-cell placement creates one placed asset object spanning the selected width and height.
- Selecting ten squares must not create ten objects.
- The placed image fills the selected rectangular grid area using the asset overlay layer.
- Dragging an asset onto an active selected range places one stretched asset over that range.
- Dragging an asset onto an unselected cell places one `1x1` object.
- Placement warns before removing any object overlapping the target rectangle.
- Delete mode removes a placed copy from the current level only. Clicking any covered cell removes the whole stretched object.
- Deleting an imported asset from the palette is separate: it removes registry availability only when that asset is not currently placed on any level.

Example placed asset JSON:

```json
{
  "id": "placed-asset-001",
  "assetId": "asset-id-from-registry",
  "x": 3,
  "y": 2,
  "gridRef": "3.B",
  "rangeRef": "3.B:6.D",
  "width": 4,
  "height": 3,
  "layer": "objects",
  "visible": true
}
```

Current placed entries also include compatibility fields such as `transparent`, `solid`, `blocksMovement`, and `collisionEnabled`, although those fields are not edited in Phase 3 UI.

## 14. Asset Registry Format

`assetRegistry.json` contains schema version, category records, and assets available to place. Current category records may include `isUserCreated` for safe migration and preservation of explicitly user-created names.

Example:

```json
{
  "schemaVersion": 1,
  "categories": [
    {
      "id": "buildings",
      "name": "Buildings"
    }
  ],
  "assets": [
    {
      "id": "asset-house-001",
      "name": "House",
      "categoryId": "buildings",
      "category": "Buildings",
      "src": "data:image/png;base64,...",
      "fileName": "house.png",
      "defaultLayer": "objects",
      "defaultWidth": 1,
      "defaultHeight": 1,
      "isImported": true
    }
  ]
}
```

For browser autosave, an imported asset's stored `src` may be `indexeddb:[asset-id]` with an `imageStorageKey`, because image data is persisted in IndexedDB and restored into a renderable data URL on startup. During folder save, the live registry data is exported and imported source images are written under `assets/imported` when available as data URLs.

## 15. UI Layout

The current editor UI includes:

- Top toolbar containing level controls, grid size controls, Paint, Delete, and Place Selected Asset.
- Level controls for selecting, creating, renaming, deleting, clearing, and drag-reordering levels.
- A File menu for Save, Choose Project Folder, and Save As.
- An Edit menu for Copy Level and Paste Level.
- A left asset panel containing Create Category, Import Asset, Clean Empty Categories, search, category sections, thumbnails, delete controls, and drag sources.
- A status bar containing general feedback, hover/selected coordinate display, and current level/grid summary.
- The main grid area with fixed coordinate headers, editable cells, the placed asset overlay, and selection/drop overlays.

## 16. Known Past Bugs / Regression Warnings

These issues occurred during earlier development and must not return:

- Create New Level previously failed to create and immediately select a new level.
- Save/export controls previously cluttered the interface; the File menu exists to organise them.
- Duplicate Level was removed from the UI because Copy Level and Paste Level cover the needed workflow.
- Grid coordinate labels moved when assets were placed; asset rendering must remain in the overlay, outside header layout flow.
- Grid selection became stuck in continuous drag/highlight behaviour; released selection must remain ready without making every click a new drag.
- Newly created categories did not appear until `Clean Empty Categories` was clicked.
- Imported assets and placed objects did not render until `Clean Empty Categories` was clicked.
- Chrome refresh previously lost imported assets, categories, or placements; browser persistence and IndexedDB restoration must remain intact.
- `Custom Imported Assets` was previously automatically created; it must not be automatically added again.
- Default width/height fields previously appeared in the import modal; they must stay hidden.
- Collision, Solid, Blocks Movement, Transparent, and Visible appeared too early in import UI; they must stay hidden until later explicitly requested work.

## 17. Do Not Change Without Permission

- Do not change storage keys without migration.
- Do not change JSON structures without migration.
- Do not clear browser storage.
- Do not wipe imported assets.
- Do not wipe categories.
- Do not wipe levels.
- Do not wipe placed assets.
- Do not re-add placeholder assets.
- Do not re-add automatic categories.
- Do not remove the File menu or Edit menu.
- Do not remove project-folder saving.
- Do not remove localStorage/IndexedDB persistence.
- Do not implement Phase 4 early.

## 18. Testing Checklist

Before accepting changes to existing editor behaviour, verify:

- [ ] Open the editor in normal Chrome.
- [ ] Create a level and confirm it becomes the selected level.
- [ ] Rename a level.
- [ ] Delete a non-final level and confirm a remaining level becomes active.
- [ ] Clear a level after placing content.
- [ ] Drag-reorder levels and refresh to confirm order persists.
- [ ] Resize a grid larger.
- [ ] Resize a grid smaller when a placed object would be removed and confirm the warning appears.
- [ ] Confirm there is no automatic `Custom Imported Assets` category.
- [ ] Create a category and confirm it appears immediately.
- [ ] Import one PNG/JPG/JPEG/WEBP image into a category.
- [ ] Import multiple supported images into one category.
- [ ] Confirm category counts and asset thumbnails appear immediately.
- [ ] Confirm the import modal does not show default width/height or property fields.
- [ ] Drag-select a grid area and confirm selection remains after release.
- [ ] Confirm Escape clears selection.
- [ ] Place an asset into a selected multi-cell area.
- [ ] Confirm only one stretched/fitted placed object is created.
- [ ] Drag an asset from a category to a single cell.
- [ ] Drag an asset from a category onto an active selected area.
- [ ] Confirm overwrite warning appears when placement overlaps an existing object.
- [ ] Use Delete mode on any covered cell of a stretched asset and confirm the whole placed copy is removed.
- [ ] Attempt to delete a palette asset still used on a level and confirm deletion is blocked.
- [ ] Delete an unused palette asset.
- [ ] Delete an empty category.
- [ ] Save and refresh Chrome; confirm levels, categories, assets and placements persist.
- [ ] Use File > Save with a selected project folder.
- [ ] Confirm `project/game-dev-kit-project.json` is saved.
- [ ] Confirm every `levels/[level-id].json` needed by the project is saved.
- [ ] Confirm `assets/assetRegistry.json` is saved.
- [ ] Confirm imported files are written under `assets/imported` where supported.
- [ ] Confirm Copy Level and Paste Level still work.

## 19. Instructions For Future Codex Sessions

Before making changes:

1. Read `GAME_DEV_KIT_PLAN.md`.
2. Read `Game_Dev_Kit_Current_State.md`.
3. Identify whether the request is a fix, Phase 3 polish, or a future phase.
4. Do not jump ahead to later phases unless explicitly asked.
5. Preserve all documented working behaviour.
6. Make small targeted changes.
7. Update `Game_Dev_Kit_Current_State.md` if behaviour changes.
8. Tell the user exactly what changed and how to test it.
