import {
  DEFAULT_GRID_SIZE,
  DEFAULT_TILE_SIZE,
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATEGORY_NAME,
  EDITOR_VERSION,
  LAYERS,
  SCHEMA_VERSION,
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
  const assetRegistry = createEmptyAssetRegistry();

  return {
    projectName: "Reusable Game Dev Kit",
    editorVersion: EDITOR_VERSION,
    schemaVersion: SCHEMA_VERSION,
    lastOpenedLevelId: STARTER_LEVEL_ID,
    levels: [createStarterLevel()],
    assetRegistry,
    assets: assetRegistry.assets,
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

  levels.forEach((level) => migrateLegacyPlacedObjects(level));

  const assetRegistry = normalizeAssetRegistry(project.assetRegistry, project.assets);

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
    assetRegistry,
    assets: assetRegistry.assets,
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

export function deleteCurrentLevel(project, levelId = project.lastOpenedLevelId) {
  if (project.levels.length <= 1) {
    return null;
  }

  const deletedLevel = project.levels.find((level) => level.id === levelId) || getCurrentLevel(project);
  const deletedIndex = project.levels.findIndex((level) => level.id === deletedLevel.id);
  project.levels = project.levels.filter((level) => level.id !== deletedLevel.id);
  const nextLevel = project.levels[deletedIndex] || project.levels[deletedIndex - 1];
  project.lastOpenedLevelId = nextLevel.id;
  return deletedLevel;
}

export function getPlacedObjects(level, layerNames = LAYERS) {
  const requestedLayers = new Set(getKnownLayerNames(layerNames));
  return LAYERS.flatMap((containingLayer) =>
    (level.layers[containingLayer] || [])
      .map((placedObject) => ({
        ...placedObject,
        layer: getEffectivePlacedObjectLayer(placedObject, containingLayer),
      }))
      .filter((placedObject) => requestedLayers.has(placedObject.layer)),
  );
}

export function findObjectsAtCell(level, x, y, layerNames = LAYERS) {
  return getPlacedObjects(level, layerNames).filter((placedObject) =>
    objectCoversCell(placedObject, x, y),
  );
}

export function removeObjectsAtCell(level, x, y, layerNames = LAYERS) {
  const removedObjects = [];
  const requestedLayers = new Set(getKnownLayerNames(layerNames));

  LAYERS.forEach((containingLayer) => {
    level.layers[containingLayer] = (level.layers[containingLayer] || []).filter((placedObject) => {
      if (
        !requestedLayers.has(getEffectivePlacedObjectLayer(placedObject, containingLayer)) ||
        !objectCoversCell(placedObject, x, y)
      ) {
        return true;
      }

      removedObjects.push(placedObject);
      return false;
    });
  });

  return removedObjects;
}

export function removePlacedObjectById(level, placedObjectId, layerNames = LAYERS) {
  let removed = null;
  const requestedLayers = new Set(getKnownLayerNames(layerNames));

  LAYERS.forEach((containingLayer) => {
    level.layers[containingLayer] = (level.layers[containingLayer] || []).filter((placedObject) => {
      if (
        placedObject.id !== placedObjectId ||
        !requestedLayers.has(getEffectivePlacedObjectLayer(placedObject, containingLayer))
      ) {
        return true;
      }

      removed = placedObject;
      return false;
    });
  });

  return removed;
}

export function findObjectsInRange(level, x, y, width = 1, height = 1, layerNames = LAYERS) {
  return getPlacedObjects(level, layerNames).filter((placedObject) =>
    rangesOverlap(
      x,
      y,
      width,
      height,
      Number(placedObject.x) || 1,
      Number(placedObject.y) || 1,
      Number(placedObject.width) || 1,
      Number(placedObject.height) || 1,
    ),
  );
}

export function removeObjectsInRange(
  level,
  x,
  y,
  width = 1,
  height = 1,
  layerNames = LAYERS,
) {
  const removedObjects = [];
  const requestedLayers = new Set(getKnownLayerNames(layerNames));

  LAYERS.forEach((containingLayer) => {
    level.layers[containingLayer] = (level.layers[containingLayer] || []).filter((placedObject) => {
      if (!requestedLayers.has(getEffectivePlacedObjectLayer(placedObject, containingLayer))) {
        return true;
      }

      const overlaps = rangesOverlap(
        x,
        y,
        width,
        height,
        Number(placedObject.x) || 1,
        Number(placedObject.y) || 1,
        Number(placedObject.width) || 1,
        Number(placedObject.height) || 1,
      );

      if (!overlaps) {
        return true;
      }

      removedObjects.push(placedObject);
      return false;
    });
  });

  return removedObjects;
}

function getKnownLayerNames(layerNames) {
  const requestedLayers =
    layerNames && typeof layerNames[Symbol.iterator] === "function"
      ? new Set(layerNames)
      : new Set(LAYERS);

  return LAYERS.filter((layerName) => requestedLayers.has(layerName));
}

function getEffectivePlacedObjectLayer(placedObject, containingLayer) {
  const explicitLayer = placedObject?.layer === "Trigger"
    ? "triggers"
    : placedObject?.layer;
  return LAYERS.includes(explicitLayer) ? explicitLayer : containingLayer;
}

function removeObjectsInRangeExcept(level, x, y, width, height, preservedObjectId) {
  LAYERS.forEach((layerName) => {
    level.layers[layerName] = (level.layers[layerName] || []).filter(
      (placedObject) =>
        placedObject.id === preservedObjectId ||
        !rangesOverlap(
          x,
          y,
          width,
          height,
          Number(placedObject.x) || 1,
          Number(placedObject.y) || 1,
          Number(placedObject.width) || 1,
          Number(placedObject.height) || 1,
        ),
    );
  });
}

function removeObjectsInRangesExcept(level, ranges, preservedIds) {
  LAYERS.forEach((layerName) => {
    level.layers[layerName] = (level.layers[layerName] || []).filter((placedObject) => {
      if (preservedIds.has(placedObject.id)) {
        return true;
      }

      return !ranges.some((range) =>
        rangesOverlap(
          range.x,
          range.y,
          range.width,
          range.height,
          Number(placedObject.x) || 1,
          Number(placedObject.y) || 1,
          Number(placedObject.width) || 1,
          Number(placedObject.height) || 1,
        ),
      );
    });
  });
}

export function placeAsset(level, asset, x, y, width = 1, height = 1) {
  removeObjectsInRange(level, x, y, width, height);
  const layerName = asset.defaultLayer || "objects";
  level.layers[layerName] = Array.isArray(level.layers[layerName]) ? level.layers[layerName] : [];
  const placedObject = {
    id: `placed-${asset.id}-${Date.now()}-${x}-${y}`,
    assetId: asset.id,
    type: asset.type || asset.id,
    name: asset.name,
    x,
    y,
    gridRef: toGridRef(x, y),
    rangeRef: toRangeRef(x, y, width, height),
    layer: layerName,
    width,
    height,
    visible: asset.visible !== false,
    transparent: asset.transparent !== false,
    solid: Boolean(asset.solid),
    blocksMovement: Boolean(asset.blocksMovement),
    collisionEnabled: Boolean(asset.collisionEnabled),
    opacity: 100,
    notes: "",
  };

  level.layers[layerName].push(placedObject);
  return placedObject;
}

export function duplicatePlacedAsset(level, sourceObject, x, y, width, height) {
  removeObjectsInRange(level, x, y, width, height);
  const storedLayer = sourceObject.layer || "objects";
  const layerName = getLayerArrayName(storedLayer);
  level.layers[layerName] = Array.isArray(level.layers[layerName]) ? level.layers[layerName] : [];
  const placedObject = {
    ...sourceObject,
    id: `placed-${sourceObject.assetId}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    x,
    y,
    gridRef: toGridRef(x, y),
    rangeRef: toRangeRef(x, y, width, height),
    layer: storedLayer,
    width,
    height,
  };

  level.layers[layerName].push(placedObject);
  return placedObject;
}

export function updatePlacedAssetBounds(level, placedObjectId, x, y, width, height) {
  let selectedObject = null;

  LAYERS.forEach((layerName) => {
    const foundObject = (level.layers[layerName] || []).find(
      (placedObject) => placedObject.id === placedObjectId,
    );

    if (foundObject) {
      selectedObject = foundObject;
    }
  });

  if (!selectedObject) {
    return null;
  }

  removeObjectsInRangeExcept(level, x, y, width, height, placedObjectId);
  selectedObject.x = x;
  selectedObject.y = y;
  selectedObject.width = width;
  selectedObject.height = height;
  selectedObject.gridRef = toGridRef(x, y);
  selectedObject.rangeRef = toRangeRef(x, y, width, height);
  return selectedObject;
}

export function updatePlacedAssetGroupBounds(level, boundsById) {
  const updates = new Map(boundsById);
  const selectedObjects = [];

  LAYERS.forEach((layerName) => {
    (level.layers[layerName] || []).forEach((placedObject) => {
      if (updates.has(placedObject.id)) {
        selectedObjects.push(placedObject);
      }
    });
  });

  if (selectedObjects.length !== updates.size) {
    return null;
  }

  const preservedIds = new Set(updates.keys());
  const targetRanges = selectedObjects.map((placedObject) => {
    const bounds = updates.get(placedObject.id);
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  });

  removeObjectsInRangesExcept(level, targetRanges, preservedIds);

  selectedObjects.forEach((placedObject) => {
    const bounds = updates.get(placedObject.id);
    placedObject.x = bounds.x;
    placedObject.y = bounds.y;
    placedObject.width = bounds.width;
    placedObject.height = bounds.height;
    placedObject.gridRef = toGridRef(bounds.x, bounds.y);
    placedObject.rangeRef = toRangeRef(bounds.x, bounds.y, bounds.width, bounds.height);
  });

  return selectedObjects;
}

export function updatePlacedAssetProperties(level, placedObjectId, properties) {
  let selectedObject = null;
  let currentLayerName = null;

  for (const layerName of LAYERS) {
    const foundObject = (level.layers[layerName] || []).find(
      (placedObject) => placedObject.id === placedObjectId,
    );

    if (foundObject) {
      selectedObject = foundObject;
      currentLayerName = layerName;
      break;
    }
  }

  if (!selectedObject) {
    return null;
  }

  const targetLayerName = normalizeKnownLayerName(properties.layer) || currentLayerName;
  const boundsChanged =
    Number(selectedObject.x) !== Number(properties.x) ||
    Number(selectedObject.y) !== Number(properties.y) ||
    Number(selectedObject.width) !== Number(properties.width) ||
    Number(selectedObject.height) !== Number(properties.height);
  if (boundsChanged) {
    removeObjectsInRangeExcept(
      level,
      properties.x,
      properties.y,
      properties.width,
      properties.height,
      placedObjectId,
    );
  }
  Object.assign(selectedObject, properties, {
    gridRef: toGridRef(properties.x, properties.y),
    rangeRef: toRangeRef(properties.x, properties.y, properties.width, properties.height),
    layer: targetLayerName,
  });

  const knownLayerMatches = LAYERS.reduce(
    (count, layerName) =>
      count +
      (level.layers[layerName] || []).filter(
        (placedObject) => placedObject.id === placedObjectId,
      ).length,
    0,
  );

  if (targetLayerName !== currentLayerName || knownLayerMatches !== 1) {
    LAYERS.forEach((layerName) => {
      level.layers[layerName] = (level.layers[layerName] || []).filter(
        (placedObject) => placedObject.id !== placedObjectId,
      );
    });
    level.layers[targetLayerName] = Array.isArray(level.layers[targetLayerName])
      ? level.layers[targetLayerName]
      : [];
    level.layers[targetLayerName].push(selectedObject);
  }

  return selectedObject;
}

function getLayerArrayName(layer) {
  return normalizeKnownLayerName(layer) || "objects";
}

function normalizeKnownLayerName(layer) {
  const normalizedLayer = layer === "Trigger" ? "triggers" : layer;
  return LAYERS.includes(normalizedLayer) ? normalizedLayer : null;
}

export function resizeCurrentLevel(project, width, height) {
  const level = getCurrentLevel(project);
  level.gridWidth = width;
  level.gridHeight = height;

  LAYERS.forEach((layerName) => {
    level.layers[layerName] = (level.layers[layerName] || []).filter(
      (placedObject) => placedObject.x <= width && placedObject.y <= height,
    );
  });
}

export function countObjectsOutsideBounds(level, width, height) {
  return getPlacedObjects(level).filter(
    (placedObject) =>
      placedObject.x > width ||
      placedObject.y > height ||
      placedObject.x + (placedObject.width || 1) - 1 > width ||
      placedObject.y + (placedObject.height || 1) - 1 > height,
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
    assetRegistry,
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

export function createAssetRegistryData(project) {
  const registry = normalizeAssetRegistry(project.assetRegistry, project.assets);

  return {
    schemaVersion: SCHEMA_VERSION,
    categories: registry.categories,
    assets: registry.assets.map((asset) => ({ ...asset })),
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

export function createEmptyAssetRegistry() {
  return {
    schemaVersion: SCHEMA_VERSION,
    categories: [],
    assets: [],
  };
}

export function normalizeAssetRegistry(assetRegistry, legacyAssets = []) {
  const registry = assetRegistry && typeof assetRegistry === "object"
    ? assetRegistry
    : {};
  const categories = Array.isArray(registry.categories) ? [...registry.categories] : [];
  const sourceAssets = Array.isArray(registry.assets)
    ? registry.assets
    : Array.isArray(legacyAssets)
      ? legacyAssets.filter((asset) => asset?.isImported)
      : [];
  const normalizedCategories = [];
  const categoriesByName = new Map();
  const categoryAliases = new Map();
  const categoryIds = new Set();
  const legacyDefaultKey = normalizeCategoryName(DEFAULT_CATEGORY_NAME);

  const categoryContainsAssets = (category) =>
    sourceAssets.some(
      (asset) =>
        asset.categoryId === category?.id ||
        normalizeCategoryName(asset.category) === normalizeCategoryName(category?.name),
    );

  const addCategory = (category, { retainForAssets = false } = {}) => {
    const name = cleanCategoryName(category?.name);

    if (!name) {
      return null;
    }

    const nameKey = normalizeCategoryName(name);
    const wasAutomaticDefault =
      nameKey === legacyDefaultKey &&
      category?.isUserCreated !== true;

    if (wasAutomaticDefault && !retainForAssets && !categoryContainsAssets(category)) {
      return null;
    }

    const existing = categoriesByName.get(nameKey);

    if (existing) {
      if (category?.id) {
        categoryAliases.set(category.id, existing);
      }
      return existing;
    }

    const preferredId = String(category?.id || slugify(name) || "category").trim();
    const id = createAvailableCategoryId(preferredId, name, categoryIds);
    const normalizedCategory = {
      id,
      name,
      isUserCreated:
        category?.isUserCreated === true ||
        (nameKey !== legacyDefaultKey && category?.isUserCreated !== false),
    };

    normalizedCategories.push(normalizedCategory);
    categoriesByName.set(nameKey, normalizedCategory);
    categoryIds.add(id);
    categoryAliases.set(id, normalizedCategory);
    if (category?.id) {
      categoryAliases.set(category.id, normalizedCategory);
    }
    return normalizedCategory;
  };

  categories.forEach((category) => addCategory(category));

  const normalizedAssets = sourceAssets
    .filter((asset) => asset?.id && asset?.name)
    .map((asset) => {
      const categoryName = cleanCategoryName(asset.category);
      let category =
        categoriesByName.get(normalizeCategoryName(categoryName)) ||
        categoryAliases.get(asset.categoryId);

      if (!category && categoryName) {
        category = addCategory(
          {
            id: asset.categoryId || slugify(categoryName),
            name: categoryName,
            isUserCreated: false,
          },
          { retainForAssets: true },
        );
      }

      return {
        defaultLayer: "objects",
        solid: false,
        transparent: true,
        visible: true,
        blocksMovement: false,
        collisionEnabled: false,
        defaultWidth: 1,
        defaultHeight: 1,
        isImported: true,
        ...asset,
        category: category?.name || "",
        categoryId: category?.id || null,
      };
    });

  return {
    schemaVersion: registry.schemaVersion || SCHEMA_VERSION,
    categories: normalizedCategories,
    assets: normalizedAssets,
  };
}

export function addAssetCategory(project, name) {
  const registry = normalizeAssetRegistry(project.assetRegistry, project.assets);
  const trimmedName = cleanCategoryName(name);

  if (!trimmedName) {
    project.assetRegistry = registry;
    project.assets = registry.assets;
    return null;
  }
  const existingCategory = registry.categories.find(
    (category) => normalizeCategoryName(category.name) === normalizeCategoryName(trimmedName),
  );

  if (existingCategory) {
    project.assetRegistry = registry;
    project.assets = registry.assets;
    return existingCategory;
  }

  const id = createUniqueCategoryId(trimmedName, registry.categories);
  const category = { id, name: trimmedName, isUserCreated: true };

  registry.categories.push(category);
  project.assetRegistry = registry;
  project.assets = registry.assets;
  return category;
}

export function findAssetCategoryByName(project, name) {
  const registry = normalizeAssetRegistry(project.assetRegistry, project.assets);
  const category = registry.categories.find(
    (candidate) => normalizeCategoryName(candidate.name) === normalizeCategoryName(name),
  ) || null;

  project.assetRegistry = registry;
  project.assets = registry.assets;
  return category;
}

export function removeEmptyAssetCategories(project) {
  const registry = normalizeAssetRegistry(project.assetRegistry, project.assets);
  const occupiedCategoryIds = new Set(registry.assets.map((asset) => asset.categoryId));
  const keptCategories = registry.categories.filter(
    (category) => occupiedCategoryIds.has(category.id),
  );
  const removedCount = registry.categories.length - keptCategories.length;

  project.assetRegistry = {
    ...registry,
    categories: keptCategories,
  };
  project.assets = project.assetRegistry.assets;
  return removedCount;
}

export function deleteAssetCategory(project, categoryId) {
  const registry = normalizeAssetRegistry(project.assetRegistry, project.assets);
  const category = registry.categories.find((candidate) => candidate.id === categoryId);

  if (!category) {
    project.assetRegistry = registry;
    project.assets = registry.assets;
    return { deleted: false, reason: "protected" };
  }

  const categoryAssets = registry.assets.filter((asset) => asset.categoryId === category.id);
  if (categoryAssets.length > 0) {
    project.assetRegistry = registry;
    project.assets = registry.assets;
    return { deleted: false, reason: "contains-assets", category, assetCount: categoryAssets.length };
  }

  project.assetRegistry = {
    ...registry,
    categories: registry.categories.filter((candidate) => candidate.id !== category.id),
  };
  project.assets = project.assetRegistry.assets;
  return { deleted: true, category };
}

export function isAssetUsedOnAnyLevel(project, assetId) {
  return project.levels.some((level) =>
    getPlacedObjects(level).some((placedObject) => placedObject.assetId === assetId),
  );
}

export function deleteImportedAsset(project, assetId) {
  const registry = normalizeAssetRegistry(project.assetRegistry, project.assets);
  const asset = registry.assets.find((candidate) => candidate.id === assetId);

  if (!asset) {
    project.assetRegistry = registry;
    project.assets = registry.assets;
    return null;
  }

  project.assetRegistry = {
    ...registry,
    assets: registry.assets.filter((candidate) => candidate.id !== assetId),
  };
  project.assets = project.assetRegistry.assets;
  return asset;
}

export function addImportedAsset(project, asset) {
  const registry = normalizeAssetRegistry(project.assetRegistry, project.assets);
  const category = registry.categories.find((candidate) => candidate.id === asset.categoryId) ||
    registry.categories.find((candidate) => candidate.name === asset.category);

  if (!category) {
    project.assetRegistry = registry;
    project.assets = registry.assets;
    throw new Error("Imported assets must be assigned to a category.");
  }
  const id = createUniqueAssetId(asset.name, registry.assets);
  const normalizedAsset = {
    id,
    name: asset.name,
    category: category.name,
    categoryId: category.id,
    src: asset.src,
    fileName: asset.fileName,
    defaultLayer: asset.defaultLayer || "objects",
    solid: Boolean(asset.solid),
    transparent: asset.transparent !== false,
    visible: asset.visible !== false,
    blocksMovement: Boolean(asset.blocksMovement),
    collisionEnabled: Boolean(asset.collisionEnabled),
    defaultWidth: Math.max(1, Number(asset.defaultWidth) || 1),
    defaultHeight: Math.max(1, Number(asset.defaultHeight) || 1),
    isImported: true,
  };

  registry.assets.push(normalizedAsset);
  project.assetRegistry = registry;
  project.assets = registry.assets;
  return normalizedAsset;
}

export function toGridRef(x, y) {
  return `${x}.${numberToLetters(y)}`;
}

export function toRangeRef(x, y, width = 1, height = 1) {
  return `${toGridRef(x, y)}:${toGridRef(x + width - 1, y + height - 1)}`;
}

export function numberToLetters(value) {
  let number = Math.max(1, Number(value) || 1);
  let letters = "";

  while (number > 0) {
    number -= 1;
    letters = String.fromCharCode(65 + (number % 26)) + letters;
    number = Math.floor(number / 26);
  }

  return letters;
}

function migrateLegacyPlacedObjects(level) {
  const objects = getPlacedObjects(level);
  const hasZeroBasedObjects = objects.some((object) => !object.gridRef && (object.x === 0 || object.y === 0));

  LAYERS.forEach((layerName) => {
    level.layers[layerName] = (level.layers[layerName] || []).map((placedObject) => {
      const width = Math.max(1, Number(placedObject.width) || 1);
      const height = Math.max(1, Number(placedObject.height) || 1);
      const x = hasZeroBasedObjects && !placedObject.gridRef
        ? Number(placedObject.x) + 1
        : Math.max(1, Number(placedObject.x) || 1);
      const y = hasZeroBasedObjects && !placedObject.gridRef
        ? Number(placedObject.y) + 1
        : Math.max(1, Number(placedObject.y) || 1);

      return {
        ...placedObject,
        x,
        y,
        width,
        height,
        gridRef: placedObject.gridRef || toGridRef(x, y),
        rangeRef: placedObject.rangeRef || toRangeRef(x, y, width, height),
        opacity: Number.isFinite(Number(placedObject.opacity))
          ? Math.max(0, Math.min(100, Math.round(Number(placedObject.opacity))))
          : 100,
        notes: typeof placedObject.notes === "string" ? placedObject.notes : "",
      };
    });
  });
}

function objectCoversCell(placedObject, x, y) {
  const startX = Number(placedObject.x) || 1;
  const startY = Number(placedObject.y) || 1;
  const width = Number(placedObject.width) || 1;
  const height = Number(placedObject.height) || 1;

  return x >= startX && x < startX + width && y >= startY && y < startY + height;
}

function rangesOverlap(aX, aY, aWidth, aHeight, bX, bY, bWidth, bHeight) {
  return (
    aX < bX + bWidth &&
    aX + aWidth > bX &&
    aY < bY + bHeight &&
    aY + aHeight > bY
  );
}

function createUniqueCategoryId(name, categories) {
  const baseId = slugify(name) || "category";
  const existingIds = new Set(categories.map((category) => category.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function createAvailableCategoryId(preferredId, name, existingIds) {
  const baseId = slugify(preferredId) || slugify(name) || "category";

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function createUniqueAssetId(name, assets) {
  const baseId = `custom-imported-${slugify(name) || "asset"}`;
  const existingIds = new Set(assets.map((asset) => asset.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanCategoryName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeCategoryName(value) {
  return cleanCategoryName(value).toLowerCase();
}
