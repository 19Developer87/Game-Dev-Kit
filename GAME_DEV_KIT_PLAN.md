# Reusable Game Dev Kit / Browser Level Editor Plan

## Main Goal

Create a reusable browser-based Game Dev Kit / Level Editor that can be used across multiple game projects.

The editor should let me visually build and edit game worlds directly inside the browser preview, without needing to ask Codex for every tree, path, enemy, building, grass tile, object, or layout change.

The editor must coexist safely with Codex changes.

Codex should improve the game code and systems.

The editor should manage world/map data.

---

## Core Rules

- Do not redesign the whole game.
- Do not break the existing game.
- Do not hard-code placed map objects directly into scene files.
- Keep editable world data separate from game code.
- Do not overwrite existing saved maps or level JSON unless I explicitly ask.
- Preserve unknown JSON fields when loading and saving.
- Keep the system reusable across multiple projects.
- The editor may use a grid for placement, snapping, terrain painting and collision setup.
- The actual game must still allow free movement if the game already uses free movement.
- Do not replace free player movement with tile-by-tile movement.
- Do not break player movement, battle flow, world return logic, collisions, camera following, or existing game systems.

---

## Recommended Data-Driven Architecture

The game should load map/world data from JSON or browser storage.

Do not do this:

```js
createTree(5, 10);
createHouse(12, 4);
createEnemy(18, 7);
```

Instead, use editable data like this:

```json
{
  "projectName": "My Game",
  "editorVersion": "1.0.0",
  "schemaVersion": 1,
  "lastOpenedLevelId": "starter-level",
  "levels": [
    {
      "id": "starter-level",
      "name": "Starter Level",
      "gridWidth": 30,
      "gridHeight": 30,
      "tileSize": 32,
      "layers": {
        "terrain": [],
        "decorations": [],
        "objects": [],
        "collisions": [],
        "spawns": [],
        "items": [],
        "npcs": [],
        "enemies": [],
        "triggers": [],
        "overlay": []
      }
    }
  ],
  "assets": []
}
```

The editor edits this data.

The game loads this data.

Codex should add systems, assets and object types without overwriting the saved level data.

---

## Suggested Folder Structure

Adapt this to the current project structure if needed.

```text
src/
  devkit/
    DevEditor.ts
    DevEditorUI.ts
    GridEditor.ts
    AssetPalette.ts
    LevelManager.ts
    SaveManager.ts
    ImportExportManager.ts
    SelectionManager.ts
    CollisionEditor.ts
    EditorTypes.ts

  data/
    levels/
      starter-level.json
    assets/
      assetRegistry.json

public/
  user-assets/
```

If the project uses JavaScript instead of TypeScript, use `.js` files instead.

---

# Phase 1 — Basic Standalone Editor Foundation

## Goal

Build the first working version of the editor with the smallest safe feature set.

This phase should prove that I can create a grid, place objects, delete objects, save, reload, and export JSON.

Do not deeply integrate with the full game yet unless it is already safe to do so.

## Required Features

- Add a Development Mode / Editor view.
- Add a grid display.
- Allow grid size selection:
  - 10x10
  - 20x20
  - 30x30
  - 40x40
  - 50x50
  - Custom width and height
- Create one default level called `Starter Level`.
- Use a default grid size of 30x30.
- Use a default tile size of 32.
- Add a simple toolbar.
- Add starter placeholder assets:
  - Grass
  - Path
  - Water
  - Tree
  - Rock
  - House
  - Enemy Spawn
  - NPC Spawn
  - Item
  - Trigger
  - Collision Block
- Allow clicking a grid cell to place the selected asset.
- Allow deleting placed assets.
- Allow replacing an asset on a grid cell.
- Save editor data to localStorage or IndexedDB.
- Load saved editor data automatically when the browser refreshes.
- Add manual Save button.
- Add Clear Level button with confirmation.
- Add Export Current Level JSON button.
- Add Export Full Project JSON button.

## Startup Behaviour

When the editor loads:

1. Check for saved editor data in localStorage or IndexedDB.
2. If saved data exists, load the last opened level.
3. If no saved data exists, create a new starter project.
4. The starter project should contain one empty 30x30 level.
5. The editor should clearly show whether it loaded saved data or created a new empty starter grid.
6. The editor should never load into a blank broken screen.

## Phase 1 Safety Rules

- Do not remove existing game code.
- Do not overwrite existing map files.
- Do not hard-code map objects into scene files.
- Do not break normal game loading.
- Do not break current player movement.
- Keep Phase 1 modular so it can be integrated later.

