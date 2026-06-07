# Game Dev Kit Current State

## 1. Project Overview

This project is a reusable browser-based Game Dev Kit / Level Editor. It is currently a standalone browser tool for visually creating and editing level data, rather than a runtime game or a game integration layer.

The editor is intended to remain reusable so it can later sit on top of different game projects and save data those projects can consume.

The Codex built-in browser is supported for normal UI and editor testing, including layout, menus, tools, layer visibility, placed properties, selection, movement, deletion, grid selection, group movement, and placement workflows that use assets already loaded in the editor.

Normal Chrome is the source of truth for file and folder workflows: Choose Project Folder, File > Save, Save As, direct JSON writing, folder picker permissions, importing files from disk, browser file handles, and final persistence checks.

The editor uses browser file and folder functionality, including the File System Access API, which may be unavailable or restricted in the Codex browser. If a file/folder workflow works in Chrome but fails only in the Codex browser because of permissions or unsupported browser APIs, treat that as a Codex browser limitation rather than an app bug. Do not remove Codex browser support for ordinary UI/editor testing.

Even though Chrome remains the supported development test browser for file/folder APIs, normal editor workflows should use Game Dev Kit UI rather than Chrome-native `alert`, `confirm`, or `prompt` dialogs. This keeps the editor suitable for later `.exe` or WebView packaging.

## 2. Relationship To `GAME_DEV_KIT_PLAN.md`

The existing roadmap file in this repository is [`GAME_DEV_KIT_PLAN.md`](./GAME_DEV_KIT_PLAN.md). It defines the long-term roadmap and phase plan.

This file, `Game_Dev_Kit_Current_State.md`, is the current-state reference. It describes behaviour that exists now, the present implementation shape, and the features future changes must preserve.

Future Codex sessions should read both files before making changes:

1. Read `GAME_DEV_KIT_PLAN.md` for intent and phase boundaries.
2. Read `Game_Dev_Kit_Current_State.md` for existing behaviour and regression constraints.

Update this current-state file whenever working behaviour changes.

## 3. Current Phase Status

- Current working branch: `codex/phase-6-area-tools`.
- The project has begun Phase 4 with a focused placed-asset properties implementation.
- Phase 1 and Phase 2 functionality is working.
- Phase 3 has a solid asset import, categorisation, grid selection, and placement base and is being polished.
- Phase 4 basic placed asset properties are tested and working for placed instance inspection, editing, browser persistence, Chrome refresh restoration, folder save output, placed-asset copy, and Copy Level / Paste Level preservation.
- Phase 4 currently adds placed instance inspection and editing only; full trigger gameplay behaviour and gameplay collision runtime are not implemented.
- Phase 5A has started with placed-asset layer metadata inside Placed Asset Properties only; full Phase 5 layer controls are not implemented yet.
- Phase 5B layer assignment integrity is working: applying a layer change relocates the selected placed asset into the matching known `level.layers` array while preserving the same object data.
- Phase 5C editor-only layer visibility is working through the top `View` menu. Visibility is an editor preference and does not remove or alter saved placed assets.
- Phase 5D editor-only layer locking is working through the top `View` menu. Locked layers protect placed assets from editor mutations without changing saved level data.
- The focused Phase 5D follow-up adds per-instance `editorLocked` state in Placed Asset Properties and tidies View with nested visibility and locking flyouts.
- Phase 5 is complete for the current editor-only layer scope and is merged into `main`.
- Phase 6A multi-object copy/paste is implemented on the Phase 6 branch.
- Phase 6B multi-object cut/paste and duplicate are implemented on the Phase 6 branch.
- Phase 6C Fill Selected Area and Clear Selected Area are implemented on the Phase 6 branch.
- Phase 6D Replace Matching Assets Inside Selected Area is implemented on the Phase 6 branch.

## 4. Current Working Features

The editor currently supports:

- A standalone browser editor served locally by `dev-server.mjs`.
- Grid display and fixed coordinate headers.
- Grid size selection for `10x10`, `20x20`, `30x30`, `40x40`, `50x50`, `75x75`, `100x100`, `150x150`, `200x200`, and custom sizes up to `500x500`.
- Level selector with current-level display.
- Create New Level, Rename Level, Delete Level, and Clear Level.
- Delete Level is working: it confirms first, removes only the selected level from the project, selects another level, rerenders the grid/level selector, and persists to browser storage.
- Level reordering by drag within the level selector.
- File menu with Choose Project Folder, Save, and Save As.
- Edit menu with Copy Level and Paste Level.
- Top editor menu order is `File`, `Edit`, `View`, `Asset`.
- The `View` menu contains compact `Layer Visibility` and `Layer Locking` flyouts for all ten known layers, plus `Show All Layers` and `Unlock All Layers and Assets`.
- Asset menu is enabled only for one visible placed asset selected in Select/Move mode.
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
- Select/Move is the main editing tool for selecting placed assets, moving/resizing placed assets, selecting grid areas, multi-selecting placed assets, and placing imported assets.
- In Select/Move mode, `Ctrl+C` starts a floating copied-object placement for the selected placed asset.
- With multiple eligible assets selected, `Ctrl+C` creates a transient copied group and previews every member while preserving relative spacing.
- `Ctrl+X` starts a transient orange cut placement for one or more visible, layer-unlocked, individually unlocked selected assets. Source assets remain unchanged until a successful paste commits the move atomically.
- `Ctrl+D` duplicates one or more eligible selected assets at a nearby clamped grid offset and selects the new copies.
- The Edit menu keeps Copy Level / Paste Level separate from Copy Selected Assets, Cut Selected Assets, and Duplicate Selected Assets.
- Edit > Fill Selected Area creates one separate `1x1` placed object in every cell of the active grid selection.
- Edit > Clear Selected Area removes visible, unlocked placed grid copies intersecting the active grid selection without deleting palette assets, categories, or registry entries.
- Edit > Replace Matching Assets uses the active grid selection, an app-owned source-choice modal, and the currently selected palette asset to replace only matching placed-object `assetId` values.
- Tool hotkeys: `Q` for Select/Move, `W` for Select/Move compatibility, and `E` for Delete outside text-entry/modal contexts.
- Eight resize handles on an asset selected in Select/Move mode.
- Delete and Backspace remove the currently selected placed object or selected placed-object group in Select/Move mode when focus is not in editable UI.
- Delete and Backspace bulk delete placed assets intersecting the selected grid area immediately when no placed asset is selected.
- The separate Paint toolbar button has been removed; placement now happens through Select/Move grid selections or asset drag/drop.
- A compact Placed Asset Properties modal opened with `Asset > Properties`, `Edit > Properties`, or by double-clicking a placed asset in Select/Move mode.
- Placed instance properties for Grid Ref, Width/Height, Visible, Opacity, Layer, Blocks Movement, Notes, and layer-specific metadata stored under `layerOptions`.
- Phase 4 basic placed asset property edits have been tested as working, including Chrome refresh persistence and File > Save level JSON output.
- Identity / Info shows the source asset name and category only; internal placed/source IDs are kept in saved data but hidden from normal editing UI.
- A movable and resizable Placed Asset Properties modal whose last panel bounds persist as a browser UI preference.
- Placed Asset Properties keeps Cancel / Close and Apply / Save Changes in a persistent footer while the property fields scroll inside the panel.
- A dedicated grid viewport with its own accessible horizontal and vertical scrolling for large maps.
- A horizontally resizable left asset/category panel whose width persists in the browser.
- Left asset/category panel resizing is requestAnimationFrame-throttled while dragging and writes the final width preference only after pointer release.
- A minimisable left asset/category panel; when collapsed, only a restore button remains, the grid uses the freed space, and restoring returns the previous expanded width.
- Drag/drop of imported assets from a category onto the grid.
- Multi-cell placement as one stretched/fitted asset object, not one repeated asset per cell.
- Delete mode that immediately removes a placed copy by clicking any covered grid cell, including a stretched object.
- Delete mode supports click-and-drag area deletion for placed grid assets.
- Grid drag selection and delete-area highlighting use a single live overlay rectangle and requestAnimationFrame-throttled pointer updates for smoother large-grid performance.
- Placed asset move, group move, and resize previews are requestAnimationFrame-throttled during dragging and commit level data once on release.
- Select/Move supports multi-selecting placed assets by dragging a grid area across them.
- Multi-selected placed assets can be moved together as a snapped group while preserving relative spacing.
- Every selected asset in a multi-selection uses a yellow outline; the primary selection may use a stronger yellow accent, but secondary selections do not use blue.
- Overwrite confirmation before a new placement removes overlapping objects.
- Browser-native alert/confirm/prompt dialogs have been replaced with in-app Game Dev Kit modals so the editor can later be packaged in an `.exe` or WebView shell without depending on Chrome-native dialog behaviour.
- In-app modals are used for Create New Level, Rename Level, Delete Level, Clear Level, Create Category, Delete Category, Delete Palette Asset, grid resize warnings, paste warnings, placement overwrite warnings, and other editor warnings that previously used browser-native dialogs.
- Placed Asset Properties includes a Layer / Behaviour section with `terrain`, `decorations`, `objects`, `collisions`, `spawns`, `items`, `npcs`, `enemies`, `triggers`, and `overlay`.
- The selected layer controls only the selected placed asset and its `layerOptions` metadata. There is no standalone sidebar Layer Panel or active placement layer.
- Hidden editor layers keep their placed assets in saved data but hide their markers and exclude them from selection, movement, resizing, Properties, copy, and deletion.
- Locked editor layers remain visible when visibility is on, but their placed assets are excluded from selection, movement, resizing, Properties, copy, group movement, deletion, and overlap replacement.
- Individually locked placed assets remain visible and saved, cannot be selected, moved, resized, copied, group-moved, deleted, or replaced, and can be double-clicked to open Properties for unlocking in Chrome and the Codex in-app browser.
- Browser refresh restoration of project data, levels, categories, imported image data, and placed objects.
- No visible default placeholder asset library.

Current limitations:

- This is still an editor only; it does not run player movement, NPC logic, battles, doors, or game integration.
- Full Phase 5 layer behaviour is not implemented yet. Solo layer, layer reordering, active placement layers, and runtime visibility are not implemented yet.
- Later Phase 6 tools remain unimplemented: drag painting, paint brushes, brush sizes, replace-by-category/layer/all-levels, and `Ctrl+A`.
- Play Mode, runtime collision, trigger execution, doors/exits, spawn runtime, NPC/enemy/item gameplay systems, chunked maps, animated character import, audio/music systems, and multilayer/parallax background tools are not implemented yet.
- Palette asset deletion is blocked while that asset is placed on any level. Remove placed copies first.
- A category that contains assets is not deleted automatically; its assets must be removed or reorganised first.

## 5. Important Rules

- Do not re-add default placeholder assets.
- Do not automatically create `Custom Imported Assets`.
- Categories should be user-created only. A legacy populated category may be retained during safe data migration to avoid losing imported assets.
- New imported assets must belong to a real user-created category.
- Do not show Default width or Default height in the import modal.
- Do not show Collision, Solid, Blocks Movement, Transparent, or Visible in the import modal yet.
- The import modal still does not expose instance fields; Phase 4 editing applies only to placed grid assets.
- Do not change the grid coordinate system.
- Do not break Select/Move or Delete tool behaviour or their `Q`, `W`, and `E` hotkeys.
- Do not change save structures or storage keys without a migration path.
- Do not wipe browser storage, categories, assets, levels, or placed objects.
- Do not overwrite project JSON files unless the user chooses Save or Save As.
- Do not implement later phases unless explicitly requested.
- Do not reintroduce browser-native `alert`, `confirm`, or `prompt` workflows for editor actions. Use app-owned Game Dev Kit modals instead.
- Editor hotkeys must remain disabled while modal dialogs are open.

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
| Left asset panel width preference | localStorage: `game-dev-kit-sidebar-width` |
| Left asset panel collapsed preference | localStorage: `game-dev-kit-sidebar-collapsed` |
| Placed Asset Properties panel bounds preference | localStorage: `game-dev-kit-properties-dialog-bounds` |
| Editor-only known-layer visibility | localStorage: `game-dev-kit-layer-visibility` |
| Editor-only known-layer locks | localStorage: `game-dev-kit-layer-locks` |
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

