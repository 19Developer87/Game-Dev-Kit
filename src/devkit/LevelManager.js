import {
  DEFAULT_GRID_SIZE,
  DEFAULT_TILE_SIZE,
  EDITOR_VERSION,
  LAYERS,
  SCHEMA_VERSION,
  STARTER_ASSETS,
  STARTER_LEVEL_ID,
} from "./EditorTypes.js";

export function createEmptyLayers(existingLayers = {}) {
  const sourceLayers =
    existingLayers && typeof existingLayers === "object" && !Array.isArray(existingLayers)
      ? existingLayers
      : {};
  const preservedLayers =
    sourceLayers && typeof sourceLayers === "object" && !Array.isArray(sourceLayers)
      ? { ...sourceLayers }
      : {};

  return LAYERS.reduce((layers, layerName) => {
    layers[layerName] = Array.isArray(sourceLayers[layerName])
      ? sourceLayers[layerName]
      : [];
    return layers;
  }, preservedLayers);
}

export function createStarterLevel(overrides = {}) {
  const id = overrides.id || STARTER_LEVEL_ID;
  return {
    id,
    name: "Starter Level",
    filename: `${id}.json`,
    gridWidth: DEFAULT_GRID_SIZE,
    gridHeight: DEFAULT_GRID_SIZE,
    tileSize: DEFAULT_TILE_SIZE,
    ...overrides,
    layers: createEmptyLayers(overrides.layers),
  };
}