## Phase 1 Acceptance Test

After Phase 1, I should be able to:

1. Open the browser preview.
2. Open the editor.
3. Choose a 30x30 grid.
4. Place grass, path, water, tree, rock and house placeholders.
5. Delete placed objects.
6. Save.
7. Refresh the browser.
8. See the placed objects still there.
9. Export the level as JSON.

---

# Phase 2 — Multiple Levels / Maps

## Goal

Allow the editor to manage more than one level or map.

## Required Features

- Add a level selector.
- Create new level.
- Rename level.
- Delete level with confirmation.
- Duplicate level.
- Switch between levels.
- Each level must store its own:
  - ID
  - Name
  - Grid width
  - Grid height
  - Tile size
  - Terrain
  - Objects
  - Decorations
  - Collision data
  - Spawns
  - Items
  - NPCs
  - Enemies
  - Triggers
- Remember the last opened level.
- Reload the last opened level after browser refresh.

## Example Levels

The system should support levels such as:

- Starter Town
- Forest Route
- Cave
- Battle Test Map
- House Interior
- Shop Interior

## Grid Resizing

Allow resizing a level grid.

Rules:

- Resizing larger should preserve all existing objects.
- Resizing smaller should warn before removing objects outside the new bounds.
- Create a backup before destructive resize.
- Do not delete objects without confirmation.

## Phase 2 Acceptance Test

After Phase 2, I should be able to:

1. Create several levels.
2. Switch between them.
3. Give each one a different grid size.
4. Place different objects on each level.
5. Save.
6. Refresh.
7. See all levels and placed objects still there.

---

# Phase 3 — Asset Palette and File Explorer Import

## Goal

Create a proper reusable asset system.

## Required Features

- Add an asset palette.
- Group assets by category:
  - Terrain
  - Buildings
  - Nature
  - Paths
  - Water
  - Rocks
  - Decorations
  - Enemies
  - NPCs
  - Items
  - Doors
  - Triggers
  - Collision
  - Custom Imported Assets
- Add asset search/filter.
- Add asset preview.
- Allow importing assets from file explorer.
- Add an Import Asset button.
- Open a file picker.
- Support image files:
  - PNG
  - JPG
  - WEBP
  - SVG if safe/supported
- Show a preview of the imported asset.
- Let me enter:
  - Asset name
  - Category
  - Default layer
  - Collision on/off
  - Solid / non-solid
  - Blocks movement on/off
  - Transparent on/off
  - Visible on/off
  - Width in grid cells
  - Height in grid cells
- Add imported assets to the asset palette.
- Save imported asset metadata to the asset registry.
- Store imported assets in localStorage or IndexedDB if direct file writing is not available.
- Allow exporting the asset registry as JSON.

## Asset Metadata Example

```json
{
  "id": "tree-oak-01",
  "name": "Oak Tree",
  "category": "Nature",
  "src": "/assets/tree-oak-01.png",
  "defaultLayer": "objects",
  "solid": true,
  "transparent": false,
  "visible": true,
  "blocksMovement": true,
  "width": 1,
  "height": 1
}
```

## Phase 3 Acceptance Test

After Phase 3, I should be able to:

1. Open the asset palette.
2. Import an image from my computer.
3. Give it a name and category.
4. Set whether it blocks movement.
5. Set whether it is transparent or visible.
6. Place it on the grid.
7. Save.
8. Refresh.
9. Still see the imported asset and placed object.

---

# Phase 4 — Object Properties, Collision, Transparency and Blocking

## Goal

Allow each placed object to have editable behaviour.

## Required Features

When selecting an object, show a properties panel.

Properties should include:

- ID
- Type
- Name
- X position
- Y position
- Width
- Height
- Layer
- Collision enabled
- Solid enabled
- Blocks movement enabled
- Transparent enabled
- Visible enabled
- Asset source
- Notes

The editor must allow each placed asset/object to be configured as:

- Solid / blocks movement
- Non-solid / walkable
- Transparent
- Visible
- Hidden
- Decorative only
- Trigger only
- Collision enabled
- Collision disabled

## Behaviour Rules

- Trees, rocks, houses, walls, fences and water should usually block movement by default.
- Grass, paths, floors, flowers, shadows and small decorations should usually be walkable by default.
- Some assets may be visible but non-blocking.
- Some assets may be invisible but blocking.
- Some assets may be invisible trigger zones.
- Some assets may be transparent overlays, such as shadows, lighting, tall grass, fog, water effects or roof overlays.
- The editor must allow the person editing to override default behaviour per placed object.