Deleting a level removes it from browser project state and from the active project index on a later File save. Existing physical level JSON files are retained on disk; the editor does not silently delete them during Save.

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
- Create New Level and Rename Level use in-app prompt modals. Empty names are rejected and cancelling leaves the current project unchanged.
- Delete Level uses an in-app confirmation modal, refuses to delete the final remaining level, attempts a browser backup without blocking deletion if backup storage fails, removes only the selected level from project state, and selects the next level when available or the previous level otherwise.
- Delete Level updates `lastOpenedLevelId`, refreshes the level picker/grid, clears selected placed assets/properties for the deleted level, and saves the updated browser state immediately.
- Clear Level uses an in-app confirmation modal and clears placed content from the current level layers only after confirmation.
- Copy Level stores full copied level data in localStorage under `game-dev-kit-copied-level`.
- Paste Level pastes copied grid size and content into the current level while preserving that destination level's ID, name, and filename. It uses an in-app warning modal before replacing existing current-level content.
- Duplicate Level is not exposed in the UI. Copy Level and Paste Level are the supported workflow for copying level content.
- Grid resizing supports presets and a custom width/height, capped at `500`.
- Grid sizes larger than `100x100` show an in-app large-grid performance warning before resizing.
- Grid sizes larger than `250x250` show a stronger in-app warning about scrolling, saving, and future Play Mode performance before resizing.
- Grid sizes above `500x500` are blocked with an in-app message. Massive worlds such as `1000x1000` should not be one giant level grid yet.
- Future very large worlds should use chunked or region-based maps, such as editable `50x50` or `100x100` chunks that can load nearby regions for seamless Play Mode while keeping editor scrolling, collision, triggers, and asset rendering manageable.
- A `1000x1000` world should still be treated carefully and should not be built as one giant editor level grid until chunked or region-based maps are designed.
- If shrinking a grid would remove any wholly or partly out-of-bounds placed objects, the editor warns first with an in-app modal and creates a browser backup before proceeding.

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
- Dragging with the left mouse button across the grid surface creates a rectangular range.
- Drag selection is rendered as one live overlay rectangle rather than by updating individual grid cells.
- During drag, the live selection overlay updates through a requestAnimationFrame-throttled path so pointer movement does not trigger full grid rerenders or per-cell style changes.
- Releasing the mouse keeps the selected area active in a ready state.
- Final selected range calculation, placed-asset intersection, and delete-area deletion happen on pointer release.
- Pressing Escape clears the selection.
- Changing to Delete mode clears active placement selection and deletes objects rather than extending selection.
- Select/Move owns grid-area selection on empty cells; mouse down on a placed asset selects/moves that placed asset instead.
- The selected range drives one stretched/fitted asset placement.
- The selected range can also drive bulk deletion: with no placed asset selected, Delete or Backspace immediately deletes all placed assets intersecting the selected range.
- When a Select/Move selection range intersects placed assets, those placed assets become selected/highlighted for group operations.
- Select/Move drag selection is calculated from grid-surface coordinates so the selection rectangle draws continuously above placed assets and selects any placed asset it intersects.
- Select/Move drag selection remains visible in real time while dragging, but selected placed-asset borders are updated only after the final range is released.
- Selected placed-asset borders remain visible during single and group movement; when group dragging begins, the grid-area selection rectangle clears.
- The grid viewport owns its scrollbars, so horizontal scrolling is available at the bottom of the visible grid panel instead of only after scrolling the browser page to the bottom.

Grid implementation notes:

- Coordinate headers occupy separate grid layout regions.
- The editable grid background occupies `grid-surface` and is drawn by one lightweight `editor-grid-cells` background layer, not one DOM element per tile.
- The grid background uses CSS repeating grid lines sized from `--tile-size`, so `30x30`, `50x50`, and larger supported grids avoid creating hundreds or thousands of individual cell elements.
- The old per-cell DOM/button grid has been replaced with a lightweight grid background approach. Large empty grids are much smoother, and `50x50`, `100x100`, and larger supported grids perform better than the old button-per-cell model.
- Hit testing no longer depends on per-cell buttons. Pointer, hover, drop, selection, placement, delete, move, and resize coordinates are calculated from the grid surface bounding rectangle and tile size.
- A single hover overlay provides the visible current-cell outline.
- Placed objects render in an absolutely positioned `asset-overlay-layer` above the grid background.
- Selection/drop feedback renders in a separate absolute overlay.
- The Select/Move selection rectangle sits above the placed asset overlay and is not interrupted by placed assets under the pointer.
- The selection overlay is one absolutely positioned rectangle whose left/top/width/height are updated from the latest pointer cell once per animation frame when needed.
- Selection overlays remain live and visible during drag without rebuilding the whole grid.
- Placed images therefore do not push or move the number or letter headers.
- Row and column headers remain aligned using sticky header regions inside the scrolling grid viewport.
- The top-left alignment spacer is hidden and non-interactive; it must not paint over row labels while the grid scrolls.
- Axis bands sit flush against the scrollable grid viewport and directly beside/above the editable cell surface.
- Pointer/drop coordinate calculations continue to use the scrolled grid surface bounds, so asset placement, movement, and resizing remain mapped to grid cells after scrolling.
- Selection and delete-area pointer calculations use the grid surface bounding rectangle and tile size, so the internal grid viewport scroll position is naturally accounted for after horizontal or vertical scrolling.
- Resizing the asset panel changes available viewport width only; grid coordinate calculations remain based on the grid surface and tile size.
- Grid coordinate headers remain aligned with cells while scrolling, placing, moving, resizing, deleting, and collapsing/restoring the left asset panel.
- Grid-size changes still rebuild headers, overlays, the lightweight grid background, and placed assets once for the new dimensions, then save once after the resize action completes.
- Autosave/localStorage writes are avoided during pointer-move drag loops. Drag operations update visual previews live and save only after a completed action such as move, resize, grid resize, delete, placement, or panel resize.

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
- Create Category uses an in-app prompt modal. Duplicate category names are rejected with an in-app message modal.
- Categories appear immediately in the left panel after creation.
- Categories persist in browser project state and are written to `assets/assetRegistry.json` during folder save.
- Empty categories can be deleted after in-app confirmation.
- Categories containing assets cannot currently be deleted from the panel; the editor uses an in-app message modal asking the user to remove or move assets first.
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
- Placement uses an in-app warning modal before removing any object overlapping the target rectangle.
- Select/Move mode selects one placed object without changing its registry asset, lets it be dragged to a snapped grid position, and lets its eight handles resize it within grid bounds.
- Select/Move mode can select multiple placed objects by dragging a grid range that intersects them.
- The Select/Move selection rectangle draws above placed assets and uses rectangle intersection, so stretched assets are selected when any part intersects the drag area.
- Dragging any asset in a multi-selected group moves the whole group together, clamps the group inside the grid, and preserves each asset's width, height, source asset, and relative offset.
- Single placed asset move/resize previews update only the selected marker during pointer movement, then commit `x`, `y`, `width`, `height`, `gridRef`, and `rangeRef` once on release.
- Group move previews cache selected markers and update the selected group together during pointer movement, then commit all moved object bounds once on release.
- When group dragging begins, the original grid-area selection rectangle is cleared while the selected asset borders remain visible.
- Group move updates each moved asset's `x`, `y`, `gridRef`, and `rangeRef` in the current level only.
- Group resize is not implemented; resize handles are shown only when a single placed asset is selected.
- Moving or resizing updates only that current-level object's `x`, `y`, `width`, `height`, `gridRef`, and `rangeRef`; its `id` and `assetId` remain stable.
- Placed Asset Properties opens from `Asset > Properties`, `Edit > Properties`, and double-clicking a placed asset in Select/Move mode for a single selected placed asset.
- Placed Asset Properties shows Source asset name, Category name, Grid Ref, Width, Height, Visible, Opacity, Layer, Blocks Movement, Notes, and a conditional layer-specific metadata section.
- Placed Asset Properties includes a per-instance Locked field stored as `editorLocked`. It changes only the placed copy and never the source palette asset or `assetRegistry.json`.
- Placed Asset Properties hides Placed Asset ID, Source Asset ID, X, and Y from the user-facing panel while keeping `id`, `assetId`, `x`, and `y` stored internally.
- Placed Asset Properties uses `Grid Ref` as its user-facing position field. `x` and `y` remain stored internally and are recalculated from the submitted Grid Ref; `rangeRef` is recalculated after position or size edits.
- Tested property behavior: Grid Ref changes move the asset correctly, Width/Height changes resize the asset correctly, Visible toggles display, Opacity changes display transparency, Layer saves, Blocks Movement saves, and Notes save.
- Layer-specific metadata is saved on the placed asset under `layerOptions` and unknown/custom fields are preserved.
- Applying a layer change moves the original placed asset object into the matching known `level.layers` array, writes the same canonical lowercase layer name, and ensures that selected asset ID exists only once across known layer arrays.
- A layer-only Properties change does not run overlap replacement or remove overlapping placed assets; overlap handling remains limited to actual position or size changes.
- Missing or invalid submitted layer names fall back to the selected asset's current known containing array. Legacy `Trigger` is normalised to `triggers` only when that selected asset is updated.
- Phase 5B does not run broad load-time layer relocation. Unknown layer arrays and their contents remain untouched.
- The top menu order is `File`, `Edit`, `View`, `Asset`. `View > Layer Visibility` provides checkboxes for `terrain`, `decorations`, `objects`, `collisions`, `spawns`, `items`, `npcs`, `enemies`, `triggers`, and `overlay`, plus `Show All Layers`.
- Layer visibility is stored only as the browser-wide editor preference `game-dev-kit-layer-visibility`. It is not stored in project state, level JSON, copied levels, folder exports, or backups, and changing visibility does not trigger project autosave.
- Missing, malformed, or newly introduced known-layer preference values default to visible.
- Hiding a layer updates existing placed-marker visibility without rebuilding the grid, coordinate headers, or placed-marker collection.
- Hidden-layer assets remain unchanged in their original `level.layers` arrays and remain included in browser persistence, File saves, placed-asset copies, Copy Level / Paste Level, placement overlap checks, and overwrite handling.
- Hidden-layer assets are excluded from Select/Move clicking, drag selection, group movement/resizing, Properties, Delete click/drag/keyboard deletion, and copied placement source selection.
- Hiding a layer clears selected assets from that layer and cancels copied placement when its source asset belongs to the newly hidden layer. Visible-layer selections are retained where possible.
- Moving an asset into a hidden layer through Properties still applies and autosaves through the Phase 5B relocation path, then clears its selection and hides its marker.
- Overlap warnings explicitly report when hidden-layer assets are included in the overlap or replacement operation.
- `View > Layer Visibility` and `View > Layer Locking` are nested side flyouts. Hovering or clicking opens one flyout at a time, checkbox changes keep View usable, and flyouts shift left when needed to stay inside the viewport.
- The top-level View commands are `Show All Layers` and `Unlock All Layers and Assets`.
- Layer locks are stored only in `game-dev-kit-layer-locks`; missing, malformed, and newly introduced known-layer values default to unlocked. Lock changes do not trigger project autosave.
- Locked-layer markers remain visible when their visibility checkbox is on, with a lightweight locked cursor, but cannot be selected, moved, resized, copied, opened in Properties, included in group selection/movement, or deleted through click, drag-area, Delete, or Backspace.
- Locking a layer clears selected assets from that layer, closes their Properties panel if open, and cancels copied placement sourced from that layer.
- Placement, copied placement, Properties bounds changes, single move/resize, and group move are blocked before mutation when their destination overlaps any locked-layer asset. Locked assets are never passed into replacement removal.
- Hidden and locked are independent editor states. `Show All Layers` changes visibility only. `Unlock All Layers and Assets` clears every layer lock preference and every placed asset `editorLocked` value across all project levels, then autosaves once.
- Layer lock state is not written to project JSON, level JSON, copied levels, backups, folder exports, or `assetRegistry.json`. Locked placed assets remain fully preserved in all of those data paths.
- Individual `editorLocked` state is part of placed level data, survives browser refresh and File saves, and is preserved by Copy Level / Paste Level, placed-object cloning, and unknown-field-preserving save paths.
- Layer locks and individual asset locks are cumulative: either one protects the asset. Layer lock status takes priority in blocked-action messages.
- Individually locked assets cannot enter normal selection, but double-clicking one opens its Properties panel without selecting it so Locked can be changed back to No. A guarded pointer-timing fallback supports environments where native `dblclick` delivery is inconsistent and prevents duplicate panels when both paths fire. The normal locked-click status message waits until the double-click window expires so it cannot shift the grid between clicks.
- The first pointer click outside an open View menu/flyout is captured and consumed to close the menu. That same click does not reach grid selection, movement, deletion, or placement handlers underneath.
- Tested persistence behavior: property changes persist after Chrome refresh, File > Save writes updated placed asset properties to level JSON, `Ctrl+C` copied placed assets preserve properties, and Copy Level / Paste Level preserves properties.
- Identity / Info shows Source asset name and Category name only. It deliberately hides internal `id` and `assetId` values while keeping them on placed asset data for saving and loading.
- Placed Asset Properties updates the current-level object only and preserves unknown/custom fields.
- The properties modal exposes `visible`, `opacity`, `layer`, `blocksMovement`, `editorLocked`, `notes`, and layer-specific `layerOptions`; Collision/Solid/Walkable are not separate UI fields.
- The properties modal can be dragged by its header and resized from its bottom-right corner; its position and size are kept in browser UI preferences rather than level JSON.
- Hidden or zero-opacity placed assets render as faint editor-only markers so they can remain selected and edited.
- Layer is a per-instance choice with the existing layer names: `terrain`, `decorations`, `objects`, `collisions`, `spawns`, `items`, `npcs`, `enemies`, `triggers`, and `overlay`.
- Layer-specific sections are metadata only: terrain tag, decorative-only flag, object note/type, collision type/note, spawn name/direction, item ID/quantity, NPC name/dialogue ID, enemy type/spawn chance, trigger type/targets, and overlay render/note fields.
- Terrain, decoration, object, collision, spawn, item, NPC, enemy, trigger, and overlay options are editor data only for now. They do not implement runtime collision, spawning, pickup behaviour, NPC runtime, enemy runtime, trigger/door/exit behaviour, or runtime draw-order/player layering yet.
- Full trigger actions, runtime collision, spawn behaviour, item pickup behaviour, NPC logic, enemy logic, Play Mode, and solo/runtime layer controls remain future work.
- There is no standalone Layer Panel or active placement layer yet; layer changes happen only through the selected placed asset's Properties dialog.
- A temporary left-sidebar Layer Panel was tested during Phase 5A and worked as UI state, but the chosen direction is not to keep layers as a permanent left-sidebar panel.
- Moving or resizing into another object's rectangle warns first with an in-app modal, then uses the existing replacement policy if confirmed.
- In Select/Move mode, `Ctrl+C` with one selected placed object keeps the existing single-copy workflow.
- With multiple selected placed assets, `Ctrl+C` copies only visible, layer-unlocked, individually unlocked members into a transient in-memory group clipboard. The status reports how many selected assets were copied; if none are eligible it reports `No unlocked visible assets selected to copy.`
- Group copy preserves each member's relative offset, dimensions, layer, display/behaviour properties, `layerOptions`, and unknown fields.
- The floating group preview uses one cached lightweight preview element per copied asset. Pointer movement is requestAnimationFrame-throttled and only repositions the preview container; it does not mutate project data, rebuild grid cells/headers/placed markers, or autosave.
- Copied placement uses the group's top-left bounding cell as its anchor and clamps the complete group inside the level.
- A successful group paste creates new unique IDs, recalculates each member's `gridRef` and `rangeRef`, ends copy mode, selects the pasted group with the normal yellow multi-selection borders, renders once, and autosaves once.
- Hidden destination assets remain part of overlap detection and are identified in the app-owned warning. A locked-layer or individually locked destination overlap blocks the complete paste. Confirmed editable overlaps are removed once before the whole copied group is inserted; partial paste is not allowed.
- The floating copy preview is not persisted and is cancelled with Escape or by switching away from Select/Move mode.
- `Ctrl+X` uses the same transient group bounds and cached preview system with an orange outline. Hidden, layer-locked, and individually locked selected assets are skipped; if none are eligible the editor reports `No unlocked visible assets selected to cut.`
- Cut preview does not remove or mutate source assets. Escape, a blocked destination, or a cancelled overlap warning leaves the original objects in place. A successful same-level cut removes the source objects and inserts the moved group atomically while preserving the original placed-object IDs, relative spacing, layers, metadata, `layerOptions`, and unknown fields.
- `Ctrl+D` and Edit > Duplicate Selected Assets duplicate eligible selected assets one cell right and down where bounds allow, otherwise using a nearby clamped offset. Duplicates receive new IDs, preserve metadata and unknown fields, become the active yellow selection, render once, and autosave once.
- Cut and duplicate ignore their own selected source objects during destination overlap checks. Other hidden destination assets remain included in warnings, locked destinations block the entire operation, and confirmed editable overlaps are replaced atomically.
- Cut/copy clipboard state remains transient editor memory only. No storage keys, schema versions, project JSON, level JSON, or asset registry structures are changed.
- Fill Selected Area is separate from normal stretched placement: normal selected-range placement creates one fitted object, while Fill creates a new unique `1x1` placed object for every selected cell with its own `gridRef` and `rangeRef`.
- Fill checks all known-layer overlaps before mutation, including hidden assets. Any locked-layer or individually locked overlap blocks the complete fill. Editable overlaps use one app-owned replacement confirmation and are removed only when the complete fill data is ready to commit.
- Fills larger than 500 cells use an app-owned performance warning before creating the placed objects.
- Clear Selected Area removes only visible, unlocked placed copies intersecting the active range. Hidden, locked-layer, and individually locked objects are retained and reported as skipped. The active grid selection remains available after Fill and Clear.
- Fill and Clear update the placed-asset overlay once, keep grid cells and coordinate headers intact, render no pointer-movement work, and autosave once after a completed operation.
- Fill and Clear never mutate imported palette assets, categories, asset registry entries, other levels, unknown layer arrays, schema versions, or storage keys.
- Replace Matching Assets uses Edit > Replace Matching Assets, requires an active selected grid area and a selected replacement palette asset, and opens an app-owned modal listing unique visible/unlocked source `assetId` types found in the selected area. The default source is the most common eligible source asset in the range.
- Replace Matching Assets matches by placed-object `assetId` only. It does not replace by name, category, layer, size, or visual similarity.
- Replace Matching Assets updates only `assetId`, `type`, and `name` to the selected replacement palette asset. It preserves each replaced placed object's ID, position, dimensions, `gridRef`, `rangeRef`, layer, visibility/opacity/blocking fields, notes, `editorLocked`, `layerOptions`, and unknown/custom fields.
- Replace Matching Assets skips hidden-layer, locked-layer, and individually locked matches and reports the skipped counts. Non-matching placed assets and unknown layer arrays are untouched.
- Replace Matching Assets confirms once with an app-owned modal before mutation, refreshes only placed markers after the data change, and autosaves once after a completed replacement.
- Drag painting, paint brushes, brush sizes, undo/redo, persistent/cross-level placed-object clipboard, replace-by-category/layer/all-levels, and later Phase 6 tools are not implemented yet.
- In Select/Move mode, Delete or Backspace removes the selected placed copy from the current level only, clears its selection, and does not ask for confirmation.
- In Select/Move mode, Delete or Backspace removes all multi-selected placed copies from the current level only when a group is selected.
- In Select/Move mode, if no placed copy is selected but a grid area is selected, Delete or Backspace immediately deletes every current-level placed copy that intersects that area.
- Asset menu Properties and Edit menu Properties open the same placed-asset properties panel for a single selected placed asset only; multi-asset properties are not implemented.
- Delete mode removes placed copies from the current level only without confirmation. Clicking any covered cell removes the whole stretched object.
- Delete mode click-and-drag shows the selected delete area and immediately removes every current-level placed copy intersecting that area on mouse release.
- Delete mode drag-delete remains unchanged by Select/Move multi-selection behaviour.
- Deleting an imported asset from the palette is separate: it uses an in-app confirmation modal and removes registry availability only when that asset is not currently placed on any level.
- Placed grid asset deletion still has no confirmation and remains immediate. This includes Delete mode click delete, Delete mode drag-area delete, and Delete/Backspace deletion of selected placed grid assets.

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

