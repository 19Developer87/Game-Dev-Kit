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
  return LAYERS.reduce((layers, layerName) => {
    layers[layerName] = Array.isArray(existingLayers[layerName])
      ? existingLayers[layerName]
      : [];
    return layers;
  }, {});
}

export function createStarterLevel(overrides = {}) {
  return {
    id: STARTER_LEVEL_ID,
    name: "Starter Level",
    gridWidth: DEFAULT_GRID_SIZE,
    gridHeight: DEFAULT_GRID_SIZE,
    tileSize: DEFAULT_TILE_SIZE,
    ...overrides,
    layers: createEmptyLayers(overrides.layers),
  };
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

  const levels = Array.isArray(project.levels) && project.levels.length > 0
    ? project.levels.map((level, index) => ({
        ...createStarterLevel({
          id: level.id || (index === 0 ? STARTER_LEVEL_ID : `level-${index + 1}`),
          name: level.name || (index === 0 ? "Starter Level" : `Level ${index + 1}`),
          gridWidth: Number(level.gridWidth) || DEFAULT_GRID_SIZE,
          gridHeight: Number(level.gridHeight) || DEFAULT_GRID_SIZE,
          tileSize: Number(level.tileSize) || DEFAULT_TILE_SIZE,
        }),
        ...level,
        layers: createEmptyLayers(level.layers),
      }))
    : [createStarterLevel()];

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
