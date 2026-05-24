export const EDITOR_VERSION = "1.0.0";
export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = "game-dev-kit-editor-project";
export const BACKUP_STORAGE_KEY = "game-dev-kit-editor-backups";
export const COPIED_LEVEL_STORAGE_KEY = "game-dev-kit-copied-level";

export const DEFAULT_TILE_SIZE = 32;
export const DEFAULT_GRID_SIZE = 30;
export const STARTER_LEVEL_ID = "starter-level";

export const LAYERS = [
  "terrain",
  "decorations",
  "objects",
  "collisions",
  "spawns",
  "items",
  "npcs",
  "enemies",
  "triggers",
  "overlay",
];

export const STARTER_ASSETS = [
  {
    id: "grass",
    name: "Grass",
    type: "terrain",
    category: "Terrain",
    defaultLayer: "terrain",
    color: "#4c9f52",
    glyph: "",
  },
  {
    id: "path",
    name: "Path",
    type: "terrain",
    category: "Terrain",
    defaultLayer: "terrain",
    color: "#a98255",
    glyph: "",
  },
  {
    id: "water",
    name: "Water",
    type: "terrain",
    category: "Terrain",
    defaultLayer: "terrain",
    color: "#3579ab",
    glyph: "",
  },
  {
    id: "tree",
    name: "Tree",
    type: "tree",
    category: "Nature",
    defaultLayer: "objects",
    color: "#276c42",
    glyph: "T",
  },
  {
    id: "rock",
    name: "Rock",
    type: "rock",
    category: "Nature",
    defaultLayer: "objects",
    color: "#7c8589",
    glyph: "R",
  },
  {
    id: "house",
    name: "House",
    type: "building",
    category: "Buildings",
    defaultLayer: "objects",
    color: "#935d49",
    glyph: "H",
  },
  {
    id: "enemy-spawn",
    name: "Enemy Spawn",
    type: "enemySpawn",
    category: "Spawns",
    defaultLayer: "enemies",
    color: "#a43d4c",
    glyph: "E",
  },
  {
    id: "npc-spawn",
    name: "NPC Spawn",
    type: "npcSpawn",
    category: "Spawns",
    defaultLayer: "npcs",
    color: "#6e64b7",
    glyph: "N",
  },
  {
    id: "item",
    name: "Item",
    type: "item",
    category: "Items",
    defaultLayer: "items",
    color: "#d5b84c",
    glyph: "I",
  },
  {
    id: "trigger",
    name: "Trigger",
    type: "trigger",
    category: "Triggers",
    defaultLayer: "triggers",
    color: "#c36fa8",
    glyph: "!",
  },
  {
    id: "collision-block",
    name: "Collision Block",
    type: "collision",
    category: "Collision",
    defaultLayer: "collisions",
    color: "#744154",
    glyph: "X",
  },
];