## Example Solid Object

```json
{
  "id": "placed-tree-001",
  "assetId": "tree-oak-01",
  "type": "tree",
  "x": 10,
  "y": 5,
  "layer": "objects",
  "visible": true,
  "transparent": false,
  "solid": true,
  "blocksMovement": true,
  "collisionEnabled": true,
  "width": 1,
  "height": 1
}
```

## Example Transparent Walkable Object

```json
{
  "id": "placed-shadow-001",
  "assetId": "tree-shadow-01",
  "type": "shadow",
  "x": 10,
  "y": 6,
  "layer": "decorations",
  "visible": true,
  "transparent": true,
  "solid": false,
  "blocksMovement": false,
  "collisionEnabled": false
}
```

## Example Invisible Trigger

```json
{
  "id": "trigger-door-001",
  "type": "levelExit",
  "x": 5,
  "y": 2,
  "layer": "triggers",
  "visible": false,
  "transparent": true,
  "solid": false,
  "blocksMovement": false,
  "collisionEnabled": false,
  "triggerType": "levelExit",
  "targetLevel": "house-interior",
  "targetSpawn": "front-door"
}
```

## Phase 4 Acceptance Test

After Phase 4, I should be able to:

1. Place an object.
2. Select it.
3. Change whether it blocks movement.
4. Change whether it is visible.
5. Change whether it is transparent.
6. Save.
7. Refresh.
8. See the same settings still applied.

---

# Phase 5 — Layers

## Goal

Add proper layer support so maps are easier to manage.

## Required Layers

- Terrain
- Decorations
- Objects
- Collision
- Items
- NPCs
- Enemies
- Triggers
- Overlay

## Required Features

- Show/hide each layer.
- Lock/unlock each layer.
- Edit only the selected layer.
- Prevent editing locked layers.
- Allow placing objects above or below the player depending on the layer.
- Allow transparent overlay assets above the player.
- Allow hiding collision while decorating.
- Allow showing only triggers.
- Allow locking terrain while placing NPCs.

## Phase 5 Acceptance Test

After Phase 5, I should be able to:

1. Place terrain on the terrain layer.
2. Place a tree on the objects layer.
3. Place a shadow on the overlay or decorations layer.
4. Hide collision.
5. Lock terrain.
6. Place NPCs without changing terrain accidentally.

---

# Phase 6 — Area Tools and Multi-Select

## Goal

Make world building much faster with drag editing and multi-select.

## Required Features

- Click and drag to paint multiple tiles.
- Click and drag to delete multiple tiles.
- Click and drag with Select Tool to draw a selection box.
- Select multiple tiles/objects at once.
- Show visible outline around selected area.
- Delete selected objects together.
- Move selected objects together.
- Replace selected objects together.
- Copy selected objects.
- Cut selected objects.
- Paste selected objects.
- Duplicate selected objects.
- Fill selected area with selected asset.
- Clear selected area.
- Replace matching assets inside selected area.

## Brush Sizes

Add brush size options:

- 1x1
- 2x2
- 3x3
- 5x5
- Custom

Optional:

- Random brush for grass, flowers, rocks, trees and decoration variations.

## Keyboard Shortcuts

- Ctrl + A = select all on current layer
- Ctrl + C = copy selected
- Ctrl + X = cut selected
- Ctrl + V = paste selected
- Delete = delete selected
- Escape = clear selection

## Phase 6 Acceptance Test

After Phase 6, I should be able to:

1. Drag to paint a path.
2. Drag to delete a row of objects.
3. Drag a selection box around multiple objects.
4. Move them together.
5. Copy and paste them.
6. Fill a selected area with grass.
7. Replace selected grass with path.

---

# Phase 7 — Free Movement Integration and Collision Runtime

## Goal

Integrate editor-created collision data with normal gameplay while preserving free movement.

## Important Requirement

The grid is for editing.

The game character must still move freely around the world if the game already supports free movement.

Do not convert the game to tile-by-tile movement.

## Required Features

- Player can move freely using keyboard controls.
- Collision uses saved editor data.
- Solid/blocking objects prevent movement.
- Non-solid/walkable objects do not block movement.
- Invisible blocking objects can block movement.
- Invisible triggers can trigger actions without blocking movement.
- Collision can be grid-based behind the scenes, but movement should feel smooth/free.
- Collision should support future Android/touch controls.
- Do not break existing camera following.
- Do not break battle triggers.
- Do not break world return logic.