export function createLevelId(name, existingLevels = []) {
  const baseId = slugify(name || "level") || "level";
  const existingIds = new Set(existingLevels.map((level) => level.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

export function createLevelFilename(id, existingLevels = [], currentLevelId = null) {
  const safeId = slugify(id || "level") || "level";
  const usedFilenames = new Set(
    existingLevels
      .filter((level) => level.id !== currentLevelId)
      .map((level) => level.filename)
      .filter(Boolean),
  );
  const baseFilename = `${safeId}.json`;

  if (!usedFilenames.has(baseFilename)) {
    return baseFilename;
  }

  let suffix = 2;
  while (usedFilenames.has(`${safeId}-${suffix}.json`)) {
    suffix += 1;
  }

  return `${safeId}-${suffix}.json`;
}

export function createStarterProject() {
  return {
    projectName: "Reusable Game Dev Kit",
    editorVersion: EDITOR_VERSION,
    schemaVersion: SCHEMA_VERSION,
    lastOpenedLevelId: STARTER_LEVEL_ID,
    levels: [createStarterLevel()],
    assets: STARTER_ASSETS,
  };
}

export function normalizeProject(project) {
  if (!project || typeof project !== "object") {
    return createStarterProject();
  }

  const sourceLevels = Array.isArray(project.levels) && project.levels.length > 0
    ? project.levels
    : [createStarterLevel()];
  const levels = [];

  sourceLevels.forEach((level, index) => {
    const id = level.id || (index === 0 ? STARTER_LEVEL_ID : `level-${index + 1}`);
    const normalizedLevel = {
      ...createStarterLevel({
        id,
        name: level.name || (index === 0 ? "Starter Level" : `Level ${index + 1}`),
        gridWidth: Number(level.gridWidth) || DEFAULT_GRID_SIZE,
        gridHeight: Number(level.gridHeight) || DEFAULT_GRID_SIZE,
        tileSize: Number(level.tileSize) || DEFAULT_TILE_SIZE,
      }),
      ...level,
      id,
      filename: level.filename || createLevelFilename(id, levels),
      layers: createEmptyLayers(level.layers),
    };

    levels.push(normalizedLevel);
  });

  const assets = Array.isArray(project.assets) && project.assets.length > 0
    ? project.assets
    : STARTER_ASSETS;

  const lastOpenedLevelId = levels.some((level) => level.id === project.lastOpenedLevelId)
    ? project.lastOpenedLevelId
    : levels[0].id;

  return {
    ...project,
    projectName: project.projectName || "Reusable Game Dev Kit",
    editorVersion: project.editorVersion || EDITOR_VERSION,
    schemaVersion: project.schemaVersion || SCHEMA_VERSION,
    lastOpenedLevelId,
    levels,
    assets,
  };
}

export function getCurrentLevel(project) {
  return (
    project.levels.find((level) => level.id === project.lastOpenedLevelId) ||
    project.levels[0]
  );
}

export function createNewLevel(project, name = "New Level") {
  const id = createLevelId(name, project.levels);
  const level = createStarterLevel({
    id,
    name,
    filename: createLevelFilename(id, project.levels),
  });

  project.levels.push(level);
  project.lastOpenedLevelId = level.id;
  return level;
}

export function switchLevel(project, levelId) {
  const level = project.levels.find((candidate) => candidate.id === levelId);

  if (!level) {
    return getCurrentLevel(project);
  }

  project.lastOpenedLevelId = level.id;
  return level;
}

export function reorderLevel(project, draggedLevelId, targetLevelId, placement = "before") {
  if (draggedLevelId === targetLevelId) {
    return project.levels;
  }

  const draggedIndex = project.levels.findIndex((level) => level.id === draggedLevelId);
  const targetIndex = project.levels.findIndex((level) => level.id === targetLevelId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return project.levels;
  }

  const [draggedLevel] = project.levels.splice(draggedIndex, 1);
  const adjustedTargetIndex = project.levels.findIndex((level) => level.id === targetLevelId);
  const insertIndex = placement === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex;
  project.levels.splice(insertIndex, 0, draggedLevel);
  return project.levels;
}

export function renameCurrentLevel(project, name) {
  const level = getCurrentLevel(project);
  level.name = name;
  return level;
}

export function duplicateCurrentLevel(project) {
  const sourceLevel = getCurrentLevel(project);
  const copiedLevel = structuredCloneFallback(sourceLevel);
  copiedLevel.id = createLevelId(`${sourceLevel.id}-copy`, project.levels);
  copiedLevel.name = `${sourceLevel.name} Copy`;
  copiedLevel.filename = createLevelFilename(copiedLevel.id, project.levels);
  copiedLevel.layers = createEmptyLayers(copiedLevel.layers);

  project.levels.push(copiedLevel);
  project.lastOpenedLevelId = copiedLevel.id;
  return copiedLevel;
}

export function deleteCurrentLevel(project) {
  if (project.levels.length <= 1) {
    return null;
  }

  const deletedLevel = getCurrentLevel(project);
  const deletedIndex = project.levels.findIndex((level) => level.id === deletedLevel.id);
  project.levels = project.levels.filter((level) => level.id !== deletedLevel.id);
  const nextLevel = project.levels[Math.max(0, deletedIndex - 1)] || project.levels[0];
  project.lastOpenedLevelId = nextLevel.id;
  return deletedLevel;
}

export function getPlacedObjects(level) {
  return LAYERS.flatMap((layerName) =>
    (level.layers[layerName] || []).map((placedObject) => ({
      ...placedObject,
      layer: placedObject.layer || layerName,
    })),
  );
}

export function findObjectsAtCell(level, x, y) {
  return getPlacedObjects(level).filter((placedObject) => placedObject.x === x && placedObject.y === y);
}

export function removeObjectsAtCell(level, x, y) {
  LAYERS.forEach((layerName) => {
    level.layers[layerName] = (level.layers[layerName] || []).filter(
      (placedObject) => placedObject.x !== x || placedObject.y !== y,
    );
  });
}

export function placeAsset(level, asset, x, y) {
  removeObjectsAtCell(level, x, y);
  const layerName = asset.defaultLayer || "objects";
  const placedObject = {
    id: `placed-${asset.id}-${Date.now()}-${x}-${y}`,
    assetId: asset.id,
    type: asset.type || asset.id,
    name: asset.name,
    x,
    y,
    layer: layerName,
    width: 1,
    height: 1,
  };

  level.layers[layerName].push(placedObject);
  return placedObject;
}

export function resizeCurrentLevel(project, width, height) {
  const level = getCurrentLevel(project);
  level.gridWidth = width;
  level.gridHeight = height;

  LAYERS.forEach((layerName) => {
    level.layers[layerName] = (level.layers[layerName] || []).filter(
      (placedObject) => placedObject.x < width && placedObject.y < height,
    );
  });
}

export function countObjectsOutsideBounds(level, width, height) {
  return getPlacedObjects(level).filter(
    (placedObject) => placedObject.x >= width || placedObject.y >= height,
  ).length;
}

export function clearCurrentLevel(project) {
  const level = getCurrentLevel(project);
  level.layers = createEmptyLayers();
}

export function createCopiedLevelData(level) {
  return createLevelFileData(level);
}

export function hasLevelContent(level) {
  const layers = createEmptyLayers(level.layers);

  return Object.values(layers).some((value) => Array.isArray(value) && value.length > 0);
}

export function pasteLevelContent(project, copiedLevelData) {
  const currentLevel = getCurrentLevel(project);
  const pastedLevel = {
    ...createLevelFileData(copiedLevelData),
    id: currentLevel.id,
    name: currentLevel.name,
    filename: currentLevel.filename,
    layers: createEmptyLayers(copiedLevelData.layers),
  };
  const currentIndex = project.levels.findIndex((level) => level.id === currentLevel.id);

  project.levels[currentIndex] = pastedLevel;
  project.lastOpenedLevelId = pastedLevel.id;
  return pastedLevel;
}

export function createProjectIndex(project) {
  const {
    assets,
    levels,
    ...projectMetadata
  } = project;

  return {
    projectName: project.projectName,
    editorVersion: project.editorVersion,
    schemaVersion: project.schemaVersion,
    lastOpenedLevelId: project.lastOpenedLevelId,
    ...projectMetadata,
    levels: project.levels.map((level) => {
      const {
        layers,
        ...levelMetadata
      } = level;

      return {
        id: level.id,
        name: level.name,
        filename: level.filename || `${level.id}.json`,
        gridWidth: level.gridWidth,
        gridHeight: level.gridHeight,
        tileSize: level.tileSize,
        ...levelMetadata,
      };
    }),
  };
}

export function createLevelFileData(level) {
  const {
    filename,
    ...levelData
  } = level;

  return {
    id: level.id,
    name: level.name,
    gridWidth: level.gridWidth,
    gridHeight: level.gridHeight,
    tileSize: level.tileSize,
    ...levelData,
    layers: createEmptyLayers(level.layers),
  };
}

function structuredCloneFallback(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