- Top toolbar containing level controls, grid size controls, Select/Move, Delete, and Place Selected Asset, with `Q` and `E` shortcut hints in tooltips.
- Level controls for selecting, creating, renaming, deleting, clearing, and drag-reordering levels.
- A File menu for Choose Project Folder, Save, and Save As.
- An Edit menu for Copy Level, Paste Level, and Properties for the selected placed asset.
- A compact View menu with nested Layer Visibility and Layer Locking side flyouts, Show All Layers, and Unlock All Layers and Assets.
- An Asset menu for Properties that is inactive until a placed asset is selected with Select/Move.
- Reusable in-app Game Dev Kit modals for message, confirmation, and text-input workflows. These replace browser-native `alert`, `confirm`, and `prompt` UI for normal editor actions.
- A movable/resizable Placed Asset Properties modal; Grid Ref is the visible position editor while X/Y remain internal data, and layer-specific metadata is edited in the same modal.
- A left asset panel containing Create Category, Import Asset, Clean Empty Categories, search, category sections, thumbnails, delete controls, and drag sources; its divider can be dragged horizontally and the width persists after refresh.
- The left asset panel has a collapse/restore button. Collapsed state persists in browser UI preferences, restoring returns the previous expanded width, and this does not affect project, level, or asset registry JSON.
- Dragging the left asset panel divider updates the panel width live through a throttled visual path and saves the final width to browser preferences only after release.
- A status bar containing general feedback, hover/selected coordinate display, and current level/grid summary.
- There is no standalone sidebar Layer Panel in the current editor. Layer selection lives inside the selected placed asset's Properties modal.
- The main grid viewport with its own scrollbars, sticky coordinate headers, lightweight CSS grid background, the placed asset overlay, and selection/drop overlays.
- While any app-owned modal is open, editor hotkeys such as `Q`, `E`, Delete, and Backspace do not trigger grid tools or placed-asset deletion.