## Phase 7 Acceptance Test

After Phase 7, I should be able to:

1. Place a solid tree.
2. Exit Dev Mode.
3. Move the player freely around the world.
4. The player cannot walk through the tree.
5. Place a non-solid flower.
6. The player can walk over/near the flower.
7. Place an invisible trigger.
8. The player can activate the trigger without it blocking movement.

---

# Phase 8 — Spawns, NPCs, Enemies, Items and Triggers

## Goal

Support gameplay objects beyond basic terrain and decoration.

## Required Features

### Player Spawn Points

Each level should support one or more player spawn points.

Example:

```json
{
  "id": "starter-spawn",
  "x": 5,
  "y": 5,
  "direction": "down"
}
```

The editor should allow me to:

- Place spawn points.
- Name spawn points.
- Choose default spawn.
- Use spawn points when moving between levels.

### Enemy Spawns

Enemy properties should include:

- Enemy type
- Level
- Spawn chance
- Respawn enabled
- Movement type

### NPCs

NPC properties should include:

- NPC name
- Dialogue ID
- Movement type
- Shop ID if any
- Quest ID if any

### Items

Item properties should include:

- Item ID
- Quantity
- Pickup once or respawn
- Description

### Triggers

Trigger properties should include:

- Trigger type
- Target level
- Target spawn point
- Dialogue ID
- Battle ID
- Cutscene ID

## Phase 8 Acceptance Test

After Phase 8, I should be able to:

1. Place a player spawn.
2. Place an enemy spawn.
3. Place an NPC.
4. Place an item.
5. Place a trigger.
6. Save.
7. Refresh.
8. See all gameplay objects restored with their properties.

---

# Phase 9 — Doors, Exits and Level Transitions

## Goal

Allow visual connection between levels.

## Required Features

Add support for doors and level exits.

A door/exit should store:

- Source level
- Source position
- Target level
- Target spawn point
- Optional required item
- Optional locked state

Example:

```json
{
  "type": "levelExit",
  "x": 10,
  "y": 4,
  "targetLevel": "house-interior",
  "targetSpawn": "front-door"
}
```

## Phase 9 Acceptance Test

After Phase 9, I should be able to:

1. Create a Starter Town level.
2. Create a House Interior level.
3. Place a door trigger in Starter Town.
4. Link it to the House Interior level.
5. Choose the target spawn point.
6. Exit Dev Mode.
7. Walk into the door.
8. Load into the correct target level/spawn.

---

# Phase 10 — Import, Export, Backups and Restore

## Goal

Make the editor safe for long-term project work.

## Required Export Buttons

- Export Current Level JSON
- Export Full Project JSON
- Export Asset Registry JSON
- Import Level JSON
- Import Full Project JSON
- Backup Current Data
- Restore From Backup

## Exported JSON Should Include

- Project name
- Levels
- Grid sizes
- Tile size
- Objects
- Terrain
- Collision
- Spawns
- Triggers
- Asset registry metadata
- Editor version
- Schema version
- Transparency/blocking/visibility data
- Unknown custom fields

## Import Rules

- Validate JSON before importing.
- If JSON is invalid, show a clear error.
- Do not overwrite existing data.
- Keep current project safe.
- Make a backup before importing valid JSON.
- Preserve unknown fields.

## Backup System

Create a backup before dangerous actions:

- Importing JSON
- Clearing a level
- Deleting a level
- Resizing a grid smaller
- Running schema migration
- Resetting data
- Bulk deleting selected objects
- Bulk replacing selected objects

Backup buttons:

- Create Backup
- View Backups
- Restore Backup
- Delete Backup

## Phase 10 Acceptance Test

After Phase 10, I should be able to:

1. Export a full project.
2. Import it again.
3. Create backups.
4. Restore from backup.
5. Attempt to import invalid JSON and see a safe error without losing current work.

---

# Phase 11 — Schema Versioning and Codex Coexistence

## Goal

Make the editor safe when Codex keeps changing the game.

## Required Features

Every saved/exported project should include:

```json
{
  "schemaVersion": 1,
  "editorVersion": "1.0.0"
}
```

If the schema changes later:

- Do not break old maps.
- Add migration functions.
- Make a backup before migrating.
- Show migration success/failure.
- Preserve unknown fields whenever possible.

## Codex Coexistence Rules

