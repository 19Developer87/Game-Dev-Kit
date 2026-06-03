# Game Dev Kit Current State

## 1. Project Overview

This project is a reusable browser-based Game Dev Kit / Level Editor. It is currently a standalone browser tool for visually creating and editing level data, rather than a runtime game or a game integration layer.

The editor is intended to remain reusable so it can later sit on top of different game projects and save data those projects can consume.

Normal Chrome is the main supported test browser. The editor uses browser file and folder functionality, including the File System Access API, which works in normal Chrome but may be unavailable or restricted in the Codex browser preview.

The Codex browser preview may not support all browser APIs and behaviours this editor depends on. Verify folder picker, file saving, localStorage persistence, drag/drop, and confirmation-dialog behaviour in normal Chrome. Do not treat Codex browser preview failures as final unless the same issue happens in Chrome.

Even though Chrome remains the supported development test browser for file/folder APIs, normal editor workflows should use Game Dev Kit UI rather than Chrome-native `alert`, `confirm`, or `prompt` dialogs. This keeps the editor suitable for later `.exe` or WebView packaging.

## 2. Relationship To `GAME_DEV_KIT_PLAN.md`

The existing roadmap file in this repository is [`GAME_DEV_KIT_PLAN.md`](./GAME_DEV_KIT_PLAN.md). It defines the long-term roadmap and phase plan.

This file, `Game_Dev_Kit_Current_State.md`, is the current-state reference. It describes behaviour that exists now, the present implementation shape, and the features future changes must preserve.

Future Codex sessions should read both files before making changes:

1. Read `GAME_DEV_KIT_PLAN.md` for intent and phase boundaries.
2. Read `Game_Dev_Kit_Current_State.md` for existing behaviour and regression constraints.

Update this current-state file whenever working behaviour changes.

## 3. Current Phase Status

- Current working branch: `codex/phase-5-layer-system`.
- The project has begun Phase 4 with a focused placed-asset properties implementation.
- Phase 1 and Phase 2 functionality is working.
- Phase 3 has a solid asset import, categorisation, grid selection, and placement base and is being polished.
- Phase 4 basic placed asset properties are tested and working for placed instance inspection, editing, browser persistence, Chrome refresh restoration, folder save output, placed-asset copy, and Copy Level / Paste Level preservation.
- Phase 4 currently adds placed instance inspection and editing only; full trigger gameplay behaviour and gameplay collision runtime are not implemented.
- Phase 5A has started with placed-asset layer metadata inside Placed Asset Properties only; full Phase 5 layer controls are not implemented yet.
- Safe stopping point: existing tools, save/load, asset import/categories, placed-asset properties, and optimised grid rendering are working well enough to pause before continuing Phase 5 later.

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
- Asset menu beside File/Edit, enabled only for one placed asset selected in Select/Move mode.
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
- Overwrite confirmation before a new placement removes overlapping objects.
- Browser-native alert/confirm/prompt dialogs have been replaced with in-app Game Dev Kit modals so the editor can later be packaged in an `.exe` or WebView shell without depending on Chrome-native dialog behaviour.
- In-app modals are used for Create New Level, Rename Level, Delete Level, Clear Level, Create Category, Delete Category, Delete Palette Asset, grid resize warnings, paste warnings, placement overwrite warnings, and other editor warnings that previously used browser-native dialogs.
- Placed Asset Properties includes a Layer / Behaviour section with `terrain`, `decorations`, `objects`, `collisions`, `spawns`, `items`, `npcs`, `enemies`, `triggers`, and `overlay`.
- The selected layer controls only the selected placed asset and its `layerOptions` metadata. There is no standalone sidebar Layer Panel, active placement layer, hide/show, lock, solo, or layer visibility control yet.
- Browser refresh restoration of project data, levels, categories, imported image data, and placed objects.
- No visible default placeholder asset library.

Current limitations:

- This is still an editor only; it does not run player movement, NPC logic, battles, doors, or game integration.
- Full Phase 5 layer behaviour is not implemented yet. Show/hide layers, lock/unlock layers, solo layer, move-to-layer actions, and layer-aware placement are not implemented yet.
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
- Placed Asset Properties hides Placed Asset ID, Source Asset ID, X, and Y from the user-facing panel while keeping `id`, `assetId`, `x`, and `y` stored internally.
- Placed Asset Properties uses `Grid Ref` as its user-facing position field. `x` and `y` remain stored internally and are recalculated from the submitted Grid Ref; `rangeRef` is recalculated after position or size edits.
- Tested property behavior: Grid Ref changes move the asset correctly, Width/Height changes resize the asset correctly, Visible toggles display, Opacity changes display transparency, Layer saves, Blocks Movement saves, and Notes save.
- Layer-specific metadata is saved on the placed asset under `layerOptions` and unknown/custom fields are preserved.
- Tested persistence behavior: property changes persist after Chrome refresh, File > Save writes updated placed asset properties to level JSON, `Ctrl+C` copied placed assets preserve properties, and Copy Level / Paste Level preserves properties.
- Identity / Info shows Source asset name and Category name only. It deliberately hides internal `id` and `assetId` values while keeping them on placed asset data for saving and loading.
- Placed Asset Properties updates the current-level object only and preserves unknown/custom fields.
- The properties modal exposes `visible`, `opacity`, `layer`, `blocksMovement`, `notes`, and layer-specific `layerOptions`; Collision/Solid/Walkable are not separate UI fields.
- The properties modal can be dragged by its header and resized from its bottom-right corner; its position and size are kept in browser UI preferences rather than level JSON.
- Hidden or zero-opacity placed assets render as faint editor-only markers so they can remain selected and edited.
- Layer is a per-instance choice with the existing layer names: `terrain`, `decorations`, `objects`, `collisions`, `spawns`, `items`, `npcs`, `enemies`, `triggers`, and `overlay`.
- Layer-specific sections are metadata only: terrain tag, decorative-only flag, object note/type, collision type/note, spawn name/direction, item ID/quantity, NPC name/dialogue ID, enemy type/spawn chance, trigger type/targets, and overlay render/note fields.
- Terrain, decoration, object, collision, spawn, item, NPC, enemy, trigger, and overlay options are editor data only for now. They do not implement runtime collision, spawning, pickup behaviour, NPC runtime, enemy runtime, trigger/door/exit behaviour, or runtime draw-order/player layering yet.
- Full trigger actions, runtime collision, spawn behaviour, item pickup behaviour, NPC logic, enemy logic, Play Mode, and hide/lock/solo layer controls remain future work.
- There is no standalone Layer Panel or active placement layer yet; layer changes happen only through the selected placed asset's Properties dialog.
- A temporary left-sidebar Layer Panel was tested during Phase 5A and worked as UI state, but the chosen direction is not to keep layers as a permanent left-sidebar panel.
- Moving or resizing into another object's rectangle warns first with an in-app modal, then uses the existing replacement policy if confirmed.
- In Select/Move mode, `Ctrl+C` copies the selected placed object into a floating placement preview with a yellow outline; clicking a grid cell commits a new placed object with a new ID and the same asset/size fields.
- `Ctrl+C` group copy is not implemented; with multiple placed assets selected, the editor reports that group copy is not implemented yet.
- The floating copy preview snaps to valid grid positions, is not saved before placement, and is cancelled with Escape or by switching away from Select/Move mode.
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
- Phase 5A layer metadata belongs in the selected placed asset's Properties modal. Do not reintroduce a standalone sidebar Layer Panel, active placement layer, hide/show, lock, solo, or layer visibility controls until explicitly requested.

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
- [ ] Move or resize over another asset and confirm the in-app overlap replacement warning appears before removal.
- [ ] Select a placed object in Select/Move mode, press Delete and Backspace in separate tests, and confirm each removes only the selected grid copy.
- [ ] Drag-select multiple placed assets in Select/Move mode and confirm every intersecting placed copy is highlighted.
- [ ] Drag one selected asset in a multi-selection and confirm the whole group moves together, snaps to grid, and remains inside grid bounds.
- [ ] Confirm single asset move/resize and group move remain smooth on `30x30`, `50x50`, `100x100`, and `200x200` grids and persist after refresh.
- [ ] Confirm resize handles and Asset Properties remain single-asset only and are not shown for multi-selected groups.
- [ ] Open Asset > Properties for one selected placed asset and confirm Source asset name, Category name, Grid Ref, Width, Height, Visible, Opacity, Layer, Blocks Movement, Notes, and layer-specific options are shown.
- [ ] Open Edit > Properties for one selected placed asset and confirm the same Placed Asset Properties panel opens.
- [ ] Double-click a placed asset and confirm the same Placed Asset Properties panel opens.
- [ ] Confirm Placed Asset ID, Source Asset ID, X, and Y are hidden from the user-facing properties panel but remain stored in saved placed asset data.
- [ ] Edit Grid Ref and confirm the asset moves correctly.
- [ ] Edit Width/Height and confirm the asset resizes correctly.
- [ ] Edit Visible, Opacity, Layer, Blocks Movement, Notes, and layer-specific `layerOptions` fields and confirm each value applies only after submit and saves.
- [ ] Cancel or close Placed Asset Properties after changing fields and confirm no property changes are applied.
- [ ] Refresh Chrome and confirm placed asset property changes are restored.
- [ ] Use File > Save and confirm updated placed asset properties are written to the level JSON.
- [ ] Copy a placed asset with `Ctrl+C` and confirm the copied placed asset preserves the edited properties.
- [ ] Copy Level and Paste Level and confirm placed asset properties are preserved.
- [ ] Confirm trigger layer options remain metadata only and full trigger behavior is not implemented.
- [ ] Confirm no standalone sidebar Layer Panel is present.
- [ ] Confirm full Phase 5 layer controls such as show/hide, lock, solo, active placement layer, Play Mode, runtime collision, spawns, items, NPCs, enemies, and trigger systems are not present.
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