## Rendering, Performance and App-Owned UI Rules

Future Codex sessions must treat this section as a standing rule for all current and future editor work.

### Rendering / Performance Rules

All current and future editor features must follow these rendering rules:

1. Do not re-render the whole grid unless absolutely necessary.
2. Do not rebuild all grid cells during mousemove, drag, resize, move, selection, or panel resizing.
3. During drag operations, update lightweight visual previews only.
4. Commit actual data changes once on mouseup/release.
5. Do not save to localStorage on every mousemove.
6. Use requestAnimationFrame or throttling for high-frequency mouse updates where needed.
7. Keep grid cells, coordinate headers, asset overlay, selection overlay, and move/resize overlays separated.
8. Coordinate headers must remain aligned with the grid.
9. Placed assets must not push, move, or resize coordinate headers.
10. Selection overlays must render above assets where needed.
11. Moving/resizing assets must remain aligned after scrolling.
12. Mouse coordinate calculations must account for:
    - grid viewport position
    - scrollLeft
    - scrollTop
    - tile size
    - header offsets
13. The grid viewport should remain self-contained with its own scrollbars.
14. Avoid using full browser page scrolling as the main way to navigate the grid.
15. Large grids such as `50x50`, `100x100`, and `200x200` should remain usable.
16. The grid background should stay lightweight and should not return to thousands of per-cell DOM elements unless there is a clear, user-approved reason.
17. Very large worlds such as `1000x1000` should be deferred until chunked or region-based maps are designed and explicitly requested.

### App-Owned UI Rules

All current and future editor workflows must use Game Dev Kit in-app UI.

Do not rely on browser-native dialogs such as:

- `window.alert()`
- `window.confirm()`
- `window.prompt()`

Do not rely on Chrome-native popup behaviour.

Reason: the editor may later be packaged as a desktop `.exe`, Electron app, Tauri app, WebView app, or other wrapper. The app should feel self-contained and not depend on Chrome prompt/confirm/alert UI.

All future confirmations, prompts and messages should use internal Game Dev Kit modals, including:

- create level
- rename level
- delete level
- clear level
- create category
- delete category
- delete imported palette asset
- grid resize warnings
- paste/overwrite warnings
- future layer warnings
- future trigger warnings
- future import/export warnings

Placed grid asset deletion is the exception:

- deleting placed grid copies remains immediate with no confirmation.

### Future Feature Rules

When adding future features, Codex must preserve these rules:

1. New tools must not cause full-grid re-rendering during drag.
2. New panels must not block grid mouse events unless intentionally modal.
3. New modals must disable editor hotkeys while typing.
4. New layers must not break asset overlay alignment.
5. New playable assets must not force the editor grid to re-render every frame.
6. Play Mode should hide editor overlays and run separately from editor selection/rendering systems.
7. Animated assets should update only their own visual elements, not the whole grid.
8. Audio features must not affect grid rendering performance.
9. Background layers must be rendered efficiently and must not disturb grid coordinate layout.
10. Any new data structure changes must preserve existing saved projects and include migration if needed.

### Do-Not-Break Baseline

Future Codex sessions must treat this section as a standing rule.

Before making any code changes, Codex should:

1. Read this file.
2. Check this Rendering, Performance and App-Owned UI section.
3. Preserve these rules unless the user explicitly says otherwise.
4. If a requested change conflicts with these rules, explain the conflict before coding.

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
- The placed-asset properties modal must remain instance-scoped; it must not edit source palette assets or expand into later gameplay systems.
- The sticky top-left header spacer must remain visually hidden and must not obscure the left letter axis while scrolling.
- Select/Move multi-selection previously stopped when dragging across placed assets; selection must continue using grid-surface coordinates and draw above placed assets.
- Delete Level previously confirmed but did not remove the selected level in Chrome; it must keep removing the selected level from project state and refreshing the UI immediately.
- Browser-native prompt/confirm/alert dialogs were replaced with app-owned modals for future `.exe`/WebView compatibility; do not bring native browser dialogs back for editor workflows.
- Drag performance optimisations should remain in place: do not reintroduce full grid renders, repeated DOM queries for selected group markers, or autosave/localStorage writes inside mousemove/pointermove loops.
- Layer selection belongs in the selected placed asset's Properties modal, while editor-only visibility and locking belong in the top `View` menu. Do not reintroduce a standalone sidebar Layer Panel or expand these controls into solo, active placement, or runtime behavior without permission.
- Do not let View-menu dismissal clicks fall through to the grid; the first outside click must close View only.

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
- Do not expand the focused Phase 4 placed-properties work into later Phase 4 systems or Phase 5 without permission.
- Do not reintroduce Chrome-native prompt/confirm/alert behaviour for editor workflows.
- Do not save full project state or panel preferences on every drag mousemove; commit and persist completed actions on release.

## 18. Testing Checklist

Before accepting changes to existing editor behaviour, verify:

- [ ] Open the editor in normal Chrome.
- [ ] Create a level using the in-app prompt modal and confirm it becomes the selected level.
- [ ] Rename a level using the in-app prompt modal.
- [ ] Delete a non-final level using the in-app confirmation modal and confirm a remaining level becomes active.
- [ ] Clear a level after placing content, confirming the in-app modal cancel path does nothing and the confirm path clears.
- [ ] Drag-reorder levels and refresh to confirm order persists.
- [ ] Resize a grid larger.
- [ ] Resize a grid smaller when a placed object would be removed and confirm the in-app warning appears.
- [ ] Confirm there is no automatic `Custom Imported Assets` category.
- [ ] Create a category using the in-app prompt modal and confirm it appears immediately.
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
- [ ] Confirm an in-app overwrite warning appears when placement overlaps an existing object.
- [ ] Activate Select/Move with its toolbar button and with `Q`; press `W` and confirm it remains in Select/Move; activate Delete with `E`.
- [ ] Focus an editable input or import modal field and confirm typing `Q`, `W`, or `E` does not switch tools.
- [ ] Focus an app-owned modal input and confirm typing `Q`, `E`, Delete, or Backspace does not switch tools or delete placed grid assets.
- [ ] Select a placed asset in Select/Move mode and confirm its outline and eight resize handles appear.
- [ ] Drag a selected placed asset, confirm it snaps within bounds, then refresh and confirm the new position persists.
- [ ] Resize a selected asset from corner and side handles, confirm it cannot leave the grid or shrink below `1x1`, then refresh and confirm the size persists.
- [ ] In Select/Move mode, select a placed asset, press `Ctrl+C`, confirm a yellow floating preview appears, click a new grid position, and confirm the new placed copy survives refresh.
- [ ] Start floating copy placement and press Escape; confirm no copied placed asset is added.
- [ ] Multi-select visible/unlocked assets, press `Ctrl+C`, and confirm every eligible asset has a lightweight floating preview with its relative spacing preserved.
- [ ] Include stale hidden/locked IDs in a group selection and confirm only eligible members are copied with a copied-count status; confirm a fully protected selection reports `No unlocked visible assets selected to copy.`
- [ ] Paste a copied group and confirm every member has a new ID, preserved metadata/unknown fields, recalculated references, and the pasted group becomes the active yellow multi-selection.
- [ ] Paste a copied group near every grid edge and confirm the complete group clamps inside the level.
- [ ] Confirm hidden destination overlaps appear in one app-owned warning, locked destination overlaps block the whole paste, and cancelling leaves existing data and copy mode unchanged.
- [ ] Confirm group-preview pointer movement does not autosave, mutate level data, or rebuild grid cells, coordinate headers, or placed-marker collections.
- [ ] Select one and multiple eligible placed assets, press `Ctrl+X`, confirm the orange cut preview appears, then press Escape and confirm every original ID, position, and field remains unchanged.
- [ ] Cut a group to a new location and confirm relative spacing, original IDs, dimensions, layers, metadata, unknown fields, and selection survive the move and browser refresh.
- [ ] Cancel a cut overlap warning and trigger a locked destination block; confirm cut mode remains recoverable and no source or destination data changes.
- [ ] Select one and multiple eligible assets, press `Ctrl+D`, and confirm new IDs are created at a nearby clamped offset with preserved relative spacing and metadata.
- [ ] Confirm newly duplicated assets become the active yellow selection and survive refresh and File > Save.
- [ ] Include stale hidden, layer-locked, and individually locked selections in cut/duplicate attempts and confirm they are skipped; confirm a fully protected cut reports `No unlocked visible assets selected to cut.`
- [ ] Confirm Edit keeps Copy Level / Paste Level working and exposes separately named Copy, Cut, and Duplicate Selected Assets commands with unavailable states when appropriate.
- [ ] Focus Properties inputs or an app-owned modal and confirm `Ctrl+C`, `Ctrl+X`, and `Ctrl+D` do not invoke placed-asset commands.
- [ ] Select a small grid range and use Edit > Fill Selected Area; confirm every cell receives a separate `1x1` object with a unique ID and cell-specific references rather than one stretched object.
- [ ] Fill over editable overlaps, cancel the app-owned warning, and confirm nothing changes; confirm the operation replaces those overlaps atomically after approval.
- [ ] Fill over a hidden editable overlap and confirm the warning identifies hidden content; fill over a locked-layer or individually locked overlap and confirm the complete operation is blocked.
- [ ] Select more than 500 cells for Fill and confirm the app-owned large-fill performance warning appears before data changes.
- [ ] Use Edit > Clear Selected Area and confirm visible unlocked intersections are removed while hidden and locked intersections remain and are reported as skipped.
- [ ] Confirm Fill and Clear keep the selected range active, update only placed markers, autosave once, and preserve palette assets, categories, unknown layers, and saved JSON structures.
- [ ] Confirm Edit disables Fill without both a selected range and palette asset, and disables Clear without a selected range.
- [ ] Select an area containing repeated copies of one source asset and other non-matching assets, then use Edit > Replace Matching Assets and confirm only matching `assetId` values are replaced.
- [ ] Confirm Replace Matching Assets uses the currently selected palette asset as the replacement and keeps the source choice inside an app-owned modal with no Chrome-native dialog.
- [ ] Confirm replaced objects keep their IDs, positions, dimensions, grid/range refs, layer, visible/opacity/blocking fields, notes, `editorLocked`, `layerOptions`, and unknown fields.
- [ ] Confirm hidden, layer-locked, and individually locked matching assets are skipped and reported, while non-matching assets are untouched.
- [ ] Cancel the source modal and the confirmation modal in separate Replace Matching Assets tests and confirm no level data changes.
- [ ] Confirm Replace Matching Assets refreshes only placed markers, autosaves once after confirmation, and preserves hidden assets, unknown layer arrays, File Save output, and Copy Level / Paste Level data.
- [ ] Move or resize over another asset and confirm the in-app overlap replacement warning appears before removal.
- [ ] Select a placed object in Select/Move mode, press Delete and Backspace in separate tests, and confirm each removes only the selected grid copy.
- [ ] Drag-select multiple placed assets in Select/Move mode and confirm every intersecting placed copy is highlighted.
- [ ] Confirm every asset in a multi-selection uses a yellow selection outline, with no blue secondary outlines.
- [ ] Drag one selected asset in a multi-selection and confirm the whole group moves together, snaps to grid, and remains inside grid bounds.
- [ ] Confirm single asset move/resize and group move remain smooth on `30x30`, `50x50`, `100x100`, and `200x200` grids and persist after refresh.
- [ ] Confirm resize handles and Asset Properties remain single-asset only and are not shown for multi-selected groups.
- [ ] Open Asset > Properties for one selected placed asset and confirm Source asset name, Category name, Grid Ref, Width, Height, Visible, Opacity, Layer, Blocks Movement, Notes, and layer-specific options are shown.
- [ ] Open Edit > Properties for one selected placed asset and confirm the same Placed Asset Properties panel opens.
- [ ] Double-click a placed asset and confirm the same Placed Asset Properties panel opens.
- [ ] Resize Placed Asset Properties so its fields scroll and confirm Cancel / Close and Apply / Save Changes remain visible without covering the final fields.
- [ ] Confirm Placed Asset ID, Source Asset ID, X, and Y are hidden from the user-facing properties panel but remain stored in saved placed asset data.
- [ ] Edit Grid Ref and confirm the asset moves correctly.
- [ ] Edit Width/Height and confirm the asset resizes correctly.
- [ ] Edit Visible, Opacity, Layer, Blocks Movement, Notes, and layer-specific `layerOptions` fields and confirm each value applies only after submit and saves.
- [ ] Cancel or close Placed Asset Properties after changing fields and confirm no property changes are applied.
- [ ] Change one placed asset from `objects` to `overlay`, confirm it remains exactly once with the same ID and bounds, then refresh and confirm Properties still shows `overlay`.
- [ ] Change the same placed asset from `overlay` back to `objects`, confirm it remains exactly once with the same ID and bounds, then refresh and confirm Properties still shows `objects`.
- [ ] Confirm layer relocation preserves unknown placed-asset fields, `layerOptions`, and unknown layer arrays without deleting or duplicating unrelated assets.
- [ ] Refresh Chrome and confirm placed asset property changes are restored.
- [ ] Use File > Save and confirm updated placed asset properties are written to the level JSON.
- [ ] Copy a placed asset with `Ctrl+C` and confirm the copied placed asset preserves the edited properties.
- [ ] Copy Level and Paste Level and confirm placed asset properties are preserved.
- [ ] Confirm trigger layer options remain metadata only and full trigger behavior is not implemented.
- [ ] Confirm no standalone sidebar Layer Panel is present.
- [ ] Confirm the top menu order is `File`, `Edit`, `View`, `Asset`.
- [ ] Open View and confirm all ten known layer checkboxes and `Show All Layers` are present.
- [ ] Hide each layer and confirm only its marker elements disappear while IDs, bounds, array membership, and saved JSON remain unchanged.
- [ ] Confirm the View menu remains open while toggling multiple layer checkboxes.
- [ ] Refresh and confirm editor-only visibility preferences persist, then use `Show All Layers` to restore every known layer.
- [ ] Confirm hidden-layer assets cannot be selected, moved, resized, copied, opened in Properties, or deleted by click, drag-area, Delete, or Backspace.
- [ ] Hide a layer containing selected assets and confirm only those selections are cleared; hide the source layer during copied placement and confirm the preview is cancelled.
- [ ] Confirm placement and move/resize overlap checks still include hidden-layer assets and the warning identifies their inclusion.
- [ ] Move an asset into a hidden layer through Properties and confirm it saves, disappears, survives refresh, and returns unchanged when shown.
- [ ] Confirm File Save and Copy Level / Paste Level preserve hidden assets without adding visibility metadata.
- [ ] Confirm visibility toggles do not rebuild the grid or trigger project autosave on `50x50`, `100x100`, and `200x200` grids.
- [ ] Confirm the Layer Locking flyout contains all ten layer lock checkboxes and View contains `Unlock All Layers and Assets`.
- [ ] Confirm View initially shows only Layer Visibility, Layer Locking, Show All Layers, and Unlock All Layers and Assets.
- [ ] Hover and click each View flyout trigger, confirm only one side panel is open, and confirm it stays within the viewport.
- [ ] Click outside an open View flyout and confirm the menu closes without selecting, moving, deleting, or placing on the grid underneath.
- [ ] Lock a visible layer and confirm its assets remain visible but cannot be selected, moved, resized, copied, opened in Properties, group-moved, or deleted.
- [ ] Lock a currently selected layer and confirm its selection and resize handles clear and Properties closes.
- [ ] Confirm Delete click, Delete drag-area, and Delete/Backspace skip locked-layer assets while unlocked assets remain editable.
- [ ] Confirm placement, copied placement, move/resize, group move, and Properties bounds changes cannot replace assets on locked layers.
- [ ] Refresh and confirm lock preferences persist, then use `Unlock All Layers and Assets` and confirm all known layers unlock.
- [ ] Confirm `Show All Layers` does not unlock layers or assets and `Unlock All Layers and Assets` does not show hidden layers.
- [ ] Confirm lock toggles update marker interaction state without rebuilding grid cells or triggering project autosave.
- [ ] Confirm lock metadata is absent from project JSON, level JSON, copied levels, backups, folder exports, and `assetRegistry.json`.
- [ ] Set one placed asset's Properties Locked field to Yes and confirm `editorLocked: true` is saved only on that placed instance.
- [ ] Confirm an individually locked asset cannot be selected, moved, resized, copied, group-moved, deleted, or replaced.
- [ ] Double-click an individually locked asset in Chrome and the Codex in-app browser, confirm one Properties panel opens without selecting it, then set Locked to No and confirm normal editing returns.
- [ ] Refresh and confirm `editorLocked` persists; confirm File Save, Copy Level / Paste Level, and placed-object copy data preserve the field.
- [ ] Lock both an asset and its layer, then unlock only the layer and confirm the individual lock remains.
- [ ] Use Unlock All Layers and Assets and confirm layer preferences and individual locks across all project levels are cleared with one autosave.
- [ ] Confirm full Phase 5 controls such as solo, active placement layer, Play Mode, runtime collision, spawns, items, NPCs, enemies, and trigger systems are not present.
- [ ] Press Delete or Backspace with multiple placed assets selected and confirm all selected placed copies are removed without deleting palette assets.
- [ ] Select a grid area in Select/Move mode, press Delete or Backspace with no placed object selected, and confirm every intersecting placed copy is removed without a confirmation prompt.
- [ ] Type Delete/Backspace inside an editable input and confirm editor object deletion is not triggered.
- [ ] Open a `50x50`, `100x100`, and `200x200` grid and confirm horizontal and vertical grid viewport scrollbars are accessible in the visible panel.
- [ ] Try a custom grid larger than `100x100` and confirm an in-app large-grid warning appears.
- [ ] Try a custom grid larger than `250x250` and confirm the stronger in-app very-large-grid warning appears.
- [ ] Try a custom grid larger than `500x500` and confirm it is blocked with an in-app message.
- [ ] Drag the asset panel divider wider/narrower, refresh, and confirm the saved width returns without disrupting grid scrollbars or alignment.
- [ ] Confirm dragging the asset panel divider feels smooth and saves the final width only after release.
- [ ] Collapse and restore the asset panel, then refresh and confirm the collapsed/restored state and previous expanded width return.
- [ ] Confirm coordinate axes sit flush beside the grid and the hidden top-left spacer never covers row labels during scrolling.
- [ ] Scroll the grid horizontally and vertically, then place, move, and resize an asset and confirm grid alignment remains correct.
- [ ] Use Delete mode on any covered cell of a stretched asset and confirm the whole placed copy is removed without a confirmation prompt.
- [ ] In Delete mode, drag over a grid area containing placed assets and confirm every intersecting placed copy is removed without a confirmation prompt.
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
- [ ] Confirm no Chrome-native `alert`, `confirm`, or `prompt` boxes appear during normal editor workflows.

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