- Codex must not overwrite my saved level JSON files unless I explicitly ask.
- Codex must not reset my level data.
- Codex must not hard-code object layouts into WorldScene.
- Codex must not remove unknown object types from the map data.
- Codex must preserve backwards compatibility with existing level data.
- Codex must preserve unknown JSON fields when saving.
- If Codex adds a new object type, enemy type, NPC type, building, item, terrain tile, or asset, it should be added to the asset registry so I can use it in the editor.
- If Codex creates objects in code, those objects should be represented in editor data where possible.
- Any Codex-created object should be editable inside the editor.
- I must be able to move, delete, replace, or modify Codex-created assets/objects through the editor.
- Codex should work on systems and code while the editor works on world data.
- My editor-created map changes must survive future Codex updates.

## Phase 11 Acceptance Test

After Phase 11, I should be able to:

1. Save a map.
2. Ask Codex to add a new enemy type.
3. See the new enemy type appear in the asset/object registry.
4. Place it in the editor.
5. Save.
6. Ask Codex to change game code.
7. My saved map data remains intact.

---

# Phase 12 — UI Polish, Safe Mode and Shortcuts

## Goal

Make the editor easier and safer to use.

## Required UI Sections

- Top toolbar
- Asset palette
- Level selector
- Grid size selector
- Tool selector
- Layer panel
- Properties panel
- Save/export/import buttons
- Status message area

## Useful Optional Features

- Zoom in/out.
- Pan around large maps.
- Mini map.
- Search asset list.
- Filter assets by category.
- Brush size selector.
- Show/hide grid button.
- Show/hide collision button.
- Safe Mode / Read Only Mode.

## Safe Mode / Read Only Mode

Required behaviour:

- Allow me to inspect maps and objects without accidentally editing them.
- Disable placement, deletion, moving, replacing and bulk editing.
- Still allow selecting objects to view their properties.
- Clearly show when Safe Mode is active.

## Keyboard Shortcuts

Add keyboard shortcuts if possible:

- Ctrl + E = toggle Development Mode
- Ctrl + S = save
- Ctrl + Z = undo
- Ctrl + Y = redo
- Ctrl + A = select all on current layer
- Ctrl + C = copy selected
- Ctrl + X = cut selected
- Ctrl + V = paste selected
- Delete = delete selected object/selection
- Escape = deselect / close panel
- B = paint brush
- V = select/move
- E = eyedropper
- C = collision tool
- T = trigger tool

Make sure shortcuts do not break normal gameplay when Dev Mode is off.

## Phase 12 Acceptance Test

After Phase 12, I should be able to:

1. Use the editor comfortably in the browser preview.
2. Toggle grid/collision visibility.
3. Search assets.
4. Use Safe Mode to inspect without editing.
5. Use keyboard shortcuts without breaking normal gameplay.

---

# Final Expected Result

After all phases, I should be able to:

1. Open my game in the browser preview.
2. Click Dev Mode or press Ctrl + E.
3. Create a new level, for example 30x30.
4. Import or choose an asset.
5. Place grass, paths, trees, buildings, enemies, NPCs and triggers on the grid.
6. Click and drag to paint multiple tiles.
7. Click and drag to delete multiple tiles.
8. Click and drag to select multiple tiles or objects.
9. Fill, clear, copy, move, paste or replace selected areas.
10. Set each asset or placed object as solid, non-solid, blocking, transparent, visible, hidden, decorative or trigger-only.
11. Move the player freely around the world during normal gameplay.
12. Use saved collision data to stop the player walking through blocked objects.
13. Save the map.
14. Refresh the browser and see my changes still there.
15. Export the level or full project as JSON.
16. Keep using Codex to improve the game code without losing my map edits.
17. Modify Codex-created objects inside the editor.
18. Reuse this Game Dev Kit in future projects.

---

# Codex Command Template

Use this when asking Codex to build each phase.

```text
Read GAME_DEV_KIT_PLAN.md.

Only implement Phase 1.

Do not implement later phases yet.

Keep the code modular so the later phases can be added safely.

After finishing, tell me:
1. What files you changed.
2. How to test this phase.
3. Whether any existing game systems were touched.
```

For the next phase, use:

```text
Read GAME_DEV_KIT_PLAN.md.

Phase 1 is now working.

Only implement Phase 2.

Do not implement later phases yet.

Preserve all existing Phase 1 behaviour and saved data.

After finishing, tell me:
1. What files you changed.
2. How to test this phase.
3. Whether any existing game systems were touched.
```

Then change the phase number each time.