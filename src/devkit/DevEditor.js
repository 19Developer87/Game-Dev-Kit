import { AssetPalette } from "./AssetPalette.js";
import {
  COPIED_LEVEL_STORAGE_KEY,
  LAYER_LOCKS_STORAGE_KEY,
  LAYER_VISIBILITY_STORAGE_KEY,
  LAYERS,
  PAINT_BRUSH_SIZE_STORAGE_KEY,
  PAINT_VARIANT_ASSET_IDS_STORAGE_KEY,
  PAINT_VARIANT_EXPANDED_CATEGORIES_STORAGE_KEY,
  PLACED_PROPERTIES_DIALOG_STORAGE_KEY,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from "./EditorTypes.js";
import { createEditorLayout } from "./DevEditorUI.js";
import { GridEditor } from "./GridEditor.js";
import {
  chooseProjectFolder,
  downloadProjectFiles,
  saveProjectFilesToFolder,
} from "./ImportExportManager.js";
import {
  clearCurrentLevel,
  addAssetCategory,
  addImportedAsset,
  countObjectsOutsideBounds,
  countPlacedObjectsByAssetIds,
  createAssetRegistryData,
  createCopiedLevelData,
  createLevelFileData,
  createProjectIndex,
  createNewLevel,
  deleteCurrentLevel,
  deleteAssetCategoryWithAssets,
  getCurrentLevel,
  hasLevelContent,
  pasteLevelContent,
  placeAsset,
  findObjectsInRange,
  fillAreaWithAsset,
  fillCellsWithAsset,
  fillCellsWithAssets,
  findAssetCategoryByName,
  deleteAssetCategory,
  deleteImportedAsset,
  duplicatePlacedAssetGroup,
  getPlacedObjects,
  isAssetUsedOnAnyLevel,
  movePlacedAssetGroup,
  reorderLevel,
  removeEmptyAssetCategories,
  renameCurrentLevel,
  replacePlacedObjectAssetSources,
  removeObjectsInRange,
  removeObjectsAtCell,
  removePlacedObjectById,
  removeKnownPlacedObjectsByIds,
  removePlacedObjectsByAssetIds,
  resizeCurrentLevel,
  switchLevel,
  toGridRef,
  updatePlacedAssetBounds,
  updatePlacedAssetGroupBounds,
  updatePlacedAssetProperties,
} from "./LevelManager.js";
import { createProjectBackup, loadProject, saveProject } from "./SaveManager.js";

const GRID_SIZE_PRESETS = ["10", "20", "30", "40", "50", "75", "100", "150", "200"];
const LARGE_GRID_WARNING_SIZE = 100;
const VERY_LARGE_GRID_WARNING_SIZE = 250;
const MAX_GRID_SIZE = 500;
const MIXED_VALUE = "__mixed";
const HISTORY_LIMIT = 50;
const PLAYER_SPAWN_TYPE = "playerSpawn";

class DevEditor {
  constructor(root, loaded) {
    this.root = root;
    this.project = loaded.project;
    this.startupMessage = loaded.message;
    this.selectedAsset = this.project.assets[0] || null;
    this.activeTool = "move";
    this.projectFolderHandle = null;
    this.saveQueue = Promise.resolve();
    this.copiedLevel = this.loadCopiedLevel();
    this.selectedRange = null;
    this.selectedRanges = [];
    this.isDragPaintMode = false;
    this.paintBrushSize = this.loadPaintBrushSize();
    this.paintVariantAssetIds = this.loadPaintVariantAssetIds();
    this.dragPaintSession = null;
    this.isCtrlPressed = false;
    this.selectionState = "idle";
    this.selectionConfirmationTimer = null;
    this.hoveredGridRef = null;
    this.dropPreviewRange = null;
    this.selectedPlacedObjectId = null;
    this.selectedPlacedObjectIds = new Set();
    this.copiedPlacedGroup = null;
    this.copyPreviewOrigin = null;
    this.undoStack = [];
    this.redoStack = [];
    this.isPlayModeActive = false;
    this.playModePreviousTool = this.activeTool;
    this.playModePlayerCell = null;
    this.playModeBlockedCells = new Set();
    this.playModeLastBlockedAt = 0;
    this.layerVisibility = this.loadLayerVisibility();
    this.layerLocks = this.loadLayerLocks();
    this.ui = createEditorLayout(root);
    this.sidebarWidth = this.loadSidebarWidth();
    this.isSidebarCollapsed = this.loadSidebarCollapsed();
    this.applySidebarWidth(this.sidebarWidth);
    this.applySidebarCollapsedState();

    this.gridEditor = new GridEditor({
      root: this.ui.gridStage,
      onCellClick: (cell) => this.handleCellClick(cell),
      onHoverCell: (cell) => this.handleHoverCell(cell),
      onSelectionChange: (range, state, options) => this.handleSelectionChange(range, state, options),
      onAssetDrop: (drop) => this.handleAssetDrop(drop),
      onPlacedObjectSelect: (placedObjectId) => this.selectPlacedObject(placedObjectId),
      onPlacedObjectToggleSelection: (placedObjectId) =>
        this.togglePlacedObjectSelection(placedObjectId),
      onPlacedObjectProperties: (placedObjectId) => this.openPlacedAssetProperties(placedObjectId),
      onPlacedObjectTransform: (transform) => this.transformPlacedObject(transform),
      onPlacedObjectGroupMoveStart: () => this.clearGridAreaSelection(),
      onCopyPreviewMove: (cell) => this.moveCopyPreview(cell),
      onDragPaintStart: (cell) => this.startDragPaint(cell),
      onDragPaintCell: (cell) => this.addDragPaintCell(cell),
      onDragPaintEnd: () => this.finishDragPaint(),
      onDragPaintCancel: () => this.cancelDragPaint(),
      onLockedLayerInteraction: (layerName) => {
        this.setStatus(`Layer "${layerName}" is locked.`);
      },
      onLockedAssetInteraction: () => {
        this.setStatus("This asset is locked. Double-click it to open Properties and unlock it.");
      },
      onAssetRenderError: (placedObject, asset) => {
        this.setStatus(
          `Unable to render asset "${asset?.name || placedObject.assetId}" at ${placedObject.rangeRef}.`,
        );
      },
    });
    this.gridEditor.setLayerVisibility(this.layerVisibility);
    this.gridEditor.setLayerLocks(this.layerLocks);

    this.assetPalette = new AssetPalette({
      root: this.ui.assetPalette,
      assetRegistry: this.project.assetRegistry,
      selectedAssetId: this.selectedAsset?.id || null,
      onSelect: (asset) => {
        this.selectedAsset = asset;
        this.syncAreaToolMenu();
        if (this.activeTool === "paint") {
          this.setStatus(
            this.getToolStatusMessage("paint"),
          );
        } else if (this.selectionState === "selectionReady") {
          this.setSelectionReadyStatus();
        } else {
          this.setStatus(`Selected ${asset.name}.`);
        }
      },
      onCreateCategory: () => this.createCategory(),
      onImportAsset: () => this.importAsset(),
      onCleanCategories: () => this.cleanEmptyCategories(),
      onDeleteCategory: (category) => this.deleteCategory(category),
      onDeleteAsset: (asset) => this.deleteAsset(asset),
      onDeleteSelectedAssets: (assets) => this.deleteSelectedSourceAssets(assets),
    });

    this.bindEvents();
    this.render();
    this.syncHistoryControls();
    this.setStartupStatus(this.startupMessage);
    this.setStatus(this.startupMessage);
  }

  bindEvents() {
    this.root.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        this.activateTool(button.dataset.tool);
      });
    });

    this.ui.paintBrushSize.value = String(this.paintBrushSize);
    this.ui.paintBrushSize.addEventListener("change", () => {
      this.paintBrushSize = normalizePaintBrushSize(this.ui.paintBrushSize.value);
      this.savePaintBrushSize();
      if (!this.dragPaintSession && this.activeTool === "paint") {
        this.gridEditor.updatePaintPreview([]);
      }
      this.setStatus(this.getToolStatusMessage("paint"));
      this.syncModeStatus();
    });

    this.ui.paintVariantsButton.addEventListener("click", () => {
      this.openPaintVariantsDialog();
    });

    this.ui.playModeButton.addEventListener("click", () => {
      this.togglePlayMode();
    });

    this.ui.addPlayerSpawnButton.addEventListener("click", () => {
      this.addOrMovePlayerSpawn();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Control" || this.isCtrlPressed) {
        return;
      }
      this.setCtrlPressed(true);
    });

    window.addEventListener("keyup", (event) => {
      if (event.key !== "Control") {
        return;
      }
      this.setCtrlPressed(false);
    });

    window.addEventListener("blur", () => {
      this.setCtrlPressed(false);
    });

    this.ui.sidebarToggle.addEventListener("click", () => {
      this.toggleSidebarCollapsed();
    });

    this.ui.layerVisibilityInputs.forEach((input) => {
      input.addEventListener("change", () => {
        this.setLayerVisibility(input.dataset.layer, input.checked);
      });
    });

    this.ui.layerLockInputs.forEach((input) => {
      input.addEventListener("change", () => {
        this.setLayerLocked(input.dataset.layer, input.checked);
      });
    });

    this.root.querySelector('[data-action="show-all-layers"]').addEventListener("click", () => {
      this.showAllLayers();
    });

    this.root.querySelector('[data-action="unlock-all-layers"]').addEventListener("click", () => {
      this.unlockAllLayers();
    });

    document.addEventListener("keydown", (event) => {
      if (
        isEditableTarget(event.target) ||
        document.querySelector("dialog[open]") ||
        this.root.querySelector("[data-menu][open], [data-role='level-picker'].is-open")
      ) {
        return;
      }

      if (this.isPlayModeActive) {
        if (this.handlePlayModeKeyDown(event)) {
          return;
        }
        event.preventDefault();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        if (event.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        this.redo();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "x" &&
        this.activeTool === "move" &&
        (this.selectedPlacedObjectId || this.selectedPlacedObjectIds.size > 0)
      ) {
        event.preventDefault();
        this.startCutPlacement();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "d" &&
        this.activeTool === "move" &&
        (this.selectedPlacedObjectId || this.selectedPlacedObjectIds.size > 0)
      ) {
        event.preventDefault();
        this.duplicateSelectedPlacedAssets();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "c" &&
        this.activeTool === "move" &&
        (this.selectedPlacedObjectId || this.selectedPlacedObjectIds.size > 0)
      ) {
        event.preventDefault();
        this.startCopyPlacement();
        return;
      }

      const hotkeyTool = {
        q: "move",
        w: "paint",
        e: "delete",
      }[event.key.toLowerCase()];

      if (hotkeyTool && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.activateTool(hotkeyTool);
        return;
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        this.activeTool === "move"
      ) {
        if (this.selectedRanges.length > 0 && this.selectionState === "selectionReady") {
          event.preventDefault();
          this.deleteAssetsInSelectedRange();
          return;
        }

        if (this.selectedPlacedObjectIds.size > 0 || this.selectedPlacedObjectId) {
          event.preventDefault();
          this.deleteSelectedPlacedObjects();
          return;
        }

        if (this.selectedRange && this.selectionState === "selectionReady") {
          event.preventDefault();
          this.deleteAssetsInSelectedRange();
          return;
        }
      }

      if (event.key === "Escape") {
        if (this.dragPaintSession) {
          event.preventDefault();
          this.cancelDragPaint({ showStatus: true });
          return;
        }

        if (this.copiedPlacedGroup) {
          event.preventDefault();
          const cancelledMode = this.copiedPlacedGroup.mode;
          this.cancelCopyPlacement();
          this.render();
          this.setStatus(
            cancelledMode === "cut"
              ? "Cut placement cancelled. Original assets were unchanged."
              : "Copy placement cancelled.",
          );
          return;
        }

        const hadSelection = this.selectedPlacedObjectIds.size > 0 || this.selectedRange;
        this.clearSelection();
        this.clearPlacedObjectSelection();
        this.render();
        this.setStatus(hadSelection ? "Selection cleared." : "Nothing selected.");
      }
    });

    this.root.querySelector('[data-action="save"]').addEventListener("click", async () => {
      await this.saveProjectFiles({ forceFolderPicker: false });
    });

    this.root
      .querySelector('[data-action="choose-project-folder"]')
      .addEventListener("click", async () => {
        await this.saveProjectFiles({ forceFolderPicker: true });
      });

    this.root.querySelector('[data-action="save-as-folder"]').addEventListener("click", async () => {
      await this.saveProjectFiles({ forceFolderPicker: true });
    });

    this.root.querySelector('[data-action="copy-level"]').addEventListener("click", () => {
      this.copyCurrentLevel();
      this.closeMenus();
    });

    this.ui.undoButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.undo();
        this.closeMenus();
      });
    });

    this.ui.redoButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.redo();
        this.closeMenus();
      });
    });

    this.root.querySelector('[data-action="paste-level"]').addEventListener("click", async () => {
      await this.pasteCopiedLevel();
      this.closeMenus();
    });

    this.ui.copySelectedAssetsButton.addEventListener("click", () => {
      this.startCopyPlacement();
      this.closeMenus();
    });

    this.ui.cutSelectedAssetsButton.addEventListener("click", () => {
      this.startCutPlacement();
      this.closeMenus();
    });

    this.ui.duplicateSelectedAssetsButton.addEventListener("click", async () => {
      await this.duplicateSelectedPlacedAssets();
      this.closeMenus();
    });

    this.ui.fillSelectedAreaButton.addEventListener("click", async () => {
      await this.fillSelectedArea();
      this.closeMenus();
    });

    this.ui.clearSelectedAreaButton.addEventListener("click", () => {
      this.clearSelectedArea();
      this.closeMenus();
    });

    this.ui.replaceMatchingAssetsButton.addEventListener("click", async () => {
      await this.replaceMatchingAssetsInSelectedArea();
      this.closeMenus();
    });

    this.root
      .querySelector('[data-action="placed-asset-properties"]')
      .addEventListener("click", () => {
        this.openPlacedAssetProperties();
        this.closeMenus();
      });

    this.root
      .querySelector('[data-action="edit-placed-asset-properties"]')
      .addEventListener("click", () => {
        this.openPlacedAssetProperties();
        this.closeMenus();
      });

    this.ui.levelPickerButton.addEventListener("click", () => {
      this.ui.levelPicker.classList.toggle("is-open");
    });

    this.root.querySelector('[data-action="create-level"]').addEventListener("click", async () => {
      const name = await this.showPromptModal({
        title: "Create New Level",
        label: "Level name",
        value: "New Level",
        confirmLabel: "Create Level",
      });

      if (!name?.trim()) {
        this.setStatus("Create level cancelled.");
        return;
      }

      const level = createNewLevel(this.project, name.trim());
      this.clearSelection();
      this.clearPlacedObjectSelection();
      this.autosave(`Created ${level.name}.`);
      this.render();
    });

    this.root.querySelector('[data-action="rename-level"]').addEventListener("click", async () => {
      const level = getCurrentLevel(this.project);
      const name = await this.showPromptModal({
        title: "Rename Level",
        label: "Level name",
        value: level.name,
        confirmLabel: "Rename Level",
      });

      if (!name?.trim()) {
        this.setStatus("Rename cancelled.");
        return;
      }

      renameCurrentLevel(this.project, name.trim());
      this.autosave(`Renamed level to ${name.trim()}.`);
      this.render();
    });

    this.root.querySelector('[data-action="delete-level"]').addEventListener("click", async () => {
      await this.openDeleteLevelConfirmation();
    });

    this.root.querySelector('[data-action="clear"]').addEventListener("click", async () => {
      const confirmed = await this.showConfirmModal({
        title: "Clear Level?",
        message: "Clear every placed asset from the current level?",
        confirmLabel: "Clear Level",
        danger: true,
      });

      if (!confirmed) {
        return;
      }
      const historySnapshot = this.captureHistorySnapshot();
      clearCurrentLevel(this.project);
      this.clearSelection();
      this.clearPlacedObjectSelection();
      this.pushHistoryEntry("Clear level", historySnapshot);
      this.autosave("Cleared the current level and saved the empty grid.");
      this.render();
    });

    this.bindMenuBehavior();
    this.bindSidebarResize();

    this.ui.gridSize.addEventListener("change", async () => {
      const value = this.ui.gridSize.value;
      this.ui.customSize.classList.toggle("is-visible", value === "custom");

      if (value !== "custom") {
        const size = Number(value);
        await this.resizeGrid(size, size);
      }
    });

    this.root
      .querySelector('[data-action="apply-custom-size"]')
      .addEventListener("click", async () => {
        const width = Number(this.ui.customWidth.value);
        const height = Number(this.ui.customHeight.value);

        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
          this.setStatus("Enter a custom width and height of at least 1.");
          return;
        }

        await this.resizeGrid(width, height);
      });
  }

  async handleCellClick({ x, y, additive = false }) {
    const level = getCurrentLevel(this.project);

    if (this.activeTool === "move") {
      if (this.copiedPlacedGroup) {
        await this.pasteCopiedPlacedAssetAt(x, y);
        return;
      }

      if (additive) {
        if (this.selectedPlacedObjectIds.size > 0) {
          this.setStatus(`Selected ${this.selectedPlacedObjectIds.size} asset${this.selectedPlacedObjectIds.size === 1 ? "" : "s"}.`);
        }
        return;
      }

      if (!additive && this.selectedRanges.length > 0) {
        this.clearSelection();
        this.render();
        this.setStatus("Multi-area selection cleared.");
        return;
      }

      if (this.selectedPlacedObjectIds.size > 0 || this.selectedPlacedObjectId) {
        this.clearSelection();
        this.clearPlacedObjectSelection();
        this.render();
        this.setStatus("Selection cleared.");
        return;
      }
    }

    if (this.activeTool === "delete") {
      const historySnapshot = this.captureHistorySnapshot();
      const removedObjects = removeObjectsAtCell(
        level,
        x,
        y,
        this.getEditableLayerNames(),
        (placedObject) => placedObject.editorLocked !== true,
      );
      if (removedObjects.length === 0) {
        const protectedObject = findObjectsInRange(level, x, y, 1, 1).find(
          (placedObject) =>
            this.isLayerLocked(placedObject.layer) ||
            placedObject.editorLocked === true,
        );
        this.setStatus(
          protectedObject
            ? this.getPlacedObjectLockMessage(protectedObject)
            : `No placed asset at ${toGridRef(x, y)}.`,
        );
        this.render();
        return;
      }

      this.clearPlacedObjectSelection();
      this.closePlacedPropertiesDialog();
      this.pushHistoryEntry("Delete assets", historySnapshot);
      this.autosave(createDeletedPlacedAssetsMessage(removedObjects.length));
      this.render();
      return;
    }

    if (this.selectionState === "selectionReady" && this.selectedRange) {
      if (!rangeContains(this.selectedRange, x, y)) {
        this.clearSelection();
        this.setStatus("Selection cleared. Click a cell to place, or drag to select an area.");
        return;
      }

      if (!this.selectedAsset) {
        this.setSelectionReadyStatus();
        return;
      }

      await this.placeAssetInRange(this.selectedAsset, this.selectedRange, "selection");
      return;
    }

    if (!this.selectedAsset) {
      this.setStatus("Import or select an asset before placing.");
      return;
    }

    await this.placeAssetInRange(this.selectedAsset, { x, y, width: 1, height: 1 }, "cell");
  }

  handleHoverCell({ x, y, gridRef, isDropTarget = false }) {
    this.hoveredGridRef = gridRef;
    this.dropPreviewRange = isDropTarget ? this.getPlacementRangeForCell(x, y) : null;
    this.syncCoordinateStatus();

    if (isDropTarget) {
      this.gridEditor.updateDropPreview(this.dropPreviewRange);
    }

    if (this.activeTool === "paint" && !this.dragPaintSession) {
      this.updatePaintBrushFootprintPreview({ x, y });
    }
  }

  handleSelectionChange(range, state, options = {}) {
    const isAdditiveSelection = Boolean(options.additive);
    const hadPlacedObjectSelection = this.activeTool === "move" && this.selectedPlacedObjectIds.size > 0;
    const previousSelectedRange = this.selectedRange;
    this.selectedRange = range;
    this.selectionState = state;
    this.dropPreviewRange = null;
    if (hadPlacedObjectSelection && !isAdditiveSelection) {
      this.clearPlacedObjectSelection();
    }
    this.syncCoordinateStatus();

    if (this.selectionConfirmationTimer) {
      window.clearTimeout(this.selectionConfirmationTimer);
      this.selectionConfirmationTimer = null;
    }

    if (state === "draggingSelection") {
      if (this.activeTool === "delete") {
        this.setStatus(`Delete area: ${formatRange(range)}.`);
      } else if (isAdditiveSelection) {
        const previewRanges = [...this.selectedRanges, range];
        this.setStatus(this.createMultiAreaSelectionStatus(previewRanges));
      }
      return;
    }

    this.syncPlacementButton();
    this.gridEditor.updateSelection(this.selectedRanges.length > 0 ? null : this.selectedRange);
    this.gridEditor.updateDropPreview(null);

    if (this.activeTool === "delete") {
      if (state === "selectionReady") {
        if (isAdditiveSelection) {
          this.addSelectedArea(range);
          this.setStatus(this.createMultiAreaSelectionStatus());
        } else {
          this.deleteAssetsInRange(range, { clearSelection: true });
        }
      }
      return;
    }

    if (state === "selectionReady") {
      if (isAdditiveSelection) {
        this.addSelectedArea(range, { seedRange: previousSelectedRange });
        this.syncPlacedObjectSelectionForSelectedAreas(undefined, { additive: true });
        this.refreshPlacedAssetMarkers();
        this.setStatus(this.createMultiAreaSelectionStatus());
        return;
      }

      this.selectedRanges = [];
      this.gridEditor.updateMultiSelections([]);
      this.gridEditor.updateSelection(this.selectedRange);
      this.syncCoordinateStatus();
      const selectedObjects = findObjectsInRange(
        getCurrentLevel(this.project),
        range.x,
        range.y,
        range.width,
        range.height,
        this.getEditableLayerNames(),
      ).filter((placedObject) => this.canSelectPlacedObject(placedObject));
      if (selectedObjects.length > 0) {
        this.setPlacedObjectSelection(
          selectedObjects.map((placedObject) => placedObject.id),
          selectedObjects[0].id,
        );
        this.render();
        this.setStatus(`Selected area: ${formatRange(range)} — ${selectedObjects.length} asset${selectedObjects.length === 1 ? "" : "s"}.`);
        return;
      }

      if (hadPlacedObjectSelection) {
        this.render();
      }
      this.setSelectionReadyStatus();
    }
  }

  async handleAssetDrop({ assetId, x, y }) {
    const asset = this.project.assets.find((candidate) => candidate.id === assetId);

    if (!asset) {
      this.setStatus("Dropped asset was not found in the registry.");
      return;
    }

    this.selectedAsset = asset;
    if (this.selectedRanges.length > 1) {
      this.dropPreviewRange = null;
      this.gridEditor.updateDropPreview(null);
      this.setStatus("Use Fill Selected Area to place assets into multiple selected areas.");
      return;
    }

    if (this.selectedRange && !rangeContains(this.selectedRange, x, y)) {
      this.clearSelection();
    }
    const range = this.getPlacementRangeForCell(x, y);
    this.dropPreviewRange = null;
    await this.placeAssetInRange(asset, range, "drop");
  }

  activateTool(tool) {
    if (!["move", "paint", "delete"].includes(tool)) {
      return;
    }

    if (this.isPlayModeActive) {
      this.setStatus("Exit Play Mode before changing editor tools.");
      return;
    }

    this.activeTool = tool;
    this.isDragPaintMode = tool === "paint";
    if (tool !== "paint") {
      this.cancelDragPaint();
    }
    if (tool !== "move" && this.copiedPlacedGroup) {
      this.cancelCopyPlacement();
    }
    if (tool === "delete" || tool === "paint") {
      this.clearSelection();
    }
    if (tool !== "move") {
      this.clearPlacedObjectSelection();
    }
    this.gridEditor.setInteractionMode(tool === "paint" ? "move" : tool);
    this.gridEditor.setDragPaintModeActive(this.isDragPaintMode);
    this.syncToolButtons();
    this.syncModeStatus();
    this.render();
    this.setStatus(this.getToolStatusMessage(tool));
  }

  togglePlayMode() {
    if (this.isPlayModeActive) {
      this.stopPlayMode();
      return;
    }

    this.startPlayMode();
  }

  startPlayMode() {
    if (this.isPlayModeActive) {
      return;
    }

    const level = getCurrentLevel(this.project);
    if (!level) {
      this.setStatus("No level available for Play Mode.");
      return;
    }

    this.playModePreviousTool = this.activeTool;
    this.closeMenus();
    this.closeLevelPicker();
    this.cancelDragPaint();
    this.cancelCopyPlacement();
    this.clearSelection();
    this.clearPlacedObjectSelection();
    this.playModeBlockedCells = this.createPlayModeBlockedCellSet(level);
    this.playModePlayerCell = this.findPlayModeSpawnCell(level, this.playModeBlockedCells);
    this.isPlayModeActive = true;
    this.gridEditor.setPlayModeActive(true);
    this.gridEditor.updateSelection(null);
    this.gridEditor.updateMultiSelections([]);
    this.gridEditor.updateDropPreview(null);
    this.gridEditor.updatePaintPreview([]);
    this.gridEditor.updatePlayModePlayer(this.playModePlayerCell);
    this.syncPlayModeControls();
    this.syncHistoryControls();
    this.syncAssetMenu();
    this.syncAreaToolMenu();
    this.setStatus("Play Mode started. Use WASD or arrow keys to move. Press Esc to exit Play Mode.");
    this.render();
  }

  stopPlayMode() {
    if (!this.isPlayModeActive) {
      return;
    }

    this.isPlayModeActive = false;
    this.playModePlayerCell = null;
    this.playModeBlockedCells = new Set();
    this.gridEditor.setPlayModeActive(false);
    this.activeTool = ["move", "paint", "delete"].includes(this.playModePreviousTool)
      ? this.playModePreviousTool
      : "move";
    this.isDragPaintMode = this.activeTool === "paint";
    this.gridEditor.setInteractionMode(this.activeTool === "paint" ? "move" : this.activeTool);
    this.gridEditor.setDragPaintModeActive(this.isDragPaintMode);
    this.syncPlayModeControls();
    this.render();
    this.setStatus("Play Mode ended.");
  }

  handlePlayModeKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      this.stopPlayMode();
      return true;
    }

    const direction = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
    }[event.key.length === 1 ? event.key.toLowerCase() : event.key];

    if (!direction) {
      return false;
    }

    event.preventDefault();
    this.movePlayModePlayer(direction);
    return true;
  }

  movePlayModePlayer(direction) {
    if (!this.playModePlayerCell) {
      return;
    }

    const level = getCurrentLevel(this.project);
    const nextCell = {
      x: this.playModePlayerCell.x + direction.x,
      y: this.playModePlayerCell.y + direction.y,
    };

    if (
      nextCell.x < 1 ||
      nextCell.y < 1 ||
      nextCell.x > level.gridWidth ||
      nextCell.y > level.gridHeight ||
      this.playModeBlockedCells.has(this.createPlayModeCellKey(nextCell.x, nextCell.y))
    ) {
      this.reportPlayModeBlocked();
      return;
    }

    this.playModePlayerCell = nextCell;
    this.gridEditor.updatePlayModePlayer(nextCell);
    this.ui.coordinateStatus.textContent = `Play: ${toGridRef(nextCell.x, nextCell.y)}`;
  }

  reportPlayModeBlocked() {
    const now = Date.now();
    if (now - this.playModeLastBlockedAt < 450) {
      return;
    }
    this.playModeLastBlockedAt = now;
    this.setStatus("Blocked.");
  }

  createPlayModeBlockedCellSet(level) {
    const blockedCells = new Set();
    getPlacedObjects(level).forEach((placedObject) => {
      if (placedObject.blocksMovement !== true) {
        return;
      }

      const startX = Number(placedObject.x) || 1;
      const startY = Number(placedObject.y) || 1;
      const width = Math.max(1, Number(placedObject.width) || 1);
      const height = Math.max(1, Number(placedObject.height) || 1);
      for (let y = startY; y < startY + height; y += 1) {
        for (let x = startX; x < startX + width; x += 1) {
          if (x >= 1 && y >= 1 && x <= level.gridWidth && y <= level.gridHeight) {
            blockedCells.add(this.createPlayModeCellKey(x, y));
          }
        }
      }
    });
    return blockedCells;
  }

  findPlayModeSpawnCell(level, blockedCells) {
    const playerSpawns = this.getPlayerSpawnMarkers(level);
    if (playerSpawns.length > 0) {
      if (playerSpawns.length > 1) {
        this.setStatus("Multiple Player Spawns found. Using first spawn.");
      }
      const playerSpawn = playerSpawns[0];
      return {
        x: clamp(Number(playerSpawn.x) || 1, 1, level.gridWidth),
        y: clamp(Number(playerSpawn.y) || 1, 1, level.gridHeight),
      };
    }

    const placedObjects = getPlacedObjects(level);
    const spawnObject = placedObjects.find((placedObject) => {
      const layer = normalizePlacedLayer(placedObject.layer);
      const searchable = [
        placedObject.type,
        placedObject.name,
        placedObject.assetId,
        placedObject.layer,
      ].filter(Boolean).join(" ").toLowerCase();
      return layer === "spawns" && searchable.includes("player");
    }) || placedObjects.find((placedObject) => {
      const layer = normalizePlacedLayer(placedObject.layer);
      const searchable = [
        placedObject.type,
        placedObject.name,
        placedObject.assetId,
        placedObject.layer,
      ].filter(Boolean).join(" ").toLowerCase();
      return layer === "spawns" || searchable.includes("spawn");
    });

    if (spawnObject) {
      const spawnCell = {
        x: clamp(Number(spawnObject.x) || 1, 1, level.gridWidth),
        y: clamp(Number(spawnObject.y) || 1, 1, level.gridHeight),
      };
      if (!blockedCells.has(this.createPlayModeCellKey(spawnCell.x, spawnCell.y))) {
        return spawnCell;
      }
    }

    return this.findFirstNonBlockedCell(level, blockedCells);
  }

  findFirstNonBlockedCell(level, blockedCells) {
    for (let y = 1; y <= level.gridHeight; y += 1) {
      for (let x = 1; x <= level.gridWidth; x += 1) {
        if (!blockedCells.has(this.createPlayModeCellKey(x, y))) {
          return { x, y };
        }
      }
    }
    return { x: 1, y: 1 };
  }

  createPlayModeCellKey(x, y) {
    return `${x},${y}`;
  }

  addOrMovePlayerSpawn() {
    if (this.isPlayModeActive) {
      this.setStatus("Exit Play Mode before adding a Player Spawn.");
      return false;
    }

    if (this.layerLocks.spawns === true) {
      this.setStatus('Layer "spawns" is locked.');
      return false;
    }

    const level = getCurrentLevel(this.project);
    const targetCell = this.getPlayerSpawnPlacementCell(level);
    const existingSpawns = this.getPlayerSpawnMarkers(level);
    const historySnapshot = this.captureHistorySnapshot();

    level.layers.spawns = Array.isArray(level.layers.spawns) ? level.layers.spawns : [];
    if (existingSpawns.length > 0) {
      const [primarySpawn] = existingSpawns;
      primarySpawn.x = targetCell.x;
      primarySpawn.y = targetCell.y;
      primarySpawn.width = 1;
      primarySpawn.height = 1;
      primarySpawn.gridRef = toGridRef(targetCell.x, targetCell.y);
      primarySpawn.rangeRef = `${primarySpawn.gridRef}:${primarySpawn.gridRef}`;
      primarySpawn.layer = "spawns";
      primarySpawn.type = PLAYER_SPAWN_TYPE;
      primarySpawn.markerType = PLAYER_SPAWN_TYPE;
      primarySpawn.name = "Player Spawn";
      primarySpawn.visible = primarySpawn.visible !== false;
      primarySpawn.blocksMovement = false;
      primarySpawn.collisionEnabled = false;
      level.layers.spawns = level.layers.spawns.filter((placedObject) =>
        placedObject.id === primarySpawn.id || !this.isPlayerSpawnMarker(placedObject),
      );
      this.setPlacedObjectSelection([primarySpawn.id], primarySpawn.id);
      this.render();
      this.pushHistoryEntry("Move player spawn", historySnapshot);
      this.autosave(`Moved Player Spawn to ${primarySpawn.gridRef}.`);
      return true;
    }

    const spawn = this.createPlayerSpawnMarker(targetCell.x, targetCell.y);
    level.layers.spawns.push(spawn);
    this.setPlacedObjectSelection([spawn.id], spawn.id);
    this.render();
    this.pushHistoryEntry("Add player spawn", historySnapshot);
    this.autosave(`Added Player Spawn at ${spawn.gridRef}.`);
    return true;
  }

  getPlayerSpawnPlacementCell(level) {
    const selectedArea = this.getSelectedAreaRanges()[0] || this.selectedRange;
    if (selectedArea) {
      return {
        x: clamp(Number(selectedArea.x) || 1, 1, level.gridWidth),
        y: clamp(Number(selectedArea.y) || 1, 1, level.gridHeight),
      };
    }

    const blockedCells = this.createPlayModeBlockedCellSet(level);
    return this.findFirstNonBlockedCell(level, blockedCells);
  }

  createPlayerSpawnMarker(x, y) {
    const gridRef = toGridRef(x, y);
    return {
      id: `player-spawn-${Date.now()}-${x}-${y}`,
      type: PLAYER_SPAWN_TYPE,
      markerType: PLAYER_SPAWN_TYPE,
      name: "Player Spawn",
      x,
      y,
      gridRef,
      rangeRef: `${gridRef}:${gridRef}`,
      layer: "spawns",
      width: 1,
      height: 1,
      visible: true,
      transparent: true,
      solid: false,
      blocksMovement: false,
      collisionEnabled: false,
      opacity: 100,
      notes: "",
    };
  }

  getPlayerSpawnMarkers(level) {
    return getPlacedObjects(level).filter((placedObject) => this.isPlayerSpawnMarker(placedObject));
  }

  isPlayerSpawnMarker(placedObject) {
    if (!placedObject) {
      return false;
    }
    const layer = normalizePlacedLayer(placedObject.layer);
    return (
      layer === "spawns" &&
      (
        placedObject.type === PLAYER_SPAWN_TYPE ||
        placedObject.markerType === PLAYER_SPAWN_TYPE ||
        String(placedObject.name || "").toLowerCase() === "player spawn"
      )
    );
  }

  selectPlacedObject(placedObjectId) {
    if (this.activeTool !== "move") {
      return;
    }

    const placedObject = getPlacedObjects(
      getCurrentLevel(this.project),
      this.getEditableLayerNames(),
    ).find((candidate) => candidate.id === placedObjectId);
    if (!placedObject) {
      const unavailableObject = getPlacedObjects(getCurrentLevel(this.project)).find(
        (candidate) => candidate.id === placedObjectId,
      );
      this.setStatus(
        unavailableObject
          ? this.getPlacedObjectLockMessage(unavailableObject)
          : "That asset is on a hidden editor layer.",
      );
      return;
    }

    this.cancelCopyPlacement();
    this.clearSelection();
    this.setPlacedObjectSelection([placedObjectId], placedObjectId);
    this.render();
    this.setStatus(
      placedObject.editorLocked === true
        ? "Locked placed asset selected. Open Properties to unlock it."
        : "Placed asset selected. Drag to move or use a handle to resize.",
    );
  }

  togglePlacedObjectSelection(placedObjectId) {
    if (this.activeTool !== "move") {
      return;
    }

    const level = getCurrentLevel(this.project);
    const placedObject = getPlacedObjects(level).find(
      (candidate) => candidate.id === placedObjectId,
    );
    if (!placedObject || !this.canSelectPlacedObject(placedObject)) {
      this.setStatus(
        placedObject
          ? this.getPlacedObjectLockMessage(placedObject)
          : "Unable to select that placed asset.",
      );
      return;
    }

    this.cancelCopyPlacement();
    this.clearGridAreaSelection();
    const nextSelection = new Set(this.selectedPlacedObjectIds);
    if (nextSelection.has(placedObjectId)) {
      nextSelection.delete(placedObjectId);
      const nextIds = Array.from(nextSelection);
      this.setPlacedObjectSelection(
        nextIds,
        this.selectedPlacedObjectId === placedObjectId
          ? nextIds[0] || null
          : this.selectedPlacedObjectId,
      );
      this.gridEditor.syncPlacedObjectSelection(
        this.selectedPlacedObjectId,
        Array.from(this.selectedPlacedObjectIds),
      );
      this.syncAssetMenu();
      this.setStatus(
        nextIds.length > 0
          ? `Removed asset from selection. Selected ${nextIds.length} asset${nextIds.length === 1 ? "" : "s"}.`
          : "Removed asset from selection.",
      );
      return;
    }

    nextSelection.add(placedObjectId);
    const nextIds = Array.from(nextSelection);
    this.setPlacedObjectSelection(nextIds, placedObjectId);
    this.gridEditor.syncPlacedObjectSelection(
      this.selectedPlacedObjectId,
      Array.from(this.selectedPlacedObjectIds),
    );
    this.syncAssetMenu();
    this.setStatus(`Selected ${nextIds.length} asset${nextIds.length === 1 ? "" : "s"}.`);
  }

  openPlacedAssetProperties(placedObjectId = this.selectedPlacedObjectId) {
    const explicitPlacedObject = arguments.length > 0;
    if (
      explicitPlacedObject &&
      this.selectedPlacedObjectIds.size > 1 &&
      this.selectedPlacedObjectIds.has(placedObjectId)
    ) {
      this.openMultiPlacedAssetProperties();
      return;
    }
    if (this.selectedPlacedObjectIds.size > 1 && !explicitPlacedObject) {
      this.openMultiPlacedAssetProperties();
      return;
    }

    if (this.activeTool !== "move" || !placedObjectId) {
      this.setStatus("Select an asset first.");
      return;
    }

    const level = getCurrentLevel(this.project);
    const placedObject = getPlacedObjects(level, this.getEditableLayerNames()).find(
      (candidate) => candidate.id === placedObjectId,
    );

    if (!placedObject) {
      const unavailableObject = getPlacedObjects(level).find(
        (candidate) => candidate.id === placedObjectId,
      );
      this.clearPlacedObjectSelection();
      this.render();
      this.setStatus(
        unavailableObject
          ? this.getPlacedObjectLockMessage(unavailableObject)
          : "Select an asset first.",
      );
      return;
    }

    this.cancelCopyPlacement();
    this.clearSelection();
    this.setPlacedObjectSelection([placedObjectId], placedObjectId);
    this.render();
    this.showPlacedAssetPropertiesDialog(level, placedObject);
  }

  showPlacedAssetPropertiesDialog(level, placedObject) {
    const sourceAsset = this.project.assets.find((asset) => asset.id === placedObject.assetId);
    const dialog = document.createElement("dialog");
    const x = Math.max(1, Number(placedObject.x) || 1);
    const y = Math.max(1, Number(placedObject.y) || 1);
    const width = Math.max(1, Number(placedObject.width) || 1);
    const height = Math.max(1, Number(placedObject.height) || 1);
    const opacity = normalizeOpacity(placedObject.opacity);
    const layer = normalizePlacedLayer(placedObject.layer);
    const layerOptions = normalizeLayerOptions(placedObject.layerOptions);
    const titleName = sourceAsset?.name || placedObject.name || placedObject.assetId;

    dialog.className = "placed-properties-dialog";
    dialog.innerHTML = `
      <form class="placed-properties-form" method="dialog">
        <header class="properties-dialog-header">
          <h2>Placed Asset Properties &mdash; ${escapeHtml(titleName)}</h2>
        </header>
        <div class="properties-scroll-content">
          <fieldset class="properties-info">
            <legend>Identity / Info</legend>
            <dl>
              <div><dt>Source asset name</dt><dd>${escapeHtml(sourceAsset?.name || placedObject.name || "-")}</dd></div>
              <div><dt>Category name</dt><dd>${escapeHtml(sourceAsset?.category || "-")}</dd></div>
            </dl>
          </fieldset>
          <div class="properties-fields">
            <fieldset class="properties-position">
              <legend>Position</legend>
              <label>Grid Ref <input name="gridRef" value="${escapeAttribute(toGridRef(x, y))}" required /></label>
              <p class="properties-hint">Position on the grid, for example 3.B or 10.F.</p>
            </fieldset>
            <fieldset>
              <legend>Size</legend>
              <label>Width <input name="width" type="number" min="1" max="${level.gridWidth}" value="${width}" required /></label>
              <label>Height <input name="height" type="number" min="1" max="${level.gridHeight}" value="${height}" required /></label>
              <p class="properties-hint">Measured in grid squares.</p>
            </fieldset>
            <fieldset>
              <legend>Display</legend>
              <label>Visible
                <select name="visible">
                  <option value="true" ${placedObject.visible !== false ? "selected" : ""}>Yes</option>
                  <option value="false" ${placedObject.visible === false ? "selected" : ""}>No</option>
                </select>
              </label>
              <label>Opacity (0 to 100) <input name="opacity" type="number" min="0" max="100" value="${opacity}" required /></label>
              <p class="properties-hint">Visibility and opacity are editor display settings for this placed copy.</p>
            </fieldset>
            <fieldset>
              <legend>Layer / Behaviour</legend>
              <label>Layer
                <select name="layer" data-role="placed-layer-select">
                  ${createLayerOptions(layer)}
                </select>
              </label>
              <label>Blocks Movement
                <select name="blocksMovement">
                  <option value="false" ${!placedObject.blocksMovement ? "selected" : ""}>No</option>
                  <option value="true" ${placedObject.blocksMovement ? "selected" : ""}>Yes</option>
                </select>
              </label>
              <label>Locked
                <select name="editorLocked">
                  <option value="false" ${placedObject.editorLocked !== true ? "selected" : ""}>No</option>
                  <option value="true" ${placedObject.editorLocked === true ? "selected" : ""}>Yes</option>
                </select>
              </label>
              <label class="properties-notes">Notes
                <textarea name="notes" rows="4">${escapeHtml(placedObject.notes || "")}</textarea>
              </label>
              <p class="properties-hint">Layer locks are controlled from View. Locked here protects only this placed copy; double-click it later to unlock it.</p>
            </fieldset>
            <fieldset class="properties-layer-options" data-role="layer-options-container">
              ${createLayerOptionsFields(layer, layerOptions)}
            </fieldset>
          </div>
          <p class="form-error" role="alert" hidden></p>
        </div>
        <div class="dialog-actions properties-dialog-actions">
          <button type="button" data-action="cancel-properties">Cancel / Close</button>
          <button type="submit">Apply / Save Changes</button>
        </div>
      </form>
    `;

    document.body.append(dialog);
    const form = dialog.querySelector("form");
    const error = dialog.querySelector(".form-error");
    const layerSelect = dialog.querySelector('[data-role="placed-layer-select"]');
    const layerOptionsContainer = dialog.querySelector('[data-role="layer-options-container"]');
    const releaseDialogBehavior = this.bindPlacedPropertiesDialogBehavior(dialog);

    layerSelect.addEventListener("change", () => {
      layerOptionsContainer.innerHTML = createLayerOptionsFields(layerSelect.value, layerOptions);
    });

    dialog.querySelector('[data-action="cancel-properties"]').addEventListener("click", () => {
      dialog.close();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const result = this.readPlacedAssetPropertyValues(data, level, placedObject);

      if (result.error) {
        error.hidden = false;
        error.textContent = result.error;
        return;
      }

      const lockedPropertiesLayer = this.isLayerLocked(result.values.layer)
        ? result.values.layer
        : this.isLayerLocked(placedObject.layer)
          ? placedObject.layer
          : null;
      if (lockedPropertiesLayer) {
        error.hidden = false;
        error.textContent = `Layer "${normalizePlacedLayer(
          lockedPropertiesLayer,
        )}" is locked. Unlock it before applying Properties changes.`;
        return;
      }

      const boundsChanged =
        Number(placedObject.x) !== result.values.x ||
        Number(placedObject.y) !== result.values.y ||
        Number(placedObject.width) !== result.values.width ||
        Number(placedObject.height) !== result.values.height;
      const overlaps = boundsChanged
        ? this.findTargetLayerOverlaps(
            level,
            {
              x: result.values.x,
              y: result.values.y,
              width: result.values.width,
              height: result.values.height,
            },
            result.values.layer,
            new Set([placedObject.id]),
          )
        : [];

      const protectedOverlap = overlaps.find((candidate) =>
        this.isPlacedObjectProtected(candidate) || !this.isLayerVisible(candidate.layer),
      );
      if (protectedOverlap) {
        error.hidden = false;
        error.textContent = `Changes were not applied because the new bounds overlap ${
          !this.isLayerVisible(protectedOverlap.layer)
            ? `hidden layer "${normalizePlacedLayer(protectedOverlap.layer)}"`
            : this.isLayerLocked(protectedOverlap.layer)
              ? `locked layer "${normalizePlacedLayer(protectedOverlap.layer)}"`
              : "an individually locked asset"
        }.`;
        return;
      }

      if (overlaps.length > 0) {
        const confirmed = await this.showConfirmModal({
          title: "Overlap Existing Assets?",
          message: this.createOverlapWarningMessage(
            "Applying these properties will overlap existing assets. Continue?",
            overlaps,
          ),
          confirmLabel: "Apply Changes",
        });

        if (!confirmed) {
          error.hidden = false;
          error.textContent = "Changes were not applied because the new bounds overlap another asset.";
          return;
        }
      }

      if (!dialog.isConnected) {
        error.hidden = false;
        error.textContent = "The properties panel was closed before changes were applied.";
        return;
      }

      const historySnapshot = this.captureHistorySnapshot();
      const updatedObject = updatePlacedAssetProperties(level, placedObject.id, result.values);
      if (!updatedObject) {
        error.hidden = false;
        error.textContent = "The selected placed asset could not be found.";
        return;
      }
      this.pushHistoryEntry("Edit asset properties", historySnapshot);

      const movedToHiddenLayer = !this.isLayerVisible(updatedObject.layer);
      if (movedToHiddenLayer || updatedObject.editorLocked === true) {
        this.clearPlacedObjectSelection();
      } else {
        this.setPlacedObjectSelection([updatedObject.id], updatedObject.id);
      }
      dialog.close();
      this.render();
      this.autosave(
        movedToHiddenLayer
          ? `Saved properties and moved ${sourceAsset?.name || updatedObject.name || "placed asset"} to hidden editor layer ${updatedObject.layer}.`
          : updatedObject.editorLocked === true
            ? `Saved properties and locked ${sourceAsset?.name || updatedObject.name || "placed asset"}. Double-click it to unlock it.`
          : `Saved properties for ${sourceAsset?.name || updatedObject.name || "placed asset"}.`,
      );
    });

    dialog.addEventListener("close", () => {
      releaseDialogBehavior();
      dialog.remove();
    });

    dialog.showModal();
    this.restorePlacedPropertiesDialogBounds(dialog);
  }

  openMultiPlacedAssetProperties() {
    if (this.activeTool !== "move" || this.selectedPlacedObjectIds.size <= 1) {
      this.setStatus("Select multiple assets first.");
      return;
    }

    const level = getCurrentLevel(this.project);
    const selection = this.getSelectedPlacedAssetsForProperties();
    if (selection.editableObjects.length > 0) {
      this.cancelCopyPlacement();
      this.clearSelection();
      this.render();
      this.showMultiPlacedAssetPropertiesDialog(level, selection);
      return;
    }

    if (selection.lockableObjects.length > 0) {
      this.openMultiPlacedAssetLockProperties();
      return;
    }

    this.setStatus("No selected assets can be edited.");
  }

  showMultiPlacedAssetPropertiesDialog(level, selection) {
    const editableObjects = selection.editableObjects;
    const lockableObjects = selection.lockableObjects;
    const layerValue = getCommonValue(editableObjects, (placedObject) =>
      normalizePlacedLayer(placedObject.layer),
    );
    const visibleValue = getCommonValue(editableObjects, (placedObject) =>
      placedObject.visible !== false,
    );
    const opacityValue = getCommonValue(editableObjects, (placedObject) =>
      normalizeOpacity(placedObject.opacity),
    );
    const blocksMovementValue = getCommonValue(editableObjects, (placedObject) =>
      Boolean(placedObject.blocksMovement),
    );
    const notesValue = getCommonValue(editableObjects, (placedObject) =>
      String(placedObject.notes || ""),
    );
    const lockValue = getCommonValue(lockableObjects, (placedObject) =>
      placedObject.editorLocked === true,
    );
    const skippedText =
      selection.protectedCount > 0
        ? `<p class="properties-hint">${selection.protectedCount} protected selected asset${selection.protectedCount === 1 ? "" : "s"} will be skipped.</p>`
        : "";
    const dialog = document.createElement("dialog");

    dialog.className = "placed-properties-dialog";
    dialog.innerHTML = `
      <form class="placed-properties-form" method="dialog">
        <header class="properties-dialog-header">
          <h2>Multi-Asset Properties &mdash; ${editableObjects.length} editable selected assets</h2>
        </header>
        <div class="properties-scroll-content">
          <fieldset class="properties-info">
            <legend>Selection</legend>
            <p class="properties-hint">Editing ${editableObjects.length} selected asset${editableObjects.length === 1 ? "" : "s"}. Only changed fields will be applied.</p>
            ${selection.lockedCount > 0 ? `<p class="properties-hint">${selection.lockedCount} individually locked selected asset${selection.lockedCount === 1 ? "" : "s"} can be unlocked with the Locked field.</p>` : ""}
            ${skippedText}
          </fieldset>
          <div class="properties-fields">
            <fieldset class="properties-position">
              <legend>Position / Size</legend>
              <p class="properties-hint">Group resize is not available yet. Select one placed asset to edit Width/Height or use single-asset resize handles.</p>
            </fieldset>
            <fieldset>
              <legend>Display</legend>
              <label>Visible
                <select name="visible" data-track-change>
                  ${createMixedBooleanOptions(visibleValue)}
                </select>
              </label>
              <label>Opacity (0 to 100)
                <input name="opacity" type="number" min="0" max="100" value="${opacityValue === MIXED_VALUE ? "" : opacityValue}" placeholder="${opacityValue === MIXED_VALUE ? "Mixed" : ""}" data-track-change />
              </label>
              <p class="properties-hint">Mixed values are preserved unless you change the field.</p>
            </fieldset>
            <fieldset>
              <legend>Layer / Behaviour</legend>
              <label>Layer
                <select name="layer" data-track-change>
                  ${createMixedLayerOptions(layerValue)}
                </select>
              </label>
              <label>Blocks Movement
                <select name="blocksMovement" data-track-change>
                  ${createMixedBooleanOptions(blocksMovementValue)}
                </select>
              </label>
              <label>Locked
                <select name="editorLocked" data-track-change>
                  ${createMixedBooleanOptions(lockValue)}
                </select>
              </label>
              <label class="properties-notes">Notes
                <textarea name="notes" rows="4" placeholder="${notesValue === MIXED_VALUE ? "Mixed" : ""}" data-track-change>${notesValue === MIXED_VALUE ? "" : escapeHtml(notesValue)}</textarea>
              </label>
              <p class="properties-hint">Layer changes use the same layer reassignment path as single-asset Properties. Layer-specific metadata is preserved.</p>
            </fieldset>
          </div>
          <p class="form-error" role="alert" hidden></p>
        </div>
        <div class="dialog-actions properties-dialog-actions">
          <button type="button" data-action="cancel-properties">Cancel / Close</button>
          <button type="submit">Apply / Save Changes</button>
        </div>
      </form>
    `;

    document.body.append(dialog);
    const form = dialog.querySelector("form");
    const error = dialog.querySelector(".form-error");
    const releaseDialogBehavior = this.bindPlacedPropertiesDialogBehavior(dialog);

    form.querySelectorAll("[data-track-change]").forEach((field) => {
      const markDirty = () => {
        field.dataset.changed = "true";
      };
      field.addEventListener("change", markDirty);
      field.addEventListener("input", markDirty);
    });

    dialog.querySelector('[data-action="cancel-properties"]').addEventListener("click", () => {
      dialog.close();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const result = this.readMultiPlacedAssetPropertyValues(new FormData(form), form);
      if (result.error) {
        error.hidden = false;
        error.textContent = result.error;
        return;
      }

      if (Object.keys(result.values).length === 0) {
        error.hidden = false;
        error.textContent = "No property changes were selected.";
        return;
      }

      const historySnapshot = this.captureHistorySnapshot();
      const applyResult = this.applyMultiPlacedAssetProperties(result.values);
      this.pushHistoryEntry("Edit selected asset properties", historySnapshot);
      dialog.close();
      this.render();
      this.autosave(this.createMultiPropertiesStatusMessage(applyResult, result.values));
    });

    dialog.addEventListener("close", () => {
      releaseDialogBehavior();
      dialog.remove();
    });

    dialog.showModal();
    this.restorePlacedPropertiesDialogBounds(dialog);
  }

  openMultiPlacedAssetLockProperties() {
    if (this.activeTool !== "move" || this.selectedPlacedObjectIds.size <= 1) {
      this.setStatus("Select multiple assets first.");
      return;
    }

    const { selectedObjects, protectedCount } = this.getSelectedPlacedAssetsForLocking();
    if (selectedObjects.length === 0) {
      this.setStatus("No selected assets can be locked or unlocked.");
      return;
    }

    const lockedCount = selectedObjects.filter((placedObject) => placedObject.editorLocked === true).length;
    const initialLockValue = lockedCount === selectedObjects.length;
    const mixedText =
      lockedCount > 0 && lockedCount < selectedObjects.length
        ? `<p class="properties-hint">Selected assets have mixed lock states. Choose Yes or No to apply one state to all editable selected assets.</p>`
        : "";
    const skippedText =
      protectedCount > 0
        ? `<p class="properties-hint">${protectedCount} protected selected asset${protectedCount === 1 ? "" : "s"} will be skipped.</p>`
        : "";
    const dialog = document.createElement("dialog");
    dialog.className = "placed-properties-dialog";
    dialog.innerHTML = `
      <form class="placed-properties-form" method="dialog">
        <header class="properties-dialog-header">
          <h2>Placed Asset Properties &mdash; ${selectedObjects.length} selected assets</h2>
        </header>
        <div class="properties-scroll-content">
          <div class="properties-fields">
            <fieldset>
              <legend>Individual Lock</legend>
              <label>Locked
                <select name="editorLocked">
                  <option value="false" ${!initialLockValue ? "selected" : ""}>No</option>
                  <option value="true" ${initialLockValue ? "selected" : ""}>Yes</option>
                </select>
              </label>
              <p class="properties-hint">This changes only the individual lock field for editable selected placed assets.</p>
              ${mixedText}
              ${skippedText}
            </fieldset>
          </div>
          <p class="form-error" role="alert" hidden></p>
        </div>
        <div class="dialog-actions properties-dialog-actions">
          <button type="button" data-action="cancel-properties">Cancel / Close</button>
          <button type="submit">Apply / Save Changes</button>
        </div>
      </form>
    `;

    document.body.append(dialog);
    const form = dialog.querySelector("form");
    const releaseDialogBehavior = this.bindPlacedPropertiesDialogBehavior(dialog);

    dialog.querySelector('[data-action="cancel-properties"]').addEventListener("click", () => {
      dialog.close();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const shouldLock = data.get("editorLocked") === "true";
      const historySnapshot = this.captureHistorySnapshot();
      const result = this.applySelectedPlacedAssetLockState(shouldLock);
      this.pushHistoryEntry(
        shouldLock ? "Lock selected assets" : "Unlock selected assets",
        historySnapshot,
      );
      dialog.close();
      this.render();
      this.autosave(this.createMultiLockStatusMessage(result, shouldLock));
    });

    dialog.addEventListener("close", () => {
      releaseDialogBehavior();
      dialog.remove();
    });

    dialog.showModal();
    this.restorePlacedPropertiesDialogBounds(dialog);
  }

  readMultiPlacedAssetPropertyValues(data, form) {
    const values = {};
    const isChanged = (name) =>
      form.elements[name]?.dataset?.changed === "true";

    if (isChanged("layer")) {
      const layer = String(data.get("layer") || "");
      if (layer && layer !== MIXED_VALUE) {
        if (!LAYERS.includes(layer)) {
          return { error: "Choose a valid layer." };
        }
        if (this.isLayerLocked(layer)) {
          return { error: `Layer "${normalizePlacedLayer(layer)}" is locked. Unlock it before applying Properties changes.` };
        }
        values.layer = layer;
      }
    }

    if (isChanged("visible")) {
      const visible = String(data.get("visible") || "");
      if (visible !== MIXED_VALUE) {
        values.visible = visible === "true";
      }
    }

    if (isChanged("opacity")) {
      const rawOpacity = String(data.get("opacity") || "").trim();
      if (rawOpacity !== "") {
        const opacity = Number(rawOpacity);
        if (!Number.isInteger(opacity) || opacity < 0 || opacity > 100) {
          return { error: "Opacity must be a whole number from 0 to 100." };
        }
        values.opacity = opacity;
      }
    }

    if (isChanged("blocksMovement")) {
      const blocksMovement = String(data.get("blocksMovement") || "");
      if (blocksMovement !== MIXED_VALUE) {
        values.blocksMovement = blocksMovement === "true";
      }
    }

    if (isChanged("editorLocked")) {
      const editorLocked = String(data.get("editorLocked") || "");
      if (editorLocked !== MIXED_VALUE) {
        values.editorLocked = editorLocked === "true";
      }
    }

    if (isChanged("notes")) {
      values.notes = String(data.get("notes") || "");
    }

    return { values };
  }

  readPlacedAssetPropertyValues(data, level, placedObject) {
    const width = Number(data.get("width"));
    const height = Number(data.get("height"));
    const opacity = Number(data.get("opacity"));
    const gridRefText = String(data.get("gridRef") || "").trim();
    const parsedGridRef = parseGridRef(gridRefText);

    if (!parsedGridRef) {
      return { error: "Grid Ref must use a valid format such as 3.B." };
    }

    const { x, y } = parsedGridRef;
    if (x < 1 || x > level.gridWidth || y < 1 || y > level.gridHeight) {
      return { error: `Position must stay inside this ${level.gridWidth}x${level.gridHeight} grid.` };
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      return { error: "Width and Height must be whole numbers of at least 1." };
    }
    if (x + width - 1 > level.gridWidth || y + height - 1 > level.gridHeight) {
      return { error: "This position and size would extend outside the grid bounds." };
    }
    if (!Number.isInteger(opacity) || opacity < 0 || opacity > 100) {
      return { error: "Opacity must be a whole number from 0 to 100." };
    }

    const rawLayer = String(data.get("layer") || "");
    const layer = rawLayer === "Trigger" ? "triggers" : rawLayer;
    if (!LAYERS.includes(layer)) {
      return { error: "Choose a valid layer." };
    }
    const previousLayerOptions = normalizeLayerOptions(placedObject.layerOptions);
    const layerSpecificOptions = readLayerSpecificOptions(data, layer);

    return {
      values: {
        x,
        y,
        width,
        height,
        layer,
        visible: data.get("visible") === "true",
        opacity,
        blocksMovement: data.get("blocksMovement") === "true",
        editorLocked: data.get("editorLocked") === "true",
        layerOptions: {
          ...previousLayerOptions,
          ...layerSpecificOptions,
        },
        notes: String(data.get("notes") || ""),
      },
    };
  }

  bindPlacedPropertiesDialogBehavior(dialog) {
    const header = dialog.querySelector(".properties-dialog-header");
    let drag = null;
    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          this.clampPlacedPropertiesDialogBounds(dialog);
          this.savePlacedPropertiesDialogBounds(dialog);
        })
      : null;

    const move = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      dialog.style.left = `${drag.left + event.clientX - drag.clientX}px`;
      dialog.style.top = `${drag.top + event.clientY - drag.clientY}px`;
      this.clampPlacedPropertiesDialogBounds(dialog);
    };

    const stop = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      header.releasePointerCapture?.(event.pointerId);
      header.classList.remove("is-dragging");
      drag = null;
      this.savePlacedPropertiesDialogBounds(dialog);
    };

    const start = (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      const rect = dialog.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        left: rect.left,
        top: rect.top,
      };
      header.classList.add("is-dragging");
      header.setPointerCapture?.(event.pointerId);
    };

    const clampOnResize = () => {
      this.clampPlacedPropertiesDialogBounds(dialog);
      this.savePlacedPropertiesDialogBounds(dialog);
    };

    header.addEventListener("pointerdown", start);
    header.addEventListener("pointermove", move);
    header.addEventListener("pointerup", stop);
    header.addEventListener("pointercancel", stop);
    window.addEventListener("resize", clampOnResize);
    resizeObserver?.observe(dialog);

    return () => {
      header.removeEventListener("pointerdown", start);
      header.removeEventListener("pointermove", move);
      header.removeEventListener("pointerup", stop);
      header.removeEventListener("pointercancel", stop);
      window.removeEventListener("resize", clampOnResize);
      resizeObserver?.disconnect();
    };
  }

  restorePlacedPropertiesDialogBounds(dialog) {
    const viewportPadding = 14;
    let savedBounds = null;
    try {
      savedBounds = JSON.parse(localStorage.getItem(PLACED_PROPERTIES_DIALOG_STORAGE_KEY));
    } catch (error) {
      console.warn("Properties panel position could not be restored.", error);
    }

    const initialRect = dialog.getBoundingClientRect();
    const bounds = savedBounds && typeof savedBounds === "object"
      ? savedBounds
      : {
          left: initialRect.left,
          top: initialRect.top,
          width: initialRect.width,
          height: initialRect.height,
        };

    dialog.style.margin = "0";
    dialog.style.left = `${Number(bounds.left) || viewportPadding}px`;
    dialog.style.top = `${Number(bounds.top) || viewportPadding}px`;
    dialog.style.width = `${Number(bounds.width) || initialRect.width}px`;
    dialog.style.height = `${Number(bounds.height) || initialRect.height}px`;
    this.clampPlacedPropertiesDialogBounds(dialog);
  }

  clampPlacedPropertiesDialogBounds(dialog) {
    const padding = 14;
    const maximumWidth = Math.max(280, window.innerWidth - padding * 2);
    const maximumHeight = Math.max(240, window.innerHeight - padding * 2);
    const minimumWidth = Math.min(420, maximumWidth);
    const minimumHeight = Math.min(320, maximumHeight);
    const rect = dialog.getBoundingClientRect();
    const width = clamp(rect.width, minimumWidth, maximumWidth);
    const height = clamp(rect.height, minimumHeight, maximumHeight);
    const left = clamp(rect.left, padding, Math.max(padding, window.innerWidth - width - padding));
    const top = clamp(rect.top, padding, Math.max(padding, window.innerHeight - height - padding));

    dialog.style.width = `${width}px`;
    dialog.style.height = `${height}px`;
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
  }

  savePlacedPropertiesDialogBounds(dialog) {
    if (!dialog.isConnected || !dialog.open) {
      return;
    }

    const rect = dialog.getBoundingClientRect();
    localStorage.setItem(
      PLACED_PROPERTIES_DIALOG_STORAGE_KEY,
      JSON.stringify({
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }),
    );
  }

  clearPlacedObjectSelection() {
    this.selectedPlacedObjectId = null;
    this.selectedPlacedObjectIds.clear();
    this.cancelCopyPlacement();
  }

  setPlacedObjectSelection(placedObjectIds, primaryPlacedObjectId = placedObjectIds[0] || null) {
    this.selectedPlacedObjectIds = new Set(placedObjectIds.filter(Boolean));
    this.selectedPlacedObjectId =
      primaryPlacedObjectId && this.selectedPlacedObjectIds.has(primaryPlacedObjectId)
        ? primaryPlacedObjectId
        : placedObjectIds[0] || null;
  }

  deleteSelectedPlacedObjects() {
    const level = getCurrentLevel(this.project);
    const selectedIds = this.selectedPlacedObjectIds.size > 0
      ? Array.from(this.selectedPlacedObjectIds)
      : [this.selectedPlacedObjectId].filter(Boolean);
    const historySnapshot = this.captureHistorySnapshot();
    const removedObjects = selectedIds
      .map((placedObjectId) =>
        removePlacedObjectById(
          level,
          placedObjectId,
          this.getEditableLayerNames(),
          (placedObject) => placedObject.editorLocked !== true,
        ),
      )
      .filter(Boolean);

    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.render();

    if (removedObjects.length === 0) {
      this.setStatus("Selected placed asset was not found.");
      return false;
    }

    this.pushHistoryEntry("Delete assets", historySnapshot);
    this.autosave(createDeletedPlacedAssetsMessage(removedObjects.length));
    return true;
  }

  deleteAssetsInSelectedRange() {
    const selectedAreas = this.getSelectedAreaRanges();
    if (selectedAreas.length === 0 || this.selectionState !== "selectionReady") {
      return false;
    }

    if (selectedAreas.length === 1) {
      return this.deleteAssetsInRange(selectedAreas[0]);
    }

    const level = getCurrentLevel(this.project);
    const selectedObjects = this.findObjectsInSelectedAreas(selectedAreas);
    const removable = selectedObjects.filter(
      (placedObject) =>
        this.isLayerVisible(placedObject.layer) &&
        !this.isPlacedObjectProtected(placedObject),
    );
    const hiddenCount = selectedObjects.filter(
      (placedObject) => !this.isLayerVisible(placedObject.layer),
    ).length;
    const lockedCount = selectedObjects.filter(
      (placedObject) =>
        this.isLayerVisible(placedObject.layer) &&
        this.isPlacedObjectProtected(placedObject),
    ).length;

    if (removable.length === 0) {
      const skippedParts = this.createSkippedAssetParts(hiddenCount, lockedCount);
      this.setStatus(
        skippedParts.length > 0
          ? `No editable visible assets deleted. ${skippedParts.join(" and ")} asset${hiddenCount + lockedCount === 1 ? " was" : "s were"} skipped.`
          : "No placed assets found in the selected areas.",
      );
      return false;
    }

    const historySnapshot = this.captureHistorySnapshot();
    const removedObjects = removeKnownPlacedObjectsByIds(
      level,
      removable.map((placedObject) => placedObject.id),
    );
    this.cancelCopyPlacement();
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.refreshPlacedAssetMarkers();
    this.pushHistoryEntry("Delete assets", historySnapshot);
    const skippedParts = this.createSkippedAssetParts(hiddenCount, lockedCount);
    this.autosave(
      `Deleted ${removedObjects.length} asset${removedObjects.length === 1 ? "" : "s"} across ${selectedAreas.length} areas.${
        skippedParts.length > 0
          ? ` ${skippedParts.join(" and ")} asset${hiddenCount + lockedCount === 1 ? " was" : "s were"} skipped.`
          : ""
      }`,
    );
    return true;
  }

  deleteAssetsInRange(range, { clearSelection = false } = {}) {
    const level = getCurrentLevel(this.project);
    const editableLayerNames = this.getEditableLayerNames();
    const matchingObjects = findObjectsInRange(
      level,
      range.x,
      range.y,
      range.width,
      range.height,
      editableLayerNames,
    ).filter((placedObject) => placedObject.editorLocked !== true);

    if (matchingObjects.length === 0) {
      if (clearSelection) {
        this.clearSelection();
        this.render();
      }
      const protectedObject = findObjectsInRange(
        level,
        range.x,
        range.y,
        range.width,
        range.height,
      ).find((placedObject) => this.isPlacedObjectProtected(placedObject));
      this.setStatus(
        protectedObject
          ? `${this.getPlacedObjectLockMessage(protectedObject)} It was protected from deletion.`
          : "No placed assets found in the selected area.",
      );
      return false;
    }

    const historySnapshot = this.captureHistorySnapshot();
    const removedObjects = removeObjectsInRange(
      level,
      range.x,
      range.y,
      range.width,
      range.height,
      editableLayerNames,
      (placedObject) => placedObject.editorLocked !== true,
    );
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    if (clearSelection) {
      this.clearSelection();
    }
    this.render();
    this.pushHistoryEntry("Delete assets", historySnapshot);
    this.autosave(createDeletedPlacedAssetsMessage(removedObjects.length));
    return true;
  }

  async transformPlacedObject(transform) {
    const { placedObjectId, x, y, width, height, action } = transform;
    if (this.activeTool !== "move") {
      return false;
    }

    const level = getCurrentLevel(this.project);
    const sourceObject = getPlacedObjects(level).find(
      (placedObject) => placedObject.id === placedObjectId,
    );
    if (!sourceObject || this.isPlacedObjectProtected(sourceObject)) {
      this.setStatus(
        sourceObject
          ? this.getPlacedObjectLockMessage(sourceObject)
          : "Unable to update the selected asset.",
      );
      this.render();
      return false;
    }

    if (action === "group-move") {
      return this.transformPlacedObjectGroup(transform);
    }

    const existing = this.findTargetLayerOverlaps(
      level,
      { x, y, width, height },
      this.getPlacedObjectTargetLayer(sourceObject),
      new Set([placedObjectId]),
    );

    if (this.blockActionForTargetLayerOverlaps(existing, "Move/resize")) {
      this.render();
      return false;
    }

    if (existing.length > 0) {
      const confirmed = await this.showConfirmModal({
        title: "Overlap Existing Assets?",
        message: this.createOverlapWarningMessage(
          "Moving/resizing this asset will overlap existing assets. Continue?",
          existing,
        ),
        confirmLabel: action === "resize" ? "Resize Asset" : "Move Asset",
      });

      if (!confirmed) {
        this.render();
        this.setStatus(`${action === "resize" ? "Resize" : "Move"} cancelled.`);
        return false;
      }
    }

    const historySnapshot = this.captureHistorySnapshot();
    const updatedObject = updatePlacedAssetBounds(level, placedObjectId, x, y, width, height);
    if (!updatedObject) {
      this.setStatus("Unable to update the selected asset.");
      this.render();
      return false;
    }

    this.setPlacedObjectSelection([placedObjectId], placedObjectId);
    this.render();
    this.pushHistoryEntry(action === "resize" ? "Resize asset" : "Move asset", historySnapshot);
    this.autosave(
      `${action === "resize" ? "Resized" : "Moved"} placed asset to ${updatedObject.rangeRef}.`,
    );
    return true;
  }

  async transformPlacedObjectGroup({ placedObjectId, placedObjectIds, boundsById }) {
    const level = getCurrentLevel(this.project);
    const selectedIds = placedObjectIds?.length
      ? placedObjectIds
      : Array.from(this.selectedPlacedObjectIds);
    const selectedIdSet = new Set(selectedIds);
    const updates = new Map(boundsById || []);

    if (selectedIds.length <= 1 || updates.size === 0) {
      return false;
    }

    const selectedObjects = getPlacedObjects(level).filter((placedObject) =>
      selectedIdSet.has(placedObject.id),
    );
    const lockedSelectedObject = selectedObjects.find((placedObject) =>
      this.isPlacedObjectProtected(placedObject),
    );
    if (lockedSelectedObject || selectedObjects.length !== selectedIds.length) {
      this.setStatus(
        lockedSelectedObject
          ? this.getPlacedObjectLockMessage(lockedSelectedObject)
          : "Unable to move the selected assets.",
      );
      this.render();
      return false;
    }

    const overlappingObjects = [];
    updates.forEach((bounds) => {
      const sourceObject = selectedObjects.find(
        (placedObject) => placedObject.id === placedObjectId,
      );
      if (!sourceObject) {
        return;
      }
      this.findTargetLayerOverlaps(
        level,
        bounds,
        this.getPlacedObjectTargetLayer(sourceObject),
        selectedIdSet,
      ).forEach(
        (candidate) => {
          if (!overlappingObjects.some((item) => item.id === candidate.id)) {
            overlappingObjects.push(candidate);
          }
        },
      );
    });

    if (overlappingObjects.length > 0) {
      if (this.blockActionForTargetLayerOverlaps(overlappingObjects, "Group move")) {
        this.render();
        return false;
      }

      const confirmed = await this.showConfirmModal({
        title: "Overlap Existing Assets?",
        message: this.createOverlapWarningMessage(
          "Moving this group will overlap existing assets. Continue?",
          overlappingObjects,
        ),
        confirmLabel: "Move Group",
      });

      if (!confirmed) {
        this.render();
        this.setStatus("Group move cancelled.");
        return false;
      }
    }

    const historySnapshot = this.captureHistorySnapshot();
    const updatedObjects = updatePlacedAssetGroupBounds(level, updates);
    if (!updatedObjects) {
      this.setStatus("Unable to update the selected assets.");
      this.render();
      return false;
    }

    this.setPlacedObjectSelection(selectedIds, placedObjectId || selectedIds[0]);
    this.render();
    this.pushHistoryEntry("Move selected assets", historySnapshot);
    this.autosave(`Moved ${updatedObjects.length} selected assets.`);
    return true;
  }

  startCopyPlacement() {
    this.startPlacedAssetPlacement("copy");
  }

  startCutPlacement() {
    this.startPlacedAssetPlacement("cut");
  }

  startPlacedAssetPlacement(mode) {
    const level = getCurrentLevel(this.project);
    const { selectedIds, selectedObjects } = this.getEligibleSelectedPlacedAssets();

    if (selectedObjects.length === 0) {
      this.setStatus(
        mode === "cut"
          ? "No unlocked visible assets selected to cut."
          : "No unlocked visible assets selected to copy.",
      );
      return;
    }

    this.copiedPlacedGroup = this.createPlacedAssetGroup(selectedObjects, mode);
    this.copyPreviewOrigin = this.getCopiedPlacementOrigin(
      this.copiedPlacedGroup.sourceOrigin.x,
      this.copiedPlacedGroup.sourceOrigin.y,
    );
    this.gridEditor.setCopyModeActive(true, mode);
    this.render();
    if (mode === "cut") {
      const skippedCount = selectedIds.length - selectedObjects.length;
      this.setStatus(
        skippedCount > 0
          ? `Cut ${selectedObjects.length} of ${selectedIds.length} selected assets. Cut mode: click grid to place, Escape to cancel.`
          : "Cut mode: click grid to place, Escape to cancel.",
      );
    } else if (selectedIds.length === 1 && selectedObjects.length === 1) {
      this.setStatus("Copied placed asset. Move over the grid and click to place; Escape cancels.");
    } else {
      this.setStatus(
        `Copied ${selectedObjects.length} of ${selectedIds.length} selected assets. Move over the grid and click to place; Escape cancels.`,
      );
    }
  }

  moveCopyPreview({ x, y }) {
    if (!this.copiedPlacedGroup || this.activeTool !== "move") {
      return;
    }

    this.copyPreviewOrigin = this.getCopiedPlacementOrigin(x, y);
    this.gridEditor.updateCopyPreviewPosition({
      ...this.copyPreviewOrigin,
      width: this.copiedPlacedGroup.width,
      height: this.copiedPlacedGroup.height,
    });
  }

  async pasteCopiedPlacedAssetAt(x, y) {
    if (!this.copiedPlacedGroup) {
      return false;
    }

    const level = getCurrentLevel(this.project);
    const origin = this.getCopiedPlacementOrigin(x, y);
    const isCut = this.copiedPlacedGroup.mode === "cut";
    const sourceIds = new Set(
      this.copiedPlacedGroup.objects.map((copy) => copy.sourceObject.id),
    );
    const targetCopies = this.copiedPlacedGroup.objects.map((copy) => ({
      sourceObject: copy.sourceObject,
      x: origin.x + copy.offsetX,
      y: origin.y + copy.offsetY,
      width: Math.max(1, Number(copy.sourceObject.width) || 1),
      height: Math.max(1, Number(copy.sourceObject.height) || 1),
    }));
    const existingById = new Map();
    targetCopies.forEach((copy) => {
      this.findTargetLayerOverlaps(
        level,
        copy,
        this.getPlacedObjectTargetLayer(copy.sourceObject),
        isCut ? sourceIds : new Set(),
      ).forEach(
        (placedObject) => {
          existingById.set(placedObject.id, placedObject);
        },
      );
    });
    const existing = Array.from(existingById.values());

    if (
      this.blockActionForTargetLayerOverlaps(
        existing,
        isCut ? "Cut group placement" : "Copied group placement",
      )
    ) {
      return false;
    }

    if (existing.length > 0) {
      const confirmed = await this.showConfirmModal({
        title: "Overlap Existing Assets?",
        message: this.createOverlapWarningMessage(
          `Placing this ${isCut ? "cut" : "copied"} ${targetCopies.length === 1 ? "asset" : "group"} will overlap existing assets. Continue?`,
          existing,
        ),
        confirmLabel: isCut
          ? "Place Cut Assets"
          : targetCopies.length === 1
            ? "Place Copy"
            : "Place Group",
      });

      if (!confirmed) {
        this.setStatus(
          `${isCut ? "Cut" : "Copy"} placement not applied. Click another grid cell or press Escape.`,
        );
        return false;
      }
    }

    const historySnapshot = this.captureHistorySnapshot();
    const primarySourceId = this.copiedPlacedGroup.primarySourceId;
    const placedObjects = isCut
      ? movePlacedAssetGroup(
        level,
        targetCopies,
        Array.from(sourceIds),
        existing.map((placedObject) => placedObject.id),
      )
      : duplicatePlacedAssetGroup(
        level,
        targetCopies,
        existing.map((placedObject) => placedObject.id),
      );
    if (!placedObjects) {
      this.setStatus(
        isCut
          ? "Unable to move the cut assets. Original assets were unchanged."
          : "Unable to paste the copied assets.",
      );
      return false;
    }

    const primaryIndex = this.copiedPlacedGroup.objects.findIndex(
      (copy) => copy.sourceObject.id === primarySourceId,
    );
    const primaryPlacedObject = placedObjects[Math.max(0, primaryIndex)] || placedObjects[0];
    this.copiedPlacedGroup = null;
    this.copyPreviewOrigin = null;
    this.gridEditor.setCopyModeActive(false);
    this.setPlacedObjectSelection(
      placedObjects.map((placedObject) => placedObject.id),
      primaryPlacedObject.id,
    );
    this.render();
    this.pushHistoryEntry(isCut ? "Cut assets" : "Paste assets", historySnapshot);
    this.autosave(
      `${isCut ? "Moved" : "Pasted"} ${placedObjects.length} asset${placedObjects.length === 1 ? "" : "s"} on ${level.name}.`,
    );
    return true;
  }

  async duplicateSelectedPlacedAssets() {
    if (this.copiedPlacedGroup) {
      this.cancelCopyPlacement();
    }
    const level = getCurrentLevel(this.project);
    const { selectedIds, selectedObjects } = this.getEligibleSelectedPlacedAssets();
    if (selectedObjects.length === 0) {
      this.setStatus("No unlocked visible assets selected to duplicate.");
      return false;
    }

    const group = this.createPlacedAssetGroup(selectedObjects, "copy");
    const origin = this.getDuplicatePlacementOrigin(group);
    const sourceIds = new Set(group.objects.map((copy) => copy.sourceObject.id));
    const targetCopies = group.objects.map((copy) => ({
      sourceObject: copy.sourceObject,
      x: origin.x + copy.offsetX,
      y: origin.y + copy.offsetY,
      width: Math.max(1, Number(copy.sourceObject.width) || 1),
      height: Math.max(1, Number(copy.sourceObject.height) || 1),
    }));
    const existingById = new Map();
    targetCopies.forEach((copy) => {
      this.findTargetLayerOverlaps(
        level,
        copy,
        this.getPlacedObjectTargetLayer(copy.sourceObject),
        sourceIds,
      ).forEach(
        (placedObject) => {
          existingById.set(placedObject.id, placedObject);
        },
      );
    });
    const existing = Array.from(existingById.values());

    if (this.blockActionForTargetLayerOverlaps(existing, "Duplicate placement")) {
      return false;
    }

    if (existing.length > 0) {
      const confirmed = await this.showConfirmModal({
        title: "Overlap Existing Assets?",
        message: this.createOverlapWarningMessage(
          `Duplicating ${targetCopies.length === 1 ? "this asset" : "these assets"} will overlap existing assets. Continue?`,
          existing,
        ),
        confirmLabel: targetCopies.length === 1 ? "Duplicate Asset" : "Duplicate Group",
      });
      if (!confirmed) {
        this.setStatus("Duplicate cancelled. Existing assets were unchanged.");
        return false;
      }
    }

    const historySnapshot = this.captureHistorySnapshot();
    const placedObjects = duplicatePlacedAssetGroup(
      level,
      targetCopies,
      existing.map((placedObject) => placedObject.id),
    );
    if (!placedObjects) {
      this.setStatus("Unable to duplicate the selected assets.");
      return false;
    }

    const primaryIndex = group.objects.findIndex(
      (copy) => copy.sourceObject.id === group.primarySourceId,
    );
    const primaryPlacedObject = placedObjects[Math.max(0, primaryIndex)] || placedObjects[0];
    this.setPlacedObjectSelection(
      placedObjects.map((placedObject) => placedObject.id),
      primaryPlacedObject.id,
    );
    this.render();
    this.pushHistoryEntry("Duplicate assets", historySnapshot);
    const skippedCount = selectedIds.length - selectedObjects.length;
    this.autosave(
      `Duplicated ${placedObjects.length} asset${placedObjects.length === 1 ? "" : "s"}${
        skippedCount > 0 ? `; skipped ${skippedCount} hidden or locked selection${skippedCount === 1 ? "" : "s"}` : ""
      }.`,
    );
    return true;
  }

  showAlertModal(message, options = {}) {
    return this.showEditorModal({
      type: "alert",
      title: options.title || "Message",
      message,
      confirmLabel: options.confirmLabel || "OK",
    });
  }

  showConfirmModal(options) {
    return this.showEditorModal({
      type: "confirm",
      title: options.title || "Confirm",
      message: options.message || "",
      confirmLabel: options.confirmLabel || "Confirm",
      cancelLabel: options.cancelLabel || "Cancel",
      danger: Boolean(options.danger),
    });
  }

  showPromptModal(options) {
    return this.showEditorModal({
      type: "prompt",
      title: options.title || "Input Required",
      message: options.message || "",
      label: options.label || "Value",
      value: options.value || "",
      placeholder: options.placeholder || "",
      confirmLabel: options.confirmLabel || "OK",
      cancelLabel: options.cancelLabel || "Cancel",
    });
  }

  showSelectModal(options) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      const selectOptions = (options.options || []).map(
        (option) =>
          `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`,
      ).join("");
      let resolved = false;

      dialog.className = "editor-modal-dialog editor-modal-select";
      dialog.innerHTML = `
        <form class="editor-modal-form" method="dialog">
          <h2>${escapeHtml(options.title || "Choose Option")}</h2>
          ${options.message ? `<p>${escapeHtml(options.message)}</p>` : ""}
          <label>${escapeHtml(options.label || "Option")}
            <select name="modalValue" required>${selectOptions}</select>
          </label>
          <div class="dialog-actions">
            <button type="button" data-action="cancel-modal">${escapeHtml(options.cancelLabel || "Cancel")}</button>
            <button type="submit">${escapeHtml(options.confirmLabel || "Continue")}</button>
          </div>
        </form>
      `;

      const finish = (value) => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(value);
        if (dialog.open) {
          dialog.close();
        } else {
          dialog.remove();
        }
      };

      document.body.append(dialog);
      const form = dialog.querySelector("form");
      const select = dialog.querySelector("select[name='modalValue']");
      const cancelButton = dialog.querySelector('[data-action="cancel-modal"]');
      if (options.value) {
        select.value = options.value;
      }

      cancelButton.addEventListener("click", () => {
        finish(null);
      });

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        finish(select.value);
      });

      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(null);
      });

      dialog.addEventListener("close", () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
        dialog.remove();
      });

      dialog.showModal();
      select.focus();
    });
  }

  showEditorModal(options) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      const type = options.type || "alert";
      const isPrompt = type === "prompt";
      const isConfirm = type === "confirm";
      const isAlert = type === "alert";
      let resolved = false;

      dialog.className = `editor-modal-dialog editor-modal-${type}`;
      dialog.innerHTML = `
        <form class="editor-modal-form" method="dialog">
          <h2>${escapeHtml(options.title || "")}</h2>
          ${options.message ? `<p>${escapeHtml(options.message)}</p>` : ""}
          ${
            isPrompt
              ? `<label>${escapeHtml(options.label || "Value")}
                  <input name="modalValue" value="${escapeAttribute(options.value || "")}" placeholder="${escapeAttribute(options.placeholder || "")}" required />
                </label>
                <p class="form-error" role="alert" hidden></p>`
              : ""
          }
          <div class="dialog-actions">
            ${
              isAlert
                ? ""
                : `<button type="button" data-action="cancel-modal">${escapeHtml(options.cancelLabel || "Cancel")}</button>`
            }
            <button type="submit" class="${options.danger ? "danger" : ""}">${escapeHtml(options.confirmLabel || "OK")}</button>
          </div>
        </form>
      `;

      const finish = (value) => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(value);
        if (dialog.open) {
          dialog.close();
        } else {
          dialog.remove();
        }
      };

      document.body.append(dialog);

      const form = dialog.querySelector("form");
      const input = dialog.querySelector("input[name='modalValue']");
      const error = dialog.querySelector(".form-error");
      const cancelButton = dialog.querySelector('[data-action="cancel-modal"]');

      cancelButton?.addEventListener("click", () => {
        finish(isPrompt ? null : false);
      });

      form.addEventListener("submit", (event) => {
        event.preventDefault();

        if (isConfirm) {
          finish(true);
          return;
        }

        if (isPrompt) {
          const value = input.value.trim();
          if (!value) {
            error.hidden = false;
            error.textContent = "Enter a value before continuing.";
            input.focus();
            return;
          }
          finish(value);
          return;
        }

        finish(true);
      });

      form.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && isConfirm) {
          event.preventDefault();
        }
      });

      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(isPrompt ? null : false);
      });

      dialog.addEventListener("close", () => {
        if (!resolved) {
          resolved = true;
          resolve(isPrompt ? null : false);
        }
        dialog.remove();
      });

      dialog.showModal();

      if (input) {
        input.focus();
        input.select();
      } else if (isConfirm && cancelButton) {
        cancelButton.focus();
      } else {
        dialog.querySelector("button[type='submit']")?.focus();
      }
    });
  }

  async openDeleteLevelConfirmation() {
    const level = getCurrentLevel(this.project);
    const selectedLevelId = level?.id || this.project.lastOpenedLevelId || null;

    console.log("[Delete Level] selectedLevelId:", selectedLevelId);
    console.log(
      "[Delete Level] levels before:",
      this.project.levels.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        filename: candidate.filename,
      })),
    );

    if (!level || !selectedLevelId) {
      console.log("[Delete Level] no selected level found.");
      this.setStatus("No selected level to delete.");
      return;
    }

    if (this.project.levels.length <= 1) {
      console.log("[Delete Level] final remaining level blocked.");
      this.setStatus("Cannot delete the final remaining level.");
      return;
    }

    const confirmed = await this.showConfirmModal({
      title: `Delete "${level.name}"?`,
      message:
        "This removes the level from the current editor project. Existing JSON files on disk are left untouched for safety.",
      confirmLabel: "Delete Level",
      danger: true,
    });

    console.log("[Delete Level] confirmed:", confirmed);
    if (!confirmed) {
      this.setStatus("Delete level cancelled.");
      return;
    }

    this.deleteSelectedLevel(level.id);
  }

  deleteSelectedLevel(selectedLevelId) {
    const selectedLevel = this.project.levels.find((level) => level.id === selectedLevelId);

    if (!selectedLevel) {
      console.log("[Delete Level] selected level disappeared before deletion:", selectedLevelId);
      this.setStatus("Selected level was not found.");
      return;
    }

    if (this.project.levels.length <= 1) {
      console.log("[Delete Level] final remaining level blocked.");
      this.setStatus("Cannot delete the final remaining level.");
      return;
    }

    try {
      createProjectBackup(this.project, `Before deleting ${selectedLevel.name}`);
      console.log("[Delete Level] backup created:", true);
    } catch (error) {
      console.warn("[Delete Level] backup failed; continuing with delete.", error);
      console.log("[Delete Level] backup created:", false);
    }

    const deletedLevel = deleteCurrentLevel(this.project, selectedLevelId);
    const newSelectedLevelId = this.project.lastOpenedLevelId;

    console.log(
      "[Delete Level] levels after:",
      this.project.levels.map((level) => ({
        id: level.id,
        name: level.name,
        filename: level.filename,
      })),
    );
    console.log("[Delete Level] new selected level:", newSelectedLevelId);

    this.clearSelection();
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.closeLevelPicker();
    this.render();
    console.log("[Delete Level] level selector re-rendered:", true);

    this.autosave(
      "Level deleted from project. Existing JSON file on disk was left untouched for safety.",
      (saved) => {
        console.log("[Delete Level] localStorage save succeeded:", saved);
      },
    );
  }

  getCopiedPlacementOrigin(x, y) {
    const level = getCurrentLevel(this.project);
    const width = Math.max(1, Number(this.copiedPlacedGroup?.width) || 1);
    const height = Math.max(1, Number(this.copiedPlacedGroup?.height) || 1);

    return {
      x: clamp(x, 1, Math.max(1, level.gridWidth - width + 1)),
      y: clamp(y, 1, Math.max(1, level.gridHeight - height + 1)),
    };
  }

  getDuplicatePlacementOrigin(group) {
    const level = getCurrentLevel(this.project);
    const maximumX = Math.max(1, level.gridWidth - group.width + 1);
    const maximumY = Math.max(1, level.gridHeight - group.height + 1);
    const preferred = {
      x: clamp(group.sourceOrigin.x + 1, 1, maximumX),
      y: clamp(group.sourceOrigin.y + 1, 1, maximumY),
    };
    if (
      preferred.x !== group.sourceOrigin.x ||
      preferred.y !== group.sourceOrigin.y
    ) {
      return preferred;
    }
    return {
      x: clamp(group.sourceOrigin.x - 1, 1, maximumX),
      y: clamp(group.sourceOrigin.y - 1, 1, maximumY),
    };
  }

  getEligibleSelectedPlacedAssets() {
    const level = getCurrentLevel(this.project);
    const selectedIds = this.selectedPlacedObjectIds.size > 0
      ? Array.from(this.selectedPlacedObjectIds)
      : [this.selectedPlacedObjectId].filter(Boolean);
    const selectedIdSet = new Set(selectedIds);
    const selectedObjects = getPlacedObjects(level).filter(
      (placedObject) =>
        selectedIdSet.has(placedObject.id) &&
        this.isLayerVisible(placedObject.layer) &&
        !this.isLayerLocked(placedObject.layer) &&
        placedObject.editorLocked !== true,
    );
    return { selectedIds, selectedObjects };
  }

  getSelectedPlacedAssetsForLocking() {
    const selection = this.getSelectedPlacedAssetsForProperties();

    return {
      selectedIds: selection.selectedIds,
      selectedObjects: selection.lockableObjects,
      protectedCount: selection.protectedCount,
    };
  }

  getSelectedPlacedAssetsForProperties() {
    const level = getCurrentLevel(this.project);
    const selectedIds = this.selectedPlacedObjectIds.size > 0
      ? Array.from(this.selectedPlacedObjectIds)
      : [this.selectedPlacedObjectId].filter(Boolean);
    const selectedIdSet = new Set(selectedIds);
    const allSelectedObjects = getPlacedObjects(level).filter(
      (placedObject) => selectedIdSet.has(placedObject.id),
    );
    const visibleLayerObjects = allSelectedObjects.filter(
      (placedObject) => this.canUnlockPlacedObject(placedObject),
    );
    const editableObjects = allSelectedObjects.filter(
      (placedObject) => this.canEditPlacedObject(placedObject),
    );
    const individuallyLockedObjects = visibleLayerObjects.filter(
      (placedObject) => placedObject.editorLocked === true,
    );

    return {
      selectedIds,
      allSelectedObjects,
      editableObjects,
      individuallyLockedObjects,
      lockableObjects: visibleLayerObjects,
      lockedCount: individuallyLockedObjects.length,
      protectedCount: allSelectedObjects.length - visibleLayerObjects.length,
    };
  }

  applySelectedPlacedAssetLockState(shouldLock) {
    const level = getCurrentLevel(this.project);
    const { selectedObjects, protectedCount } = this.getSelectedPlacedAssetsForLocking();
    let changedCount = 0;

    selectedObjects.forEach((placedObject) => {
      const result = this.setPlacedObjectLockState(level, placedObject.id, shouldLock);
      if (result?.changed) {
        changedCount += 1;
      }
    });

    const selectableIds = selectedObjects
      .filter(
        (placedObject) =>
          this.isLayerVisible(placedObject.layer) &&
          !this.isLayerLocked(placedObject.layer),
      )
      .map((placedObject) => placedObject.id);
    const previousPrimaryId = this.selectedPlacedObjectId;
    this.setPlacedObjectSelection(
      selectableIds,
      selectableIds.includes(previousPrimaryId) ? previousPrimaryId : selectableIds[0] || null,
    );

    return {
      appliedCount: selectedObjects.length,
      changedCount,
      selectedCount: selectedObjects.length,
      protectedCount,
    };
  }

  createMultiLockStatusMessage(result, shouldLock) {
    const action = shouldLock ? "Locked" : "Unlocked";
    const skippedText =
      result.protectedCount > 0
        ? ` Skipped ${result.protectedCount} protected asset${result.protectedCount === 1 ? "" : "s"}.`
        : "";

    if (result.appliedCount === 0) {
      return `No selected assets changed.${skippedText}`;
    }

    return `${action} ${result.appliedCount} selected asset${result.appliedCount === 1 ? "" : "s"}.${skippedText}`;
  }

  setPlacedObjectLockState(level, placedObjectId, shouldLock) {
    for (const layerName of LAYERS) {
      const placedObject = (level.layers[layerName] || []).find(
        (candidate) => candidate.id === placedObjectId,
      );
      if (!placedObject) {
        continue;
      }

      const changed = placedObject.editorLocked !== shouldLock;
      placedObject.editorLocked = shouldLock;
      return { placedObject, changed };
    }

    return null;
  }

  applyMultiPlacedAssetProperties(values) {
    const level = getCurrentLevel(this.project);
    const selection = this.getSelectedPlacedAssetsForProperties();
    const changedFields = Object.keys(values);
    const hasEditableChanges = changedFields.some((fieldName) => fieldName !== "editorLocked");
    let editedCount = 0;
    let lockAppliedCount = 0;
    let lockChangedCount = 0;

    if (hasEditableChanges) {
      selection.editableObjects.forEach((placedObject) => {
        const nextProperties = {
          x: Number(placedObject.x) || 1,
          y: Number(placedObject.y) || 1,
          width: Math.max(1, Number(placedObject.width) || 1),
          height: Math.max(1, Number(placedObject.height) || 1),
          layer: values.layer ?? normalizePlacedLayer(placedObject.layer),
        };
        if (Object.prototype.hasOwnProperty.call(values, "visible")) {
          nextProperties.visible = values.visible;
        }
        if (Object.prototype.hasOwnProperty.call(values, "opacity")) {
          nextProperties.opacity = values.opacity;
        }
        if (Object.prototype.hasOwnProperty.call(values, "blocksMovement")) {
          nextProperties.blocksMovement = values.blocksMovement;
        }
        if (Object.prototype.hasOwnProperty.call(values, "notes")) {
          nextProperties.notes = values.notes;
        }
        const updatedObject = updatePlacedAssetProperties(level, placedObject.id, nextProperties);
        if (updatedObject) {
          editedCount += 1;
        }
      });
    }

    if (values.editorLocked !== undefined) {
      selection.lockableObjects.forEach((placedObject) => {
        const result = this.setPlacedObjectLockState(
          level,
          placedObject.id,
          values.editorLocked,
        );
        if (result?.changed) {
          lockChangedCount += 1;
        }
      });
      lockAppliedCount = selection.lockableObjects.length;
    }

    const selectableIds = selection.selectedIds.filter((placedObjectId) => {
      const placedObject = getPlacedObjects(level).find(
        (candidate) => candidate.id === placedObjectId,
      );
      return (
        placedObject &&
        this.isLayerVisible(placedObject.layer) &&
        !this.isLayerLocked(placedObject.layer)
      );
    });
    const previousPrimaryId = this.selectedPlacedObjectId;
    this.setPlacedObjectSelection(
      selectableIds,
      selectableIds.includes(previousPrimaryId) ? previousPrimaryId : selectableIds[0] || null,
    );

    return {
      changedFields,
      editedCount,
      lockAppliedCount,
      lockChangedCount,
      lockState: values.editorLocked,
      editableCount: selection.editableObjects.length,
      lockableCount: selection.lockableObjects.length,
      sharedEditSkippedCount: hasEditableChanges
        ? selection.allSelectedObjects.length - selection.editableObjects.length
        : 0,
      protectedCount: selection.protectedCount,
    };
  }

  createMultiPropertiesStatusMessage(result, values) {
    const parts = [];
    const changedSharedFields = result.changedFields.filter(
      (fieldName) => fieldName !== "editorLocked",
    );

    if (changedSharedFields.length > 0) {
      parts.push(
        `Updated ${changedSharedFields.join(", ")} for ${result.editedCount} selected asset${result.editedCount === 1 ? "" : "s"}.`,
      );
      if (result.sharedEditSkippedCount > 0) {
        parts.push(
          `Skipped ${result.sharedEditSkippedCount} protected asset${result.sharedEditSkippedCount === 1 ? "" : "s"}.`,
        );
      }
    }

    if (values.editorLocked !== undefined) {
      const action = values.editorLocked ? "Locked" : "Unlocked";
      parts.push(
        `${action} ${result.lockAppliedCount} selected asset${result.lockAppliedCount === 1 ? "" : "s"}.`,
      );
    }

    if (result.protectedCount > 0 && changedSharedFields.length === 0) {
      parts.push(
        `Skipped ${result.protectedCount} protected asset${result.protectedCount === 1 ? "" : "s"}.`,
      );
    }

    return parts.length > 0 ? parts.join(" ") : "No selected assets changed.";
  }

  createPlacedAssetGroup(selectedObjects, mode) {
    const minimumX = Math.min(...selectedObjects.map((placedObject) => Number(placedObject.x) || 1));
    const minimumY = Math.min(...selectedObjects.map((placedObject) => Number(placedObject.y) || 1));
    const maximumX = Math.max(
      ...selectedObjects.map(
        (placedObject) =>
          (Number(placedObject.x) || 1) + (Number(placedObject.width) || 1) - 1,
      ),
    );
    const maximumY = Math.max(
      ...selectedObjects.map(
        (placedObject) =>
          (Number(placedObject.y) || 1) + (Number(placedObject.height) || 1) - 1,
      ),
    );
    return {
      mode,
      width: maximumX - minimumX + 1,
      height: maximumY - minimumY + 1,
      sourceOrigin: { x: minimumX, y: minimumY },
      primarySourceId: this.selectedPlacedObjectId || selectedObjects[0].id,
      objects: selectedObjects.map((placedObject) => ({
        sourceObject: cloneEditorData(placedObject),
        offsetX: (Number(placedObject.x) || 1) - minimumX,
        offsetY: (Number(placedObject.y) || 1) - minimumY,
      })),
    };
  }

  createCopyPreview() {
    if (!this.copiedPlacedGroup || !this.copyPreviewOrigin) {
      return null;
    }

    return {
      mode: this.copiedPlacedGroup.mode,
      key: `${this.copiedPlacedGroup.mode}:${
        this.copiedPlacedGroup.objects
        .map((copy) => `${copy.sourceObject.id}:${copy.sourceObject.assetId}`)
        .join("|")
      }`,
      range: {
        ...this.copyPreviewOrigin,
        width: this.copiedPlacedGroup.width,
        height: this.copiedPlacedGroup.height,
      },
      items: this.copiedPlacedGroup.objects.map((copy) => ({
        placedObject: copy.sourceObject,
        asset: this.project.assets.find((asset) => asset.id === copy.sourceObject.assetId),
        range: {
          x: this.copyPreviewOrigin.x + copy.offsetX,
          y: this.copyPreviewOrigin.y + copy.offsetY,
          width: Math.max(1, Number(copy.sourceObject.width) || 1),
          height: Math.max(1, Number(copy.sourceObject.height) || 1),
        },
      })),
    };
  }

  cancelCopyPlacement() {
    this.copiedPlacedGroup = null;
    this.copyPreviewOrigin = null;
    this.gridEditor?.setCopyModeActive(false);
    this.gridEditor?.updateCopyPreview(null);
  }

  async placeSelectedAssetInRange(asset = this.selectedAsset, range = this.selectedRange) {
    if (!asset) {
      this.setStatus("No asset selected.");
      return;
    }

    if (!range || this.selectionState !== "selectionReady") {
      this.setStatus("No grid area selected.");
      return;
    }

    if (this.selectedRanges.length > 1) {
      this.setStatus("Use Fill Selected Area to place assets into multiple selected areas.");
      return;
    }

    await this.placeAssetInRange(asset, range, "button");
  }

  async fillSelectedArea() {
    const selectedAreas = this.getSelectedAreaRanges();
    if (selectedAreas.length === 0) {
      this.setStatus("Select a grid area first.");
      return false;
    }
    if (!this.selectedAsset) {
      this.setStatus("No asset selected.");
      return false;
    }
    if (
      this.selectedAsset.isImported &&
      (!this.selectedAsset.src || typeof this.selectedAsset.src !== "string")
    ) {
      this.setStatus("Asset image data missing.");
      return false;
    }

    const targetLayer = this.getAssetPlacementLayer(this.selectedAsset);
    if (this.isLayerLocked(targetLayer)) {
      this.setStatus(
        `Fill blocked: layer "${normalizePlacedLayer(targetLayer)}" is locked.`,
      );
      return false;
    }

    const level = getCurrentLevel(this.project);
    const isMultiAreaFill = selectedAreas.length > 1;
    const range = { ...selectedAreas[selectedAreas.length - 1] };
    const existing = isMultiAreaFill
      ? this.findObjectsInSelectedAreas(selectedAreas, [targetLayer])
      : findObjectsInRange(
          level,
          range.x,
          range.y,
          range.width,
          range.height,
          [targetLayer],
        );
    if (this.blockActionForTargetLayerOverlaps(existing, "Fill")) {
      this.setStatus(
        isMultiAreaFill
          ? "Selected areas contain hidden or locked assets on the target layer. Show or unlock them before filling these areas."
          : "Selected area contains hidden or locked assets on the target layer. Show or unlock them before filling this area.",
      );
      return false;
    }

    const selectedCells = isMultiAreaFill
      ? this.getUniqueSelectedCells(selectedAreas)
      : null;
    const fillCount = isMultiAreaFill
      ? selectedCells.length
      : range.width * range.height;
    if (fillCount > 500) {
      const confirmed = await this.showConfirmModal({
        title: "Large Area Fill?",
        message: `Filling this area will create ${fillCount} placed assets and may affect performance. Continue?`,
        confirmLabel: "Fill Area",
      });
      if (!confirmed) {
        this.setStatus("Fill cancelled.");
        return false;
      }
    }

    if (existing.length > 0) {
      const confirmed = await this.showConfirmModal({
        title: "Replace Existing Assets?",
        message: this.createOverlapWarningMessage(
          isMultiAreaFill
            ? "Filling these areas will replace existing editable assets in the selected areas. Continue?"
            : "Filling this area will replace existing editable assets in the selected area. Continue?",
          existing,
        ),
        confirmLabel: "Fill Area",
      });
      if (!confirmed) {
        this.setStatus("Fill cancelled.");
        return false;
      }
    }

    const historySnapshot = this.captureHistorySnapshot();
    const placedObjects = isMultiAreaFill
      ? fillCellsWithAsset(
          level,
          this.selectedAsset,
          selectedCells,
          existing.map((placedObject) => placedObject.id),
        )
      : fillAreaWithAsset(
          level,
          this.selectedAsset,
          range,
          existing.map((placedObject) => placedObject.id),
        );
    if (!placedObjects) {
      this.setStatus("Unable to fill the selected area.");
      return false;
    }

    this.cancelCopyPlacement();
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.refreshPlacedAssetMarkers();
    this.pushHistoryEntry("Fill selected area", historySnapshot);
    this.autosave(
      isMultiAreaFill
        ? `Filled ${placedObjects.length} cells across ${selectedAreas.length} areas.`
        : `Filled ${placedObjects.length} cells.`,
    );
    return true;
  }

  clearSelectedArea() {
    const selectedAreas = this.getSelectedAreaRanges();
    if (selectedAreas.length === 0) {
      this.setStatus("Select a grid area first.");
      return false;
    }

    const level = getCurrentLevel(this.project);
    const isMultiAreaClear = selectedAreas.length > 1;
    const range = selectedAreas[selectedAreas.length - 1];
    const existing = isMultiAreaClear
      ? this.findObjectsInSelectedAreas(selectedAreas)
      : findObjectsInRange(
          level,
          range.x,
          range.y,
          range.width,
          range.height,
        );
    const removable = existing.filter(
      (placedObject) =>
        this.isLayerVisible(placedObject.layer) &&
        !this.isPlacedObjectProtected(placedObject),
    );
    const hiddenCount = existing.filter(
      (placedObject) => !this.isLayerVisible(placedObject.layer),
    ).length;
    const lockedCount = existing.filter(
      (placedObject) =>
        this.isLayerVisible(placedObject.layer) &&
        this.isPlacedObjectProtected(placedObject),
    ).length;

    if (removable.length === 0) {
      const skipped = [];
      if (hiddenCount > 0) {
        skipped.push(`${hiddenCount} hidden`);
      }
      if (lockedCount > 0) {
        skipped.push(`${lockedCount} locked`);
      }
      this.setStatus(
        skipped.length > 0
          ? `No editable visible assets cleared. ${skipped.join(" and ")} asset${hiddenCount + lockedCount === 1 ? " was" : "s were"} skipped.`
          : `No placed assets found in the selected area${isMultiAreaClear ? "s" : ""}.`,
      );
      return false;
    }

    const historySnapshot = this.captureHistorySnapshot();
    const removedObjects = removeKnownPlacedObjectsByIds(
      level,
      removable.map((placedObject) => placedObject.id),
    );
    this.cancelCopyPlacement();
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.refreshPlacedAssetMarkers();
    this.pushHistoryEntry("Clear selected area", historySnapshot);
    const skippedParts = [];
    if (hiddenCount > 0) {
      skippedParts.push(`${hiddenCount} hidden`);
    }
    if (lockedCount > 0) {
      skippedParts.push(`${lockedCount} locked`);
    }
    this.autosave(
      `Cleared ${removedObjects.length} asset${removedObjects.length === 1 ? "" : "s"}${
        isMultiAreaClear ? ` across ${selectedAreas.length} areas` : ""
      }.${
        skippedParts.length > 0
          ? ` ${skippedParts.join(" and ")} asset${hiddenCount + lockedCount === 1 ? " was" : "s were"} skipped.`
          : ""
      }`,
    );
    return true;
  }

  async replaceMatchingAssetsInSelectedArea() {
    const selectedAreas = this.getSelectedAreaRanges();
    if (selectedAreas.length === 0) {
      this.setStatus("Select a grid area first.");
      return false;
    }

    const replacementAsset = this.selectedAsset;
    if (!replacementAsset) {
      this.setStatus("No replacement asset selected.");
      return false;
    }

    if (
      replacementAsset.isImported &&
      (!replacementAsset.src || typeof replacementAsset.src !== "string")
    ) {
      this.setStatus("Replacement asset image data missing.");
      return false;
    }

    if (!replacementAsset.id || !this.project.assets.some((asset) => asset.id === replacementAsset.id)) {
      this.setStatus("Replacement asset was not found in the asset registry.");
      return false;
    }

    const level = getCurrentLevel(this.project);
    const isMultiAreaReplace = selectedAreas.length > 1;
    const candidates = this.getReplaceMatchingCandidates(selectedAreas);
    if (candidates.length === 0) {
      this.setStatus("No visible unlocked placed assets found in the selected area.");
      return false;
    }

    const sourceAssetId = await this.showSelectModal({
      title: "Replace Matching Assets",
      message: "Choose the placed asset type to replace inside the selected area.",
      label: "Source asset to replace",
      options: candidates.map((candidate) => ({
        value: candidate.assetId,
        label: candidate.label,
      })),
      value: candidates[0].assetId,
      confirmLabel: "Choose Source",
    });

    if (!sourceAssetId) {
      this.setStatus("Replace matching assets cancelled.");
      return false;
    }

    if (sourceAssetId === replacementAsset.id) {
      this.setStatus("Source and replacement assets are the same. No changes made.");
      return false;
    }

    const matchingObjects = this.findObjectsInSelectedAreas(selectedAreas).filter(
      (placedObject) => placedObject.assetId === sourceAssetId,
    );
    const replaceableObjects = matchingObjects.filter(
      (placedObject) =>
        this.isLayerVisible(placedObject.layer) &&
        !this.isPlacedObjectProtected(placedObject),
    );
    const hiddenCount = matchingObjects.filter(
      (placedObject) => !this.isLayerVisible(placedObject.layer),
    ).length;
    const lockedCount = matchingObjects.filter(
      (placedObject) =>
        this.isLayerVisible(placedObject.layer) &&
        this.isPlacedObjectProtected(placedObject),
    ).length;

    if (replaceableObjects.length === 0) {
      const skippedParts = this.createSkippedAssetParts(hiddenCount, lockedCount);
      this.setStatus(
        skippedParts.length > 0
          ? `No editable matching assets replaced. ${skippedParts.join(" and ")} asset${hiddenCount + lockedCount === 1 ? " was" : "s were"} skipped.`
          : "No matching assets found in the selected area.",
      );
      return false;
    }

    const skippedText = this.createSkippedAssetParts(hiddenCount, lockedCount);
    const confirmed = await this.showConfirmModal({
      title: "Replace Matching Assets?",
      message: `Replace ${replaceableObjects.length} matching asset${replaceableObjects.length === 1 ? "" : "s"} in the selected area${isMultiAreaReplace ? "s" : ""}?${
        skippedText.length > 0
          ? ` ${skippedText.join(" and ")} asset${hiddenCount + lockedCount === 1 ? " will be" : "s will be"} skipped.`
          : ""
      }`,
      confirmLabel: "Replace Assets",
    });

    if (!confirmed) {
      this.setStatus("Replace matching assets cancelled.");
      return false;
    }

    const historySnapshot = this.captureHistorySnapshot();
    const replacedObjects = replacePlacedObjectAssetSources(
      level,
      replaceableObjects.map((placedObject) => placedObject.id),
      replacementAsset,
    );
    if (replacedObjects.length === 0) {
      this.setStatus("Unable to replace matching assets.");
      return false;
    }

    this.cancelCopyPlacement();
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.refreshPlacedAssetMarkers();
    this.pushHistoryEntry("Replace matching assets", historySnapshot);
    this.autosave(
      `Replaced ${replacedObjects.length} matching asset${replacedObjects.length === 1 ? "" : "s"} with ${replacementAsset.name || replacementAsset.id}${
        isMultiAreaReplace ? ` across ${selectedAreas.length} areas` : ""
      }.${
        skippedText.length > 0
          ? ` ${skippedText.join(" and ")} asset${hiddenCount + lockedCount === 1 ? " was" : "s were"} skipped.`
          : ""
      }`,
    );
    return true;
  }

  startDragPaint(cell) {
    if (!this.isDragPaintMode) {
      return;
    }

    if (!this.selectedAsset) {
      this.dragPaintSession = null;
      this.gridEditor.updatePaintPreview([]);
      this.setStatus("Select an asset to drag paint.");
      return;
    }

    const activePaintAssets = this.getActivePaintAssets();
    if (activePaintAssets.length === 0) {
      this.dragPaintSession = null;
      this.gridEditor.updatePaintPreview([]);
      this.setStatus(
        this.getActivePaintVariantCount() > 0
          ? "No usable paint variants available."
          : "Asset image data missing.",
      );
      return;
    }

    if (activePaintAssets.some((asset) => this.isLayerLocked(asset.defaultLayer || "objects"))) {
      this.dragPaintSession = null;
      this.gridEditor.updatePaintPreview([]);
      this.setStatus("Drag paint blocked: one or more paint source layers are locked.");
      return;
    }

    this.selectedRange = null;
    this.selectedRanges = [];
    this.selectionState = "idle";
    this.dropPreviewRange = null;
    this.gridEditor.updateSelection(null);
    this.gridEditor.updateMultiSelections([]);
    this.gridEditor.updateDropPreview(null);
    this.syncCoordinateStatus();
    this.syncPlacementButton();
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.dragPaintSession = {
      asset: this.selectedAsset,
      paintAssets: activePaintAssets,
      variantsActive: this.getActivePaintVariantCount() > 0,
      brushSize: this.paintBrushSize,
      paintedCells: new Map(),
      skippedCells: new Set(),
    };
    this.addDragPaintCell(cell);
  }

  addDragPaintCell(cell) {
    if (!this.dragPaintSession || !cell) {
      return;
    }

    const level = getCurrentLevel(this.project);
    const brushCells = this.getPaintBrushCells(cell, this.dragPaintSession.brushSize);
    let changed = false;

    brushCells.forEach((brushCell) => {
      const key = createCellKey(brushCell);
      if (
        this.dragPaintSession.paintedCells.has(key) ||
        this.dragPaintSession.skippedCells.has(key)
      ) {
        return;
      }

      const asset = this.pickPaintAsset(this.dragPaintSession.paintAssets);
      const targetLayer = this.getAssetPlacementLayer(asset);
      const existingObjects = findObjectsInRange(
        level,
        brushCell.x,
        brushCell.y,
        1,
        1,
        [targetLayer],
      );
      if (existingObjects.length > 0) {
        this.dragPaintSession.skippedCells.add(key);
        changed = true;
        return;
      }

      this.dragPaintSession.paintedCells.set(key, {
        x: brushCell.x,
        y: brushCell.y,
        asset,
      });
      changed = true;
    });

    if (!changed) {
      return;
    }

    this.gridEditor.updatePaintPreview(
      Array.from(this.dragPaintSession.paintedCells.values()),
    );
  }

  finishDragPaint() {
    const session = this.dragPaintSession;
    this.dragPaintSession = null;
    this.gridEditor.updatePaintPreview([]);

    if (!session) {
      return false;
    }

    const cells = Array.from(session.paintedCells.values());
    const skippedCount = session.skippedCells.size;
    if (cells.length === 0) {
      this.setStatus(
        skippedCount > 0
          ? `Painted 0 cells with ${this.getBrushSizeLabel(session.brushSize)} brush. Skipped ${skippedCount} occupied/protected cell${skippedCount === 1 ? "" : "s"}.`
          : "No cells painted.",
      );
      return false;
    }

    const level = getCurrentLevel(this.project);
    const historySnapshot = this.captureHistorySnapshot();
    const placedObjects = session.variantsActive
      ? fillCellsWithAssets(level, cells, [])
      : fillCellsWithAsset(level, session.asset, cells, []);
    if (!placedObjects) {
      this.setStatus("Unable to drag paint selected asset.");
      return false;
    }

    this.refreshPlacedAssetMarkers();
    this.pushHistoryEntry("Paint assets", historySnapshot);
    this.autosave(
      `Painted ${placedObjects.length} cell${placedObjects.length === 1 ? "" : "s"}${this.createPaintVariantStatusSuffix(session)} with ${this.getBrushSizeLabel(session.brushSize)} brush.${
        skippedCount > 0
          ? ` Skipped ${skippedCount} occupied/protected cell${skippedCount === 1 ? "" : "s"}.`
          : ""
      }`,
    );
    return true;
  }

  cancelDragPaint({ showStatus = false } = {}) {
    const hadSession = Boolean(this.dragPaintSession);
    this.dragPaintSession = null;
    this.gridEditor?.updatePaintPreview([]);
    if (showStatus && hadSession) {
      this.setStatus("Drag paint cancelled. No cells were painted.");
    }
  }

  openPaintVariantsDialog() {
    const availableAssets = this.getAvailablePaintVariantAssets();
    const categoryGroups = this.getPaintVariantCategoryGroups(availableAssets);
    const selectedVariantIds = new Set(this.getValidatedPaintVariantAssetIds());
    const expandedCategoryIds = new Set(this.loadPaintVariantExpandedCategoryIds());
    const currentAssetText = this.selectedAsset
      ? `${this.selectedAsset.name || this.selectedAsset.id} (${this.selectedAsset.category || "Uncategorised"})`
      : "No selected asset";
    const dialog = document.createElement("dialog");
    dialog.className = "editor-modal paint-variants-dialog";
    dialog.innerHTML = `
      <form class="editor-modal-form paint-variants-form" method="dialog">
        <h2>Paint Variants</h2>
        <p class="properties-hint">Current selected asset: ${escapeHtml(currentAssetText)}</p>
        <label class="paint-variant-search">
          <span>Search assets</span>
          <input type="search" data-role="paint-variant-search" placeholder="Search assets..." autocomplete="off" />
        </label>
        <p class="properties-hint" data-role="paint-variant-selected-count"></p>
        <div class="paint-variant-list" data-role="paint-variant-list">
        </div>
        <p class="properties-hint">Tick a category to include its imported assets, then untick individual assets to exclude them. Paint randomly chooses one selected asset per painted cell.</p>
        <div class="dialog-actions">
          <button type="button" data-action="clear-paint-variants">Clear Variants</button>
          <button type="button" data-action="cancel-paint-variants">Cancel</button>
          <button type="submit">Apply</button>
        </div>
      </form>
    `;

    document.body.append(dialog);
    const form = dialog.querySelector("form");
    const list = dialog.querySelector('[data-role="paint-variant-list"]');
    const searchInput = dialog.querySelector('[data-role="paint-variant-search"]');
    const countLabel = dialog.querySelector('[data-role="paint-variant-selected-count"]');
    const closeDialog = () => dialog.close();
    const getGroupId = (group) => String(group.id || group.name || "uncategorised");
    const getCategoryGroupsForSearch = () => {
      const searchTerm = searchInput.value.trim().toLowerCase();
      if (!searchTerm) {
        return categoryGroups.map((group) => ({
          ...group,
          visibleAssets: group.assets,
        }));
      }
      return categoryGroups
        .map((group) => {
          const visibleAssets = group.assets.filter((asset) => this.doesPaintVariantAssetMatchSearch(asset, group, searchTerm));
          return {
            ...group,
            visibleAssets,
          };
        })
        .filter((group) => group.visibleAssets.length > 0);
    };
    const updateCategoryStates = () => {
      dialog.querySelectorAll("[data-role='paint-variant-category']").forEach((section) => {
        const group = categoryGroups.find((candidate) => getGroupId(candidate) === section.dataset.categoryId);
        const categoryToggle = section.querySelector("[data-role='paint-variant-category-toggle']");
        const assetToggles = Array.from(section.querySelectorAll("[data-role='paint-variant-toggle']"));
        const checkedCount = group
          ? group.assets.filter((asset) => selectedVariantIds.has(asset.id)).length
          : assetToggles.filter((input) => input.checked).length;
        const totalCount = group ? group.assets.length : assetToggles.length;
        const countText = section.querySelector("[data-role='paint-variant-category-count']");

        categoryToggle.checked = totalCount > 0 && checkedCount === totalCount;
        categoryToggle.indeterminate = checkedCount > 0 && checkedCount < totalCount;
        if (countText) {
          countText.textContent = `${checkedCount} / ${totalCount} selected`;
        }
      });

      const selectedAssetCount = selectedVariantIds.size;
      const selectedCategoryCount = categoryGroups
        .filter((group) => group.assets.some((asset) => selectedVariantIds.has(asset.id)))
        .length;
      countLabel.textContent = selectedAssetCount > 0
        ? `${selectedAssetCount} asset${selectedAssetCount === 1 ? "" : "s"} selected across ${selectedCategoryCount} categor${selectedCategoryCount === 1 ? "y" : "ies"}.`
        : "No variant assets selected.";
    };
    const setCategoryExpanded = (section, expanded) => {
      const expandButton = section.querySelector("[data-role='paint-variant-category-expand']");
      const assetList = section.querySelector("[data-role='paint-variant-category-assets']");
      const categoryId = section.dataset.categoryId;
      section.classList.toggle("is-expanded", expanded);
      section.classList.toggle("paint-variant-category--collapsed", !expanded);
      expandButton?.setAttribute("aria-expanded", String(expanded));
      if (expandButton) {
        expandButton.textContent = expanded ? "v" : ">";
      }
      if (assetList) {
        assetList.hidden = !expanded;
      }
      if (categoryId) {
        if (expanded) {
          expandedCategoryIds.add(categoryId);
        } else {
          expandedCategoryIds.delete(categoryId);
        }
        this.savePaintVariantExpandedCategoryIds(Array.from(expandedCategoryIds));
      }
    };
    const renderVariantList = () => {
      const groupsForSearch = getCategoryGroupsForSearch();
      const hasSearch = searchInput.value.trim().length > 0;
      if (availableAssets.length === 0) {
        list.innerHTML = `<p class="properties-hint">No usable imported assets are available.</p>`;
        updateCategoryStates();
        return;
      }
      if (groupsForSearch.length === 0) {
        list.innerHTML = `<p class="properties-hint">No assets found.</p>`;
        updateCategoryStates();
        return;
      }
      list.innerHTML = groupsForSearch
        .map((group) =>
          this.createPaintVariantCategorySection(
            group,
            selectedVariantIds,
            hasSearch || expandedCategoryIds.has(getGroupId(group)),
            group.visibleAssets,
          ),
        )
        .join("");
      updateCategoryStates();
    };

    dialog.querySelector('[data-action="cancel-paint-variants"]').addEventListener("click", closeDialog);
    dialog.querySelector('[data-action="clear-paint-variants"]').addEventListener("click", () => {
      selectedVariantIds.clear();
      renderVariantList();
      updateCategoryStates();
      this.paintVariantAssetIds = [];
      this.savePaintVariantAssetIds();
      dialog.close();
      this.syncPaintVariantsButton();
      this.setStatus("Paint variants cleared. Using selected asset only.");
    });
    list?.addEventListener("click", (event) => {
      const expandButton = event.target.closest("[data-role='paint-variant-category-expand']");
      if (!expandButton) {
        return;
      }
      const section = expandButton.closest("[data-role='paint-variant-category']");
      setCategoryExpanded(section, !section.classList.contains("is-expanded"));
    });
    list?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      if (target.dataset.role === "paint-variant-category-toggle") {
        const section = target.closest("[data-role='paint-variant-category']");
        const group = categoryGroups.find((candidate) => getGroupId(candidate) === section?.dataset.categoryId);
        group?.assets.forEach((asset) => {
          if (target.checked) {
            selectedVariantIds.add(asset.id);
          } else {
            selectedVariantIds.delete(asset.id);
          }
        });
        section?.querySelectorAll("[data-role='paint-variant-toggle']").forEach((input) => {
          input.checked = selectedVariantIds.has(input.value);
        });
      } else if (target.dataset.role === "paint-variant-toggle") {
        if (target.checked) {
          selectedVariantIds.add(target.value);
        } else {
          selectedVariantIds.delete(target.value);
        }
      }
      updateCategoryStates();
    });
    searchInput.addEventListener("input", () => {
      renderVariantList();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.paintVariantAssetIds = this.validatePaintVariantAssetIds(Array.from(selectedVariantIds));
      this.savePaintVariantAssetIds();
      dialog.close();
      this.syncPaintVariantsButton();
      const count = this.paintVariantAssetIds.length;
      this.setStatus(
        count > 0
          ? `Paint variants active: ${count}.`
          : "Paint variants cleared. Using selected asset only.",
      );
    });
    renderVariantList();
    dialog.addEventListener("close", () => dialog.remove());
    dialog.showModal();
  }

  createPaintVariantCategorySection(group, activeIds, expanded = false, visibleAssets = group.assets) {
    const groupId = String(group.id || group.name || "uncategorised");
    const expandedClass = expanded ? "is-expanded" : "paint-variant-category--collapsed";
    return `
      <section class="paint-variant-category ${expandedClass}" data-role="paint-variant-category" data-category-id="${escapeAttribute(groupId)}">
        <div class="paint-variant-category-summary">
          <button
            type="button"
            class="paint-variant-category-expand"
            data-role="paint-variant-category-expand"
            aria-expanded="${expanded ? "true" : "false"}"
            aria-label="Expand ${escapeAttribute(group.name)} variants"
          >${expanded ? "v" : "&gt;"}</button>
          <label class="paint-variant-category-toggle">
            <input
              type="checkbox"
              data-role="paint-variant-category-toggle"
              value="${escapeAttribute(group.id)}"
            />
            <span>${escapeHtml(group.name)}</span>
          </label>
          <span class="paint-variant-category-count" data-role="paint-variant-category-count"></span>
        </div>
        <div class="paint-variant-category-assets" data-role="paint-variant-category-assets" ${expanded ? "" : "hidden"}>
          ${visibleAssets.map((asset) => this.createPaintVariantOption(asset, activeIds)).join("")}
        </div>
      </section>
    `;
  }

  createPaintVariantOption(asset, activeIds) {
    const label = this.getPaintVariantAssetLabel(asset);
    const thumbnail = asset.src
      ? `<img class="paint-variant-thumbnail" src="${escapeAttribute(asset.src)}" alt="" />`
      : `<span class="paint-variant-thumbnail is-empty" aria-hidden="true"></span>`;
    return `
      <label class="paint-variant-option">
        <input
          type="checkbox"
          data-role="paint-variant-toggle"
          value="${escapeAttribute(asset.id)}"
          ${activeIds.has(asset.id) ? "checked" : ""}
        />
        ${thumbnail}
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  getPaintVariantCategoryGroups(assets) {
    const categories = this.project.assetRegistry?.categories || [];
    const usedAssetIds = new Set();
    const groups = [];

    categories.forEach((category) => {
      const categoryAssets = assets.filter((asset) =>
        !usedAssetIds.has(asset.id) && (asset.categoryId === category.id || asset.category === category.name),
      );
      if (categoryAssets.length === 0) {
        return;
      }
      categoryAssets.forEach((asset) => usedAssetIds.add(asset.id));
      groups.push({
        id: category.id || category.name,
        name: category.name || "Uncategorised",
        assets: categoryAssets,
      });
    });

    const uncategorisedAssets = assets.filter((asset) => !usedAssetIds.has(asset.id));
    if (uncategorisedAssets.length > 0) {
      groups.push({
        id: "uncategorised",
        name: "Uncategorised",
        assets: uncategorisedAssets,
      });
    }

    return groups;
  }

  getPaintVariantAssetLabel(asset) {
    const name = asset.name || asset.id;
    const fileName = asset.fileName || asset.filename || asset.originalName;
    const suffixParts = [];
    if (asset.category) {
      suffixParts.push(asset.category);
    }
    if (fileName && fileName !== name) {
      suffixParts.push(fileName);
    }
    if (suffixParts.length === 0) {
      return name;
    }
    return `${name} (${suffixParts.join(" - ")})`;
  }

  doesPaintVariantAssetMatchSearch(asset, group, searchTerm) {
    if (!searchTerm) {
      return true;
    }
    const searchableText = [
      asset.name,
      asset.id,
      asset.fileName,
      asset.filename,
      asset.originalName,
      asset.category,
      group?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchableText.includes(searchTerm);
  }

  getAvailablePaintVariantAssets() {
    return (this.project.assetRegistry?.assets || this.project.assets || [])
      .filter((asset) => this.isUsablePaintVariantAsset(asset));
  }

  isUsablePaintVariantAsset(asset) {
    return Boolean(
      asset?.id &&
      asset.isImported === true &&
      typeof asset.src === "string" &&
      asset.src.length > 0,
    );
  }

  getValidatedPaintVariantAssetIds() {
    const validatedIds = this.validatePaintVariantAssetIds(this.paintVariantAssetIds);
    if (validatedIds.length !== this.paintVariantAssetIds.length) {
      this.paintVariantAssetIds = validatedIds;
      this.savePaintVariantAssetIds();
    }
    return validatedIds;
  }

  validatePaintVariantAssetIds(assetIds) {
    const availableIds = new Set(this.getAvailablePaintVariantAssets().map((asset) => asset.id));
    const validatedIds = [];
    (Array.isArray(assetIds) ? assetIds : []).forEach((assetId) => {
      if (availableIds.has(assetId) && !validatedIds.includes(assetId)) {
        validatedIds.push(assetId);
      }
    });
    return validatedIds;
  }

  getActivePaintVariantCount() {
    return this.getValidatedPaintVariantAssetIds().length;
  }

  getActivePaintAssets() {
    const variantIds = this.getValidatedPaintVariantAssetIds();
    const sourceAssets = variantIds.length > 0
      ? variantIds.map((assetId) => this.project.assets.find((asset) => asset.id === assetId))
      : [this.selectedAsset];
    return sourceAssets.filter((asset) => this.isUsablePaintVariantAsset(asset));
  }

  pickPaintAsset(assets) {
    if (!Array.isArray(assets) || assets.length === 0) {
      return this.selectedAsset;
    }
    return assets[Math.floor(Math.random() * assets.length)];
  }

  createPaintVariantStatusSuffix(session) {
    if (!session?.variantsActive) {
      return "";
    }
    const variantCount = session.paintAssets?.length || 0;
    return ` using ${variantCount} variant${variantCount === 1 ? "" : "s"}`;
  }

  updatePaintBrushFootprintPreview(cell) {
    if (this.activeTool !== "paint" || !this.selectedAsset || this.dragPaintSession) {
      this.gridEditor.updatePaintPreview([]);
      return;
    }

    this.gridEditor.updatePaintPreview(this.getPaintBrushCells(cell, this.paintBrushSize));
  }

  getPaintBrushCells(cell, brushSize = this.paintBrushSize) {
    if (!cell) {
      return [];
    }

    const size = normalizePaintBrushSize(brushSize);
    const offset = size === 2 ? 0 : Math.floor(size / 2);
    const startX = cell.x - offset;
    const startY = cell.y - offset;
    const level = getCurrentLevel(this.project);
    const cells = [];

    for (let y = startY; y < startY + size; y += 1) {
      for (let x = startX; x < startX + size; x += 1) {
        if (x < 1 || y < 1 || x > level.gridWidth || y > level.gridHeight) {
          continue;
        }
        cells.push({ x, y });
      }
    }

    return cells;
  }

  getToolStatusMessage(tool = this.activeTool) {
    if (tool === "paint") {
      const variantCount = this.getActivePaintVariantCount();
      if (variantCount > 0) {
        return `Paint mode: drag to paint using ${variantCount} variants with ${this.getBrushSizeLabel()} brush.`;
      }
      return this.selectedAsset
        ? `Paint mode: drag to paint ${this.selectedAsset.name} with ${this.getBrushSizeLabel()} brush.`
        : "Paint mode: select an asset to paint.";
    }
    if (tool === "move") {
      return "Select/Move mode.";
    }
    if (tool === "delete") {
      return "Delete mode.";
    }
    return `${getToolLabel(tool)} mode.`;
  }

  getReplaceMatchingCandidates(rangeOrRanges) {
    const ranges = Array.isArray(rangeOrRanges) ? rangeOrRanges : [rangeOrRanges].filter(Boolean);
    const candidateObjects = this.findObjectsInSelectedAreas(ranges).filter(
      (placedObject) =>
        placedObject.assetId &&
        this.isLayerVisible(placedObject.layer) &&
        !this.isPlacedObjectProtected(placedObject),
    );
    const candidatesByAssetId = new Map();

    candidateObjects.forEach((placedObject) => {
      if (!candidatesByAssetId.has(placedObject.assetId)) {
        const sourceAsset = this.project.assets.find(
          (asset) => asset.id === placedObject.assetId,
        );
        candidatesByAssetId.set(placedObject.assetId, {
          assetId: placedObject.assetId,
          asset: sourceAsset,
          fallbackName: placedObject.name || placedObject.assetId,
          count: 0,
        });
      }
      candidatesByAssetId.get(placedObject.assetId).count += 1;
    });

    return Array.from(candidatesByAssetId.values())
      .map((candidate) => ({
        ...candidate,
        label: this.formatReplaceMatchingCandidateLabel(candidate),
      }))
      .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label));
  }

  formatReplaceMatchingCandidateLabel(candidate) {
    const matchText = `${candidate.count} match${candidate.count === 1 ? "" : "es"}`;
    if (!candidate.asset) {
      return `Missing asset [${candidate.assetId}] - ${matchText}`;
    }

    const assetName = candidate.asset.name || candidate.fallbackName || candidate.assetId;
    const categoryName = candidate.asset.category || "Unknown category";
    const fileName = candidate.asset.fileName || candidate.asset.filename || candidate.asset.originalName;
    const fileText = fileName ? ` - ${fileName}` : "";
    return `${assetName} (${categoryName})${fileText} [${candidate.assetId}] - ${matchText}`;
  }

  createSkippedAssetParts(hiddenCount, lockedCount) {
    const skippedParts = [];
    if (hiddenCount > 0) {
      skippedParts.push(`${hiddenCount} hidden`);
    }
    if (lockedCount > 0) {
      skippedParts.push(`${lockedCount} locked`);
    }
    return skippedParts;
  }

  refreshPlacedAssetMarkers() {
    const level = getCurrentLevel(this.project);
    this.gridEditor.refreshPlacedObjects(
      level,
      this.project.assets,
      this.selectedPlacedObjectId,
      Array.from(this.selectedPlacedObjectIds),
    );
    this.gridEditor.setLayerVisibility(this.layerVisibility);
    this.gridEditor.setLayerLocks(this.layerLocks);
    this.gridEditor.updateSelection(this.selectedRanges.length > 0 ? null : this.selectedRange);
    this.gridEditor.updateMultiSelections(this.selectedRanges);
    this.syncAssetMenu();
    this.syncAreaToolMenu();
  }

  async placeAssetInRange(asset, range, source) {
    if (!asset) {
      this.setStatus("No asset selected.");
      return false;
    }

    if (!range) {
      this.setStatus("No grid area selected.");
      return false;
    }

    if (asset.isImported && (!asset.src || typeof asset.src !== "string")) {
      this.setStatus("Asset image data missing.");
      return false;
    }

    if (this.isLayerLocked(asset.defaultLayer || "objects")) {
      this.setStatus(
        `Asset placement blocked: layer "${normalizePlacedLayer(
          asset.defaultLayer || "objects",
        )}" is locked.`,
      );
      return false;
    }

    const level = getCurrentLevel(this.project);
    const targetLayer = this.getAssetPlacementLayer(asset);
    const existing = findObjectsInRange(
      level,
      range.x,
      range.y,
      range.width,
      range.height,
      [targetLayer],
    );

    if (this.blockActionForTargetLayerOverlaps(existing, "Asset placement")) {
      return false;
    }

    if (existing.length > 0) {
      const confirmed = await this.showConfirmModal({
        title: "Replace Existing Assets?",
        message: this.createOverlapWarningMessage(
          "Placing this asset will replace existing assets in the selected area. Continue?",
          existing,
        ),
        confirmLabel: "Place Asset",
      });

      if (!confirmed) {
        this.setStatus("Placement cancelled.");
        this.render();
        return false;
      }
    }

    const historySnapshot = this.captureHistorySnapshot();
    const placedObject = placeAsset(level, asset, range.x, range.y, range.width, range.height);
    this.selectionState = this.selectedRange ? "selectionReady" : "idle";
    this.clearPlacedObjectSelection();
    console.info("Placed asset", {
      source,
      assetId: asset.id,
      assetName: asset.name,
      range: placedObject.rangeRef,
      levelId: level.id,
      placedObject,
    });
    this.render();
    this.pushHistoryEntry("Place asset", historySnapshot);
    this.autosave(`Placed ${asset.name} at ${placedObject.rangeRef} on ${level.name}.`);
    return true;
  }

  getPlacementRangeForCell(x, y) {
    if (
      this.selectionState === "selectionReady" &&
      this.selectedRange &&
      rangeContains(this.selectedRange, x, y)
    ) {
      return this.selectedRange;
    }

    return { x, y, width: 1, height: 1 };
  }

  addSelectedArea(range, { seedRange = null } = {}) {
    const normalizedRange = { ...range };
    if (
      seedRange &&
      this.selectedRanges.length === 0 &&
      !rangesMatch(seedRange, normalizedRange)
    ) {
      this.selectedRanges.push({ ...seedRange });
    }
    this.selectedRange = normalizedRange;
    this.selectedRanges = this.selectedRanges.filter(
      (selectedRange) => !rangesMatch(selectedRange, normalizedRange),
    );
    this.selectedRanges.push(normalizedRange);
    this.selectionState = "selectionReady";
    this.gridEditor.updateSelection(null);
    this.gridEditor.updateMultiSelections(this.selectedRanges);
    this.syncCoordinateStatus();
    this.syncPlacementButton();
    this.syncAreaToolMenu();
  }

  getSelectedAreaRanges() {
    if (this.selectedRanges.length > 0) {
      return this.selectedRanges.map((range) => ({ ...range }));
    }

    if (this.selectedRange && this.selectionState === "selectionReady") {
      return [{ ...this.selectedRange }];
    }

    return [];
  }

  getUniqueSelectedCells(ranges = this.getSelectedAreaRanges()) {
    const cells = [];
    const cellKeys = new Set();
    ranges.forEach((range) => {
      for (let y = range.y; y < range.y + range.height; y += 1) {
        for (let x = range.x; x < range.x + range.width; x += 1) {
          const key = `${x}:${y}`;
          if (cellKeys.has(key)) {
            continue;
          }
          cellKeys.add(key);
          cells.push({ x, y });
        }
      }
    });
    return cells;
  }

  findObjectsInSelectedAreas(ranges = this.getSelectedAreaRanges(), layerNames = LAYERS) {
    const level = getCurrentLevel(this.project);
    const objectsById = new Map();
    ranges.forEach((range) => {
      findObjectsInRange(level, range.x, range.y, range.width, range.height, layerNames).forEach(
        (placedObject) => {
          if (!objectsById.has(placedObject.id)) {
            objectsById.set(placedObject.id, placedObject);
          }
        },
      );
    });
    return Array.from(objectsById.values());
  }

  getAssetPlacementLayer(asset) {
    return normalizePlacedLayer(asset?.defaultLayer || "objects");
  }

  getPlacedObjectTargetLayer(placedObject) {
    return normalizePlacedLayer(placedObject?.layer || "objects");
  }

  findTargetLayerOverlaps(level, range, targetLayer, excludedIds = new Set()) {
    const excluded = excludedIds instanceof Set
      ? excludedIds
      : new Set(Array.isArray(excludedIds) ? excludedIds : []);
    return findObjectsInRange(
      level,
      range.x,
      range.y,
      range.width,
      range.height,
      [normalizePlacedLayer(targetLayer)],
    ).filter((placedObject) => !excluded.has(placedObject.id));
  }

  findSelectableObjectsInSelectedAreas(ranges = this.getSelectedAreaRanges()) {
    return this.findObjectsInSelectedAreas(ranges).filter(
      (placedObject) => this.canSelectPlacedObject(placedObject),
    );
  }

  syncPlacedObjectSelectionForSelectedAreas(
    ranges = this.getSelectedAreaRanges(),
    { additive = false } = {},
  ) {
    const selectedObjects = this.findSelectableObjectsInSelectedAreas(ranges);
    if (selectedObjects.length === 0) {
      if (additive) {
        return [];
      }
      this.selectedPlacedObjectId = null;
      this.selectedPlacedObjectIds = new Set();
      return [];
    }

    if (additive) {
      const nextIds = new Set(this.selectedPlacedObjectIds);
      selectedObjects.forEach((placedObject) => {
        nextIds.add(placedObject.id);
      });
      const previousPrimaryId = this.selectedPlacedObjectId;
      this.selectedPlacedObjectIds = nextIds;
      this.selectedPlacedObjectId = nextIds.has(previousPrimaryId)
        ? previousPrimaryId
        : selectedObjects[0].id;
      return selectedObjects;
    }

    this.selectedPlacedObjectId = selectedObjects[0].id;
    this.selectedPlacedObjectIds = new Set(
      selectedObjects.map((placedObject) => placedObject.id),
    );
    return selectedObjects;
  }

  createMultiAreaSelectionStatus(ranges = this.selectedRanges) {
    const cells = this.getUniqueSelectedCells(ranges);
    return `Selected: ${ranges.length} areas / ${cells.length} cells.`;
  }

  clearSelection() {
    if (this.selectionConfirmationTimer) {
      window.clearTimeout(this.selectionConfirmationTimer);
      this.selectionConfirmationTimer = null;
    }
    this.selectedRange = null;
    this.selectedRanges = [];
    this.selectionState = "idle";
    this.dropPreviewRange = null;
    this.gridEditor.cancelGesture();
    this.gridEditor.updateSelection(null);
    this.gridEditor.updateMultiSelections([]);
    this.gridEditor.updateDropPreview(null);
    this.syncCoordinateStatus();
    this.syncPlacementButton();
  }

  clearGridAreaSelection() {
    if (this.selectionConfirmationTimer) {
      window.clearTimeout(this.selectionConfirmationTimer);
      this.selectionConfirmationTimer = null;
    }
    this.selectedRange = null;
    this.selectedRanges = [];
    this.selectionState = "idle";
    this.dropPreviewRange = null;
    this.gridEditor.updateSelection(null);
    this.gridEditor.updateMultiSelections([]);
    this.gridEditor.updateDropPreview(null);
    this.syncCoordinateStatus();
    this.syncPlacementButton();
  }

  setSelectionReadyStatus() {
    if (this.selectedRanges.length > 1) {
      this.setStatus(`${this.createMultiAreaSelectionStatus()} Use Fill, Clear, or Replace Matching Assets from Edit.`);
      this.syncPlacementButton();
      return;
    }

    const selected = `${toGridRef(this.selectedRange.x, this.selectedRange.y)} to ${toGridRef(
      this.selectedRange.x + this.selectedRange.width - 1,
      this.selectedRange.y + this.selectedRange.height - 1,
    )}`;
    this.setStatus(`Selected: ${selected}. Drag an asset here to place one stretched asset.`);
    this.syncPlacementButton();
  }

  async createCategory() {
    const name = await this.showPromptModal({
      title: "Create Category",
      label: "Category name",
      value: "New Category",
      confirmLabel: "Create Category",
    });

    if (!name?.trim()) {
      this.setStatus("Create category cancelled.");
      return;
    }

    if (findAssetCategoryByName(this.project, name.trim())) {
      this.setStatus("Category already exists.");
      await this.showAlertModal("Category already exists.", {
        title: "Category Already Exists",
      });
      this.render();
      return;
    }

    const category = addAssetCategory(this.project, name.trim());
    this.render();
    this.autosave(`Created category ${category.name}.`);
  }

  cleanEmptyCategories() {
    const removedCount = removeEmptyAssetCategories(this.project);

    if (removedCount === 0) {
      this.setStatus("No empty asset categories to clean.");
      this.render();
      return;
    }

    this.render();
    this.autosave(
      `Removed ${removedCount} empty asset categor${removedCount === 1 ? "y" : "ies"}. Assets were kept.`,
    );
  }

  async deleteCategory(category) {
    const categoryAssets = this.project.assetRegistry.assets.filter(
      (asset) => asset.categoryId === category.id || asset.category === category.name,
    );
    const assetCount = categoryAssets.length;

    if (assetCount === 0) {
      const confirmed = await this.showConfirmModal({
        title: `Delete "${category.name}"?`,
        message: "Delete this empty category? Placed grid assets are not affected.",
        confirmLabel: "Delete Category",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      const historySnapshot = this.captureHistorySnapshot();
      deleteAssetCategory(this.project, category.id);
      this.render();
      this.pushHistoryEntry("Delete category", historySnapshot);
      this.autosave(`Deleted category ${category.name}.`);
      return;
    }

    const placedCopyCount = countPlacedObjectsByAssetIds(
      this.project,
      categoryAssets.map((asset) => asset.id),
    );
    const confirmed = await this.showConfirmModal({
      title: `Delete category "${category.name}"?`,
      message: `This will delete ${assetCount} source asset${assetCount === 1 ? "" : "s"} from the category and remove ${placedCopyCount} placed grid cop${placedCopyCount === 1 ? "y" : "ies"} across all levels. Continue?`,
      confirmLabel: "Delete Category and Copies",
      danger: true,
    });
    if (!confirmed) {
      this.setStatus("Category deletion cancelled.");
      return;
    }

    const historySnapshot = this.captureHistorySnapshot();
    const removedObjects = removePlacedObjectsByAssetIds(
      this.project,
      categoryAssets.map((asset) => asset.id),
    );
    const result = deleteAssetCategoryWithAssets(this.project, category.id);
    if (!result.deleted) {
      this.setStatus("Category was not found.");
      return;
    }
    if (categoryAssets.some((asset) => this.selectedAsset?.id === asset.id)) {
      this.selectedAsset = this.project.assets[0] || null;
    }
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.render();
    this.pushHistoryEntry("Delete category", historySnapshot);
    this.autosave(
      `Deleted category "${category.name}", ${assetCount} source asset${assetCount === 1 ? "" : "s"} and ${removedObjects.length} placed cop${removedObjects.length === 1 ? "y" : "ies"}.`,
    );
  }

  async deleteAsset(asset) {
    const placedCopyCount = countPlacedObjectsByAssetIds(this.project, [asset.id]);
    const isUsed = placedCopyCount > 0 || isAssetUsedOnAnyLevel(this.project, asset.id);

    const confirmed = await this.showConfirmModal({
      title: `Delete "${asset.name}"?`,
      message: isUsed
        ? `This asset is used ${placedCopyCount} time${placedCopyCount === 1 ? "" : "s"} on the grid across all levels. Deleting it will also remove all ${placedCopyCount} placed cop${placedCopyCount === 1 ? "y" : "ies"}. Continue?`
        : "Delete this imported palette asset? Placed grid copies are not affected.",
      confirmLabel: isUsed ? "Delete Asset and Copies" : "Delete Asset",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    const historySnapshot = this.captureHistorySnapshot();
    const removedObjects = removePlacedObjectsByAssetIds(this.project, [asset.id]);
    deleteImportedAsset(this.project, asset.id);
    if (this.selectedAsset?.id === asset.id) {
      this.selectedAsset = this.project.assets[0] || null;
    }
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.render();
    this.pushHistoryEntry("Delete source asset", historySnapshot);
    this.autosave(
      removedObjects.length > 0
        ? `Deleted asset and removed ${removedObjects.length} placed cop${removedObjects.length === 1 ? "y" : "ies"}.`
        : `Deleted asset ${asset.name}.`,
    );
  }

  async deleteSelectedSourceAssets(assets) {
    const selectedAssets = (assets || [])
      .map((asset) =>
        this.project.assetRegistry.assets.find((candidate) => candidate.id === asset.id),
      )
      .filter(Boolean);
    const uniqueAssets = Array.from(
      new Map(selectedAssets.map((asset) => [asset.id, asset])).values(),
    );

    if (uniqueAssets.length <= 1) {
      this.setStatus("Select multiple source assets to bulk delete.");
      return false;
    }

    const assetIds = uniqueAssets.map((asset) => asset.id);
    const placedCopyCount = countPlacedObjectsByAssetIds(this.project, assetIds);
    const confirmed = await this.showConfirmModal({
      title: `Delete ${uniqueAssets.length} selected source assets?`,
      message: `This will also remove ${placedCopyCount} placed grid cop${placedCopyCount === 1 ? "y" : "ies"} across all levels. Continue?`,
      confirmLabel: "Delete Selected Assets",
      danger: true,
    });

    if (!confirmed) {
      this.setStatus("Bulk source asset deletion cancelled.");
      return false;
    }

    const historySnapshot = this.captureHistorySnapshot();
    const removedObjects = removePlacedObjectsByAssetIds(this.project, assetIds);
    assetIds.forEach((assetId) => {
      deleteImportedAsset(this.project, assetId);
    });
    if (this.selectedAsset && assetIds.includes(this.selectedAsset.id)) {
      this.selectedAsset = this.project.assets[0] || null;
    }
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.render();
    this.pushHistoryEntry("Delete source assets", historySnapshot);
    this.autosave(
      `Deleted ${uniqueAssets.length} source asset${uniqueAssets.length === 1 ? "" : "s"} and removed ${removedObjects.length} placed cop${removedObjects.length === 1 ? "y" : "ies"} across all levels.`,
    );
    return true;
  }

  async importAsset() {
    const pendingPlacementRange =
      this.selectionState === "selectionReady" && this.selectedRange
        ? { ...this.selectedRange }
        : null;
    const files = await this.pickImageFiles();

    if (!files.length) {
      this.setStatus("Import asset cancelled.");
      return;
    }

    let sources;
    try {
      sources = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
    } catch (error) {
      console.error("Asset image could not be read.", error);
      this.setStatus("Asset image data missing.");
      return;
    }
    const assetData = await this.collectAssetMetadata(files, sources);

    if (!assetData) {
      this.setStatus("Import asset cancelled.");
      return;
    }

    let importedAssets;
    try {
      importedAssets = assetData.assets.map((asset) => addImportedAsset(this.project, asset));
    } catch (error) {
      console.error("Asset category assignment failed.", error);
      this.setStatus("Please create a category for these assets.");
      return;
    }

    this.selectedAsset = importedAssets[0] || null;
    this.render();
    await this.autosave(
      `Imported ${importedAssets.length} asset${importedAssets.length === 1 ? "" : "s"} into ${assetData.category.name}.`,
    );

    if (pendingPlacementRange && importedAssets.length === 1) {
      const [importedAsset] = importedAssets;
      const confirmed = await this.showConfirmModal({
        title: "Place Imported Asset?",
        message: "Place this asset into the selected grid area?",
        confirmLabel: "Place Asset",
      });

      if (confirmed) {
        await this.placeAssetInRange(importedAsset, pendingPlacementRange, "import");
      } else {
        this.setStatus(
          `Asset added to ${importedAsset.category}. Drag it from the asset panel onto the grid or use Paint mode to drag-paint it.`,
        );
      }
      return;
    }

    if (pendingPlacementRange && importedAssets.length > 1) {
      this.setStatus(
        `Imported ${importedAssets.length} assets. Select one asset to place into the selected grid area.`,
      );
      return;
    }

    this.setStatus(
      `Imported ${importedAssets.length} asset${importedAssets.length === 1 ? "" : "s"} into ${assetData.category.name}. Select or drag an asset to place it.`,
    );
  }

  async pickImageFiles() {
    if (typeof window.showOpenFilePicker === "function") {
      try {
        const fileHandles = await window.showOpenFilePicker({
          types: [
            {
              description: "Image files",
              accept: {
                "image/png": [".png"],
                "image/jpeg": [".jpg", ".jpeg"],
                "image/webp": [".webp"],
              },
            },
          ],
          multiple: true,
        });

        return Promise.all(fileHandles.map((fileHandle) => fileHandle.getFile()));
      } catch (error) {
        if (error?.name === "AbortError") {
          return [];
        }

        console.warn("File System Access picker failed, falling back to file input.", error);
      }
    }

    return pickImagesWithInput();
  }

  collectAssetMetadata(files, sources) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "asset-import-dialog";
      const categories = this.project.assetRegistry.categories;
      const noCategories = categories.length === 0;
      const previews = files
        .map((file, index) => {
          const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
          return `
            <label class="asset-import-item">
              <img class="asset-import-thumbnail" src="${sources[index]}" alt="" />
              <span>Asset name</span>
              <input name="name-${index}" value="${escapeAttribute(toTitleCase(safeName))}" required />
            </label>
          `;
        })
        .join("");

      dialog.innerHTML = `
        <form class="asset-import-form">
          <h2>Import Asset${files.length === 1 ? "" : "s"}</h2>
          <div class="asset-import-previews">${previews}</div>
          <label>
            Category
            <select name="categoryId" ${noCategories ? "disabled" : ""}>
              ${noCategories
                ? '<option value="">No available categories</option>'
                : categories
                    .map(
                      (category) =>
                        `<option value="${escapeAttribute(category.id)}">${escapeHtml(category.name)}</option>`,
                    )
                    .join("")}
            </select>
          </label>
          <label>
            New category
            <input name="newCategory" placeholder="Optional" />
          </label>
          <div class="dialog-actions">
            <button type="button" value="cancel" data-action="cancel-import">Cancel</button>
            <button type="submit" value="confirm">Add to Palette</button>
          </div>
          <p class="form-error" role="alert" hidden></p>
        </form>
      `;

      document.body.append(dialog);

      dialog.querySelector('[data-action="cancel-import"]').addEventListener("click", () => {
        dialog.close("cancel");
      });

      const form = dialog.querySelector("form");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        let categoryId = data.get("categoryId");
        const newCategoryName = String(data.get("newCategory") || "").trim();

        if (newCategoryName) {
          categoryId = addAssetCategory(this.project, newCategoryName).id;
        }

        const category = this.project.assetRegistry.categories.find(
          (candidate) => candidate.id === categoryId,
        );

        if (!category) {
          const error = form.querySelector(".form-error");
          error.hidden = false;
          error.textContent = "Please create a category for these assets.";
          return;
        }

        dialog.remove();
        resolve({
          category,
          assets: files.map((file, index) => ({
            name: String(data.get(`name-${index}`) || file.name).trim(),
            categoryId: category.id,
            src: sources[index],
            fileName: file.name,
            defaultLayer: "objects",
            collisionEnabled: false,
            solid: false,
            blocksMovement: false,
            transparent: true,
            visible: true,
            defaultWidth: 1,
            defaultHeight: 1,
          })),
        });
      });

      dialog.addEventListener("close", () => {
        if (dialog.isConnected) {
          dialog.remove();
          resolve(null);
        }
      });

      dialog.showModal();
    });
  }

  async resizeGrid(width, height) {
    const requestedWidth = Math.round(Number(width));
    const requestedHeight = Math.round(Number(height));

    if (
      !Number.isInteger(requestedWidth) ||
      !Number.isInteger(requestedHeight) ||
      requestedWidth < 1 ||
      requestedHeight < 1
    ) {
      this.setStatus("Enter a grid width and height of at least 1.");
      this.render();
      return;
    }

    if (requestedWidth > MAX_GRID_SIZE || requestedHeight > MAX_GRID_SIZE) {
      await this.showAlertModal(
        "Grid sizes above 500x500 are not supported yet. Future chunked maps will be better for very large worlds.",
        {
          title: "Grid Too Large",
        },
      );
      this.setStatus(`Grid size must be ${MAX_GRID_SIZE}x${MAX_GRID_SIZE} or smaller.`);
      this.render();
      return;
    }

    const warning = this.getLargeGridWarning(requestedWidth, requestedHeight);
    if (warning) {
      const confirmed = await this.showConfirmModal(warning);

      if (!confirmed) {
        this.render();
        return;
      }
    }

    const level = getCurrentLevel(this.project);
    const outsideCount = countObjectsOutsideBounds(level, requestedWidth, requestedHeight);

    if (outsideCount > 0) {
      const confirmed = await this.showConfirmModal({
        title: "Resize Grid?",
        message: `${outsideCount} placed asset(s) are outside the new grid size and will be removed. Continue?`,
        confirmLabel: "Resize Grid",
        danger: true,
      });

      if (!confirmed) {
        this.render();
        return;
      }
    }

    if (outsideCount > 0) {
      createProjectBackup(this.project, `Before resizing ${level.name} to ${requestedWidth}x${requestedHeight}`);
    }
    resizeCurrentLevel(this.project, requestedWidth, requestedHeight);
    this.clearSelection();
    this.clearPlacedObjectSelection();
    this.autosave(`Grid resized to ${requestedWidth}x${requestedHeight}.`);
    this.render();
  }

  getLargeGridWarning(width, height) {
    const largestDimension = Math.max(width, height);

    if (largestDimension > VERY_LARGE_GRID_WARNING_SIZE) {
      return {
        title: "Very Large Grid",
        message:
          "Very large grids may affect scrolling, saving, and future Play Mode performance. Consider using multiple levels or future chunked maps. Continue?",
        confirmLabel: "Create Very Large Grid",
        danger: true,
      };
    }

    if (largestDimension > LARGE_GRID_WARNING_SIZE) {
      return {
        title: "Large Grid",
        message: "Large grids may affect editor performance. Continue?",
        confirmLabel: "Create Large Grid",
      };
    }

    return null;
  }

  captureHistorySnapshot() {
    return JSON.stringify({
      lastOpenedLevelId: this.project.lastOpenedLevelId,
      levels: this.project.levels,
      assetRegistry: this.project.assetRegistry,
    });
  }

  pushHistoryEntry(label, beforeSnapshot) {
    if (!beforeSnapshot) {
      return false;
    }

    const afterSnapshot = this.captureHistorySnapshot();
    if (beforeSnapshot === afterSnapshot) {
      return false;
    }

    this.undoStack.push({
      label,
      before: beforeSnapshot,
      after: afterSnapshot,
    });
    if (this.undoStack.length > HISTORY_LIMIT) {
      this.undoStack.splice(0, this.undoStack.length - HISTORY_LIMIT);
    }
    this.redoStack = [];
    this.syncHistoryControls();
    return true;
  }

  restoreHistorySnapshot(snapshot) {
    const restored = JSON.parse(snapshot);
    this.project.lastOpenedLevelId = restored.lastOpenedLevelId;
    this.project.levels = restored.levels;
    this.project.assetRegistry = restored.assetRegistry || { categories: [], assets: [] };
    this.project.assets = this.project.assetRegistry.assets || [];
    this.selectedAsset = this.selectedAsset?.id
      ? this.project.assets.find((asset) => asset.id === this.selectedAsset.id) || this.project.assets[0] || null
      : this.project.assets[0] || null;
    this.clearSelection();
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.cancelCopyPlacement();
  }

  undo() {
    if (this.isPlayModeActive) {
      this.setStatus("Undo is disabled in Play Mode.");
      this.syncHistoryControls();
      return false;
    }

    const entry = this.undoStack.pop();
    if (!entry) {
      this.setStatus("Nothing to undo.");
      this.syncHistoryControls();
      return false;
    }

    this.redoStack.push(entry);
    this.restoreHistorySnapshot(entry.before);
    this.render();
    this.autosave(`Undid ${entry.label}.`);
    this.syncHistoryControls();
    return true;
  }

  redo() {
    if (this.isPlayModeActive) {
      this.setStatus("Redo is disabled in Play Mode.");
      this.syncHistoryControls();
      return false;
    }

    const entry = this.redoStack.pop();
    if (!entry) {
      this.setStatus("Nothing to redo.");
      this.syncHistoryControls();
      return false;
    }

    this.undoStack.push(entry);
    this.restoreHistorySnapshot(entry.after);
    this.render();
    this.autosave(`Redid ${entry.label}.`);
    this.syncHistoryControls();
    return true;
  }

  syncHistoryControls() {
    if (!this.ui.undoButtons?.length || !this.ui.redoButtons?.length) {
      return;
    }

    if (this.isPlayModeActive) {
      this.ui.undoButtons.forEach((button) => {
        button.disabled = true;
        button.title = "Undo disabled in Play Mode";
        button.setAttribute("aria-label", button.title);
        if (!button.classList.contains("quick-history-button")) {
          button.textContent = "Undo";
        }
      });
      this.ui.redoButtons.forEach((button) => {
        button.disabled = true;
        button.title = "Redo disabled in Play Mode";
        button.setAttribute("aria-label", button.title);
        if (!button.classList.contains("quick-history-button")) {
          button.textContent = "Redo";
        }
      });
      return;
    }

    const undoEntry = this.undoStack[this.undoStack.length - 1];
    const redoEntry = this.redoStack[this.redoStack.length - 1];
    this.ui.undoButtons.forEach((button) => {
      button.disabled = !undoEntry;
      button.title = undoEntry ? `Undo ${undoEntry.label}` : "Undo";
      button.setAttribute("aria-label", button.title);
      if (!button.classList.contains("quick-history-button")) {
        button.textContent = undoEntry ? `Undo ${undoEntry.label}` : "Undo";
      }
    });
    this.ui.redoButtons.forEach((button) => {
      button.disabled = !redoEntry;
      button.title = redoEntry ? `Redo ${redoEntry.label}` : "Redo";
      button.setAttribute("aria-label", button.title);
      if (!button.classList.contains("quick-history-button")) {
        button.textContent = redoEntry ? `Redo ${redoEntry.label}` : "Redo";
      }
    });
  }

  autosave(message, onSaveResult = null) {
    this.setStatus(message);
    this.saveQueue = this.saveQueue
      .then(() =>
        saveProject(this.project).then(() => {
          onSaveResult?.(true);
        }),
      )
      .catch((error) => {
        console.error("Could not save browser editor data.", error);
        onSaveResult?.(false);
        this.setStatus(`${message} Browser storage failed; this change may not survive refresh.`);
      });
    return this.saveQueue;
  }

  copyCurrentLevel() {
    this.copiedLevel = createCopiedLevelData(getCurrentLevel(this.project));
    localStorage.setItem(COPIED_LEVEL_STORAGE_KEY, JSON.stringify(this.copiedLevel));
    this.setStatus("Copied current level.");
  }

  async pasteCopiedLevel() {
    if (!this.copiedLevel) {
      this.setStatus("No copied level available.");
      return;
    }

    const currentLevel = getCurrentLevel(this.project);

    if (hasLevelContent(currentLevel)) {
      const confirmed = await this.showConfirmModal({
        title: "Paste Over Current Level?",
        message:
          "Pasting this level will replace the current level's grid size and all placed assets/objects on this level. Existing assets on this level may be lost. Continue?",
        confirmLabel: "Paste Level",
        danger: true,
      });

      if (!confirmed) {
        this.setStatus("Paste level cancelled.");
        return;
      }
    }

    pasteLevelContent(this.project, this.copiedLevel);
    this.clearSelection();
    this.clearPlacedObjectSelection();
    this.autosave("Pasted copied level into the current level.");
    this.render();
  }

  loadCopiedLevel() {
    const copiedLevel = localStorage.getItem(COPIED_LEVEL_STORAGE_KEY);

    if (!copiedLevel) {
      return null;
    }

    try {
      return JSON.parse(copiedLevel);
    } catch (error) {
      console.warn("Copied level data could not be loaded.", error);
      return null;
    }
  }

  async saveProjectFiles({ forceFolderPicker }) {
    this.autosave("Saved browser backup. Preparing project files...");

    const projectFiles = this.createProjectFiles();

    try {
      if (forceFolderPicker || !this.projectFolderHandle) {
        try {
          this.projectFolderHandle = await chooseProjectFolder();
        } catch (error) {
          if (error?.name === "AbortError") {
            throw error;
          }

          console.warn("Project folder picker was unavailable.", error);
          this.projectFolderHandle = null;
        }
      }

      if (!this.projectFolderHandle) {
        downloadProjectFiles(projectFiles);
        this.setStatus(
          "Your browser does not support choosing a project folder, so the project, asset registry, and level JSON files were downloaded instead.",
        );
        return;
      }

      await saveProjectFilesToFolder({
        folderHandle: this.projectFolderHandle,
        projectIndex: projectFiles.projectIndex,
        levels: projectFiles.levels,
        assetRegistry: projectFiles.assetRegistry,
      });
      this.setStatus(
        "Saved active project JSON, active level JSON files, and assets/assetRegistry.json into the selected Game Dev Kit folder. Previously deleted level JSON files are retained on disk.",
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        this.setStatus("Save cancelled.");
        return;
      }

      console.error(error);
      this.setStatus("Could not save project files.");
    }
  }

  createProjectFiles() {
    return {
      projectIndex: createProjectIndex(this.project),
      assetRegistry: createAssetRegistryData(this.project),
      levels: this.project.levels.map((level) => ({
        filename: level.filename || `${level.id}.json`,
        data: createLevelFileData(level),
      })),
    };
  }

  render() {
    const level = getCurrentLevel(this.project);
    this.assetPalette.assetRegistry = this.project.assetRegistry;
    this.assetPalette.selectedAssetId = this.selectedAsset?.id || null;
    this.assetPalette.render();
    this.gridEditor.setInteractionMode(this.activeTool === "paint" ? "move" : this.activeTool);
    this.gridEditor.render(
      level,
      this.project.assets,
      this.selectedRanges.length > 0 ? null : this.selectedRange,
      this.dropPreviewRange,
      this.selectedPlacedObjectId,
      Array.from(this.selectedPlacedObjectIds),
      this.createCopyPreview(),
      this.selectedRanges,
    );
    this.gridEditor.setLayerVisibility(this.layerVisibility);
    this.gridEditor.setLayerLocks(this.layerLocks);
    this.gridEditor.syncPlacedObjectSelection(
      this.selectedPlacedObjectId,
      Array.from(this.selectedPlacedObjectIds),
    );
    this.syncLevelSelector(level);
    this.syncGridControls(level);
    this.syncToolButtons();
    this.syncLayerVisibilityControls();
    this.syncLayerLockControls();
    this.syncCoordinateStatus();
    this.syncPlacementButton();
    this.syncAreaToolMenu();
    this.syncAssetMenu();
    this.syncHistoryControls();
    this.syncPlayModeControls();
    this.ui.levelSummary.textContent = `${level.name} · ${level.gridWidth}x${level.gridHeight} · ${level.tileSize}px tiles`;
  }

  syncLevelSelector(currentLevel) {
    this.ui.selectedLevelName.textContent = currentLevel.name;
    this.ui.levelPickerPanel.innerHTML = "";

    this.project.levels.forEach((level) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "level-option";
      option.draggable = true;
      option.dataset.levelId = level.id;
      option.classList.toggle("is-active", level.id === currentLevel.id);

      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.setAttribute("aria-hidden", "true");
      handle.textContent = "☰";

      const name = document.createElement("span");
      name.textContent = level.name;

      option.append(handle, name);

      option.addEventListener("click", () => {
        const selectedLevel = switchLevel(this.project, level.id);
        this.clearSelection();
        this.clearPlacedObjectSelection();
        this.closeLevelPicker();
        this.autosave(`Opened ${selectedLevel.name}.`);
        this.render();
      });

      option.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", level.id);
      });

      option.addEventListener("dragover", (event) => {
        event.preventDefault();
        option.classList.add("is-drag-over");
      });

      option.addEventListener("dragleave", () => {
        option.classList.remove("is-drag-over");
      });

      option.addEventListener("drop", (event) => {
        event.preventDefault();
        option.classList.remove("is-drag-over");
        const draggedLevelId = event.dataTransfer.getData("text/plain");
        const rect = option.getBoundingClientRect();
        const placement = event.clientY > rect.top + rect.height / 2 ? "after" : "before";
        reorderLevel(this.project, draggedLevelId, level.id, placement);
        this.autosave("Reordered levels.");
        this.render();
        this.ui.levelPicker.classList.add("is-open");
      });

      this.ui.levelPickerPanel.append(option);
    });
  }

  syncGridControls(level) {
    const sameSize = level.gridWidth === level.gridHeight;
    const preset = sameSize && GRID_SIZE_PRESETS.includes(String(level.gridWidth))
      ? String(level.gridWidth)
      : "custom";

    this.ui.gridSize.value = preset;
    this.ui.customSize.classList.toggle("is-visible", preset === "custom");
    this.ui.customWidth.value = String(level.gridWidth);
    this.ui.customHeight.value = String(level.gridHeight);
  }

  syncToolButtons() {
    this.root.querySelectorAll("[data-tool]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tool === this.activeTool);
      button.disabled = this.isPlayModeActive;
    });
    this.ui.paintOnlyControls.hidden = this.activeTool !== "paint";
    this.ui.paintBrushSize.value = String(this.paintBrushSize);
    this.syncPaintVariantsButton();
  }

  syncPlayModeControls() {
    this.root.classList.toggle("is-play-mode-active", this.isPlayModeActive);
    this.ui.playModeButton.classList.toggle("is-active", this.isPlayModeActive);
    this.ui.playModeButton.textContent = this.isPlayModeActive ? "Stop" : "Play";
    this.ui.playModeButton.title = this.isPlayModeActive
      ? "Exit Play Mode preview"
      : "Start Play Mode preview";
    this.ui.playModeButton.setAttribute(
      "aria-label",
      this.isPlayModeActive ? "Exit Play Mode preview" : "Start Play Mode preview",
    );
    this.ui.playModeButton.setAttribute("aria-pressed", String(this.isPlayModeActive));
    [
      this.ui.levelPickerButton,
      ...this.root.querySelectorAll(".level-controls > button, .grid-controls button, .grid-controls select, .grid-controls input"),
      this.ui.paintBrushSize,
      this.ui.paintVariantsButton,
      this.ui.addPlayerSpawnButton,
      this.ui.copySelectedAssetsButton,
      this.ui.cutSelectedAssetsButton,
      this.ui.duplicateSelectedAssetsButton,
      this.ui.fillSelectedAreaButton,
      this.ui.clearSelectedAreaButton,
      this.ui.replaceMatchingAssetsButton,
      this.ui.editPropertiesButton,
      ...this.ui.layerVisibilityInputs,
      ...this.ui.layerLockInputs,
      ...this.root.querySelectorAll("[data-action='show-all-layers'], [data-action='unlock-all-layers'], [data-action='placed-asset-properties']"),
    ].filter(Boolean).forEach((control) => {
      control.disabled = this.isPlayModeActive;
    });
    this.syncToolButtons();
  }

  loadPaintBrushSize() {
    try {
      return normalizePaintBrushSize(localStorage.getItem(PAINT_BRUSH_SIZE_STORAGE_KEY));
    } catch (error) {
      console.warn("Paint brush size preference could not be loaded.", error);
      return 1;
    }
  }

  savePaintBrushSize() {
    try {
      localStorage.setItem(PAINT_BRUSH_SIZE_STORAGE_KEY, String(this.paintBrushSize));
    } catch (error) {
      console.warn("Paint brush size preference could not be saved.", error);
    }
  }

  loadPaintVariantAssetIds() {
    try {
      const storedIds = JSON.parse(localStorage.getItem(PAINT_VARIANT_ASSET_IDS_STORAGE_KEY));
      return Array.isArray(storedIds)
        ? storedIds.filter((assetId) => typeof assetId === "string")
        : [];
    } catch (error) {
      console.warn("Paint variant preference could not be loaded.", error);
      return [];
    }
  }

  savePaintVariantAssetIds() {
    try {
      localStorage.setItem(
        PAINT_VARIANT_ASSET_IDS_STORAGE_KEY,
        JSON.stringify(this.paintVariantAssetIds),
      );
    } catch (error) {
      console.warn("Paint variant preference could not be saved.", error);
    }
  }

  loadPaintVariantExpandedCategoryIds() {
    try {
      const storedIds = JSON.parse(localStorage.getItem(PAINT_VARIANT_EXPANDED_CATEGORIES_STORAGE_KEY));
      if (!Array.isArray(storedIds)) {
        return [];
      }
      const availableIds = new Set(this.getPaintVariantCategoryGroups(this.getAvailablePaintVariantAssets()).map(
        (group) => String(group.id || group.name || "uncategorised"),
      ));
      return storedIds.filter((categoryId) => typeof categoryId === "string" && availableIds.has(categoryId));
    } catch (error) {
      console.warn("Paint variant category expansion preference could not be loaded.", error);
      return [];
    }
  }

  savePaintVariantExpandedCategoryIds(categoryIds) {
    try {
      localStorage.setItem(
        PAINT_VARIANT_EXPANDED_CATEGORIES_STORAGE_KEY,
        JSON.stringify(Array.isArray(categoryIds) ? categoryIds.filter((categoryId) => typeof categoryId === "string") : []),
      );
    } catch (error) {
      console.warn("Paint variant category expansion preference could not be saved.", error);
    }
  }

  syncPaintVariantsButton() {
    const count = this.getActivePaintVariantCount();
    this.ui.paintVariantsButton.textContent = count > 0 ? `Variants: ${count} assets` : "Variants: Off";
    this.ui.paintVariantsButton.classList.toggle("is-active", count > 0);
  }

  getBrushSizeLabel(size = this.paintBrushSize) {
    const brushSize = normalizePaintBrushSize(size);
    return `${brushSize}x${brushSize}`;
  }

  loadLayerVisibility() {
    const defaults = Object.fromEntries(LAYERS.map((layerName) => [layerName, true]));
    const storedVisibility = localStorage.getItem(LAYER_VISIBILITY_STORAGE_KEY);

    if (!storedVisibility) {
      return defaults;
    }

    try {
      const parsedVisibility = JSON.parse(storedVisibility);
      if (
        !parsedVisibility ||
        typeof parsedVisibility !== "object" ||
        Array.isArray(parsedVisibility)
      ) {
        return defaults;
      }

      return Object.fromEntries(
        LAYERS.map((layerName) => [layerName, parsedVisibility[layerName] !== false]),
      );
    } catch (error) {
      console.warn("Layer visibility preferences could not be loaded.", error);
      return defaults;
    }
  }

  saveLayerVisibility() {
    try {
      localStorage.setItem(
        LAYER_VISIBILITY_STORAGE_KEY,
        JSON.stringify(this.layerVisibility),
      );
    } catch (error) {
      console.warn("Layer visibility preferences could not be saved.", error);
    }
  }

  loadLayerLocks() {
    const defaults = Object.fromEntries(LAYERS.map((layerName) => [layerName, false]));
    const storedLocks = localStorage.getItem(LAYER_LOCKS_STORAGE_KEY);

    if (!storedLocks) {
      return defaults;
    }

    try {
      const parsedLocks = JSON.parse(storedLocks);
      if (!parsedLocks || typeof parsedLocks !== "object" || Array.isArray(parsedLocks)) {
        return defaults;
      }

      return Object.fromEntries(
        LAYERS.map((layerName) => [layerName, parsedLocks[layerName] === true]),
      );
    } catch (error) {
      console.warn("Layer lock preferences could not be loaded.", error);
      return defaults;
    }
  }

  saveLayerLocks() {
    try {
      localStorage.setItem(LAYER_LOCKS_STORAGE_KEY, JSON.stringify(this.layerLocks));
    } catch (error) {
      console.warn("Layer lock preferences could not be saved.", error);
    }
  }

  getEditableLayerNames() {
    return LAYERS.filter(
      (layerName) =>
        this.layerVisibility[layerName] !== false &&
        this.layerLocks[layerName] !== true,
    );
  }

  isLayerVisible(layerName) {
    const normalizedLayer = layerName === "Trigger" ? "triggers" : layerName || "objects";
    return !LAYERS.includes(normalizedLayer) || this.layerVisibility[normalizedLayer] !== false;
  }

  isLayerLocked(layerName) {
    const normalizedLayer = normalizePlacedLayer(layerName);
    return LAYERS.includes(normalizedLayer) && this.layerLocks[normalizedLayer] === true;
  }

  isPlacedObjectProtected(placedObject) {
    return Boolean(
      placedObject &&
      (
        this.isLayerLocked(placedObject.layer) ||
        placedObject.editorLocked === true
      ),
    );
  }

  canSelectPlacedObject(placedObject) {
    return Boolean(
      placedObject &&
      this.isLayerVisible(placedObject.layer) &&
      !this.isLayerLocked(placedObject.layer),
    );
  }

  canEditPlacedObject(placedObject) {
    return Boolean(
      this.canSelectPlacedObject(placedObject) &&
      placedObject.editorLocked !== true,
    );
  }

  canUnlockPlacedObject(placedObject) {
    return this.canSelectPlacedObject(placedObject);
  }

  getPlacedObjectLockMessage(placedObject) {
    if (this.isLayerLocked(placedObject?.layer)) {
      return `Layer "${normalizePlacedLayer(placedObject.layer)}" is locked.`;
    }
    if (placedObject?.editorLocked === true) {
      return "This asset is locked.";
    }
    return "That asset is on a hidden editor layer.";
  }

  setLayerVisibility(layerName, isVisible) {
    if (!LAYERS.includes(layerName)) {
      return;
    }

    this.layerVisibility = {
      ...this.layerVisibility,
      [layerName]: Boolean(isVisible),
    };
    this.saveLayerVisibility();

    const level = getCurrentLevel(this.project);
    const editableObjects = getPlacedObjects(level, this.getEditableLayerNames()).filter(
      (placedObject) => placedObject.editorLocked !== true,
    );
    const editableIds = new Set(editableObjects.map((placedObject) => placedObject.id));
    const retainedIds = Array.from(this.selectedPlacedObjectIds).filter((id) =>
      editableIds.has(id),
    );
    const previousPrimaryId = this.selectedPlacedObjectId;

    this.selectedPlacedObjectIds = new Set(retainedIds);
    this.selectedPlacedObjectId = editableIds.has(previousPrimaryId)
      ? previousPrimaryId
      : retainedIds[0] || null;

    if (previousPrimaryId && !editableIds.has(previousPrimaryId)) {
      this.closePlacedPropertiesDialog();
    }

    if (
      this.copiedPlacedGroup &&
      this.copiedPlacedGroup.objects.some(
        ({ sourceObject }) =>
          !this.isLayerVisible(sourceObject.layer) ||
          this.isLayerLocked(sourceObject.layer) ||
          sourceObject.editorLocked === true,
      )
    ) {
      this.cancelCopyPlacement();
    }

    this.gridEditor.setLayerVisibility(this.layerVisibility);
    this.gridEditor.syncPlacedObjectSelection(
      this.selectedPlacedObjectId,
      Array.from(this.selectedPlacedObjectIds),
    );
    this.syncLayerVisibilityControls();
    this.syncAssetMenu();
    this.setStatus(
      `${layerName} layer ${isVisible ? "shown" : "hidden"} in the editor.`,
    );
  }

  showAllLayers() {
    this.layerVisibility = Object.fromEntries(
      LAYERS.map((layerName) => [layerName, true]),
    );
    this.saveLayerVisibility();
    this.gridEditor.setLayerVisibility(this.layerVisibility);
    this.syncLayerVisibilityControls();
    this.setStatus("All editor layers shown.");
  }

  syncLayerVisibilityControls() {
    this.ui.layerVisibilityInputs.forEach((input) => {
      input.checked = this.layerVisibility[input.dataset.layer] !== false;
    });
  }

  setLayerLocked(layerName, isLocked) {
    if (!LAYERS.includes(layerName)) {
      return;
    }

    this.layerLocks = {
      ...this.layerLocks,
      [layerName]: Boolean(isLocked),
    };
    this.saveLayerLocks();

    const level = getCurrentLevel(this.project);
    const editableIds = new Set(
      getPlacedObjects(level, this.getEditableLayerNames()).map(
        (placedObject) =>
          placedObject.editorLocked === true ? null : placedObject.id,
      ),
    );
    editableIds.delete(null);
    const retainedIds = Array.from(this.selectedPlacedObjectIds).filter((id) =>
      editableIds.has(id),
    );
    const previousPrimaryId = this.selectedPlacedObjectId;
    this.selectedPlacedObjectIds = new Set(retainedIds);
    this.selectedPlacedObjectId = editableIds.has(previousPrimaryId)
      ? previousPrimaryId
      : retainedIds[0] || null;

    if (previousPrimaryId && !editableIds.has(previousPrimaryId)) {
      this.closePlacedPropertiesDialog();
    }

    if (
      this.copiedPlacedGroup &&
      this.copiedPlacedGroup.objects.some(
        ({ sourceObject }) =>
          this.isLayerLocked(sourceObject.layer) ||
          sourceObject.editorLocked === true,
      )
    ) {
      this.cancelCopyPlacement();
    }

    this.gridEditor.setLayerLocks(this.layerLocks);
    this.gridEditor.syncPlacedObjectSelection(
      this.selectedPlacedObjectId,
      Array.from(this.selectedPlacedObjectIds),
    );
    this.syncLayerLockControls();
    this.syncAssetMenu();
    this.setStatus(
      `${layerName} layer ${isLocked ? "locked" : "unlocked"} for editing.`,
    );
  }

  unlockAllLayers() {
    const historySnapshot = this.captureHistorySnapshot();
    this.layerLocks = Object.fromEntries(
      LAYERS.map((layerName) => [layerName, false]),
    );
    this.saveLayerLocks();

    let unlockedAssetCount = 0;
    this.project.levels.forEach((level) => {
      Object.values(level.layers || {}).forEach((layerEntries) => {
        if (!Array.isArray(layerEntries)) {
          return;
        }

        layerEntries.forEach((placedObject) => {
          if (placedObject?.editorLocked === true) {
            placedObject.editorLocked = false;
            unlockedAssetCount += 1;
          }
        });
      });
    });

    this.gridEditor.setLayerLocks(this.layerLocks);
    this.syncLayerLockControls();
    this.clearPlacedObjectSelection();
    this.closePlacedPropertiesDialog();
    this.render();
    this.pushHistoryEntry("Unlock all assets", historySnapshot);
    this.autosave(
      `All layers and individually locked assets unlocked${
        unlockedAssetCount > 0 ? ` (${unlockedAssetCount} asset${unlockedAssetCount === 1 ? "" : "s"})` : ""
      }.`,
    );
  }

  syncLayerLockControls() {
    this.ui.layerLockInputs.forEach((input) => {
      input.checked = this.layerLocks[input.dataset.layer] === true;
    });
  }

  blockActionForLockedOverlaps(overlappingObjects, actionLabel) {
    const lockedLayers = Array.from(
      new Set(
        overlappingObjects
          .filter((placedObject) => this.isLayerLocked(placedObject.layer))
          .map((placedObject) => normalizePlacedLayer(placedObject.layer)),
      ),
    );
    const lockedAssetCount = overlappingObjects.filter(
      (placedObject) =>
        placedObject.editorLocked === true &&
        !this.isLayerLocked(placedObject.layer),
    ).length;

    if (lockedLayers.length === 0 && lockedAssetCount === 0) {
      return false;
    }

    const reasons = [];
    if (lockedLayers.length > 0) {
      reasons.push(
        `locked layer${lockedLayers.length === 1 ? "" : "s"} ${lockedLayers.join(", ")}`,
      );
    }
    if (lockedAssetCount > 0) {
      reasons.push(
        `${lockedAssetCount} individually locked asset${lockedAssetCount === 1 ? "" : "s"}`,
      );
    }
    this.setStatus(`${actionLabel} blocked: ${reasons.join(" and ")} cannot be replaced.`);
    return true;
  }

  blockActionForTargetLayerOverlaps(overlappingObjects, actionLabel) {
    if (this.blockActionForLockedOverlaps(overlappingObjects, actionLabel)) {
      return true;
    }

    const hiddenCount = overlappingObjects.filter(
      (placedObject) => !this.isLayerVisible(placedObject.layer),
    ).length;

    if (hiddenCount === 0) {
      return false;
    }

    this.setStatus(
      `${actionLabel} blocked: ${hiddenCount} hidden same-layer asset${
        hiddenCount === 1 ? "" : "s"
      } cannot be replaced while hidden.`,
    );
    return true;
  }

  createOverlapWarningMessage(message, overlappingObjects) {
    const hiddenCount = overlappingObjects.filter(
      (placedObject) => !this.isLayerVisible(placedObject.layer),
    ).length;

    const lockedCount = overlappingObjects.filter(
      (placedObject) => this.isPlacedObjectProtected(placedObject),
    ).length;

    if (hiddenCount === 0 && lockedCount === 0) {
      return message;
    }

    const details = [];
    if (hiddenCount > 0) {
      details.push(
        `${hiddenCount} overlapping hidden-layer asset${hiddenCount === 1 ? " is" : "s are"} included`,
      );
    }
    if (lockedCount > 0) {
      details.push(
        `${lockedCount} locked-layer asset${lockedCount === 1 ? " is" : "s are"} protected from replacement`,
      );
    }
    return `${message} ${details.join(". ")}.`;
  }

  syncCoordinateStatus() {
    const hover = this.hoveredGridRef || "-";
    const selected = this.selectedRanges.length > 1
      ? `${this.selectedRanges.length} areas / ${this.getUniqueSelectedCells().length} cells`
      : this.selectedRange
        ? `${toGridRef(this.selectedRange.x, this.selectedRange.y)} to ${toGridRef(
            this.selectedRange.x + this.selectedRange.width - 1,
            this.selectedRange.y + this.selectedRange.height - 1,
          )}`
        : "-";

    this.ui.coordinateStatus.textContent = `Hover: ${hover} · Selected: ${selected}`;
  }

  syncPlacementButton() {
    this.syncAreaToolMenu();
  }

  syncAssetMenu() {
    const hasEligiblePlacedSelection =
      !this.isPlayModeActive &&
      this.activeTool === "move" &&
      this.getEligibleSelectedPlacedAssets().selectedObjects.length > 0;
    const hasPropertiesSelection =
      !this.isPlayModeActive &&
      this.activeTool === "move" &&
      (
        Boolean(this.selectedPlacedObjectId) ||
        this.selectedPlacedObjectIds.size > 0
      );
    const isEnabled =
      this.activeTool === "move" &&
      hasPropertiesSelection;
    this.ui.assetMenu.classList.toggle("is-disabled", !isEnabled);
    this.ui.assetMenu.querySelector("summary").setAttribute("aria-disabled", String(!isEnabled));
    this.ui.assetMenu.querySelector("button").disabled = !isEnabled;
    this.ui.editPropertiesButton.disabled = !isEnabled;
    this.ui.copySelectedAssetsButton.disabled = !hasEligiblePlacedSelection;
    this.ui.cutSelectedAssetsButton.disabled = !hasEligiblePlacedSelection;
    this.ui.duplicateSelectedAssetsButton.disabled = !hasEligiblePlacedSelection;
    if (!isEnabled) {
      this.ui.assetMenu.removeAttribute("open");
    }
  }

  syncAreaToolMenu() {
    const selectedAreas = this.getSelectedAreaRanges();
    const hasSelectedArea = selectedAreas.length > 0;
    this.ui.fillSelectedAreaButton.disabled = this.isPlayModeActive || !(hasSelectedArea && this.selectedAsset);
    this.ui.clearSelectedAreaButton.disabled = this.isPlayModeActive || !hasSelectedArea;
    this.ui.replaceMatchingAssetsButton.disabled = !(
      !this.isPlayModeActive &&
      hasSelectedArea &&
      this.selectedAsset &&
      this.getReplaceMatchingCandidates(selectedAreas).length > 0
    );
  }

  bindMenuBehavior() {
    const viewMenu = this.root.querySelector('[data-role="view-menu"]');
    const flyoutItems = Array.from(
      viewMenu.querySelectorAll(".menu-flyout-item"),
    );

    const closeViewFlyouts = (exceptItem = null) => {
      flyoutItems.forEach((item) => {
        if (item === exceptItem) {
          return;
        }
        item.classList.remove("is-open", "opens-left");
        item.querySelector("[data-flyout-trigger]")?.setAttribute("aria-expanded", "false");
        const panel = item.querySelector("[data-flyout-panel]");
        if (panel) {
          panel.style.top = "";
        }
      });
    };

    const openViewFlyout = (item) => {
      closeViewFlyouts(item);
      item.classList.add("is-open");
      const trigger = item.querySelector("[data-flyout-trigger]");
      const panel = item.querySelector("[data-flyout-panel]");
      trigger?.setAttribute("aria-expanded", "true");

      window.requestAnimationFrame(() => {
        if (!panel || !item.classList.contains("is-open")) {
          return;
        }
        item.classList.remove("opens-left");
        panel.style.top = "-6px";
        let panelRect = panel.getBoundingClientRect();
        if (panelRect.right > window.innerWidth - 8) {
          item.classList.add("opens-left");
          panelRect = panel.getBoundingClientRect();
        }
        const itemRect = item.getBoundingClientRect();
        let panelTop = -6;
        if (panelRect.bottom > window.innerHeight - 8) {
          panelTop -= panelRect.bottom - window.innerHeight + 8;
        }
        panelTop = Math.max(8 - itemRect.top, panelTop);
        panel.style.top = `${panelTop}px`;
      });
    };

    flyoutItems.forEach((item) => {
      const trigger = item.querySelector("[data-flyout-trigger]");
      item.addEventListener("mouseenter", () => openViewFlyout(item));
      item.addEventListener("focusin", () => openViewFlyout(item));
      item.addEventListener("mouseleave", (event) => {
        if (!item.contains(event.relatedTarget)) {
          closeViewFlyouts();
        }
      });
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openViewFlyout(item);
      });
    });

    this.root.querySelectorAll("[data-menu]").forEach((menu) => {
      menu.querySelector("summary").addEventListener("click", (event) => {
        if (menu.classList.contains("is-disabled")) {
          event.preventDefault();
          menu.removeAttribute("open");
        }
      });
      menu.addEventListener("toggle", () => {
        if (!menu.open) {
          if (menu === viewMenu) {
            closeViewFlyouts();
          }
          return;
        }

        this.root.querySelectorAll("[data-menu]").forEach((otherMenu) => {
          if (otherMenu !== menu) {
            otherMenu.removeAttribute("open");
          }
        });
      });
    });

    this.root.querySelectorAll(".menu-panel button:not([data-flyout-trigger])").forEach((button) => {
      button.addEventListener("click", () => {
        this.closeMenus();
      });
    });

    let suppressOutsideMenuClick = false;
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!viewMenu.open || viewMenu.contains(event.target)) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        suppressOutsideMenuClick = true;
        this.closeMenus();
        window.setTimeout(() => {
          suppressOutsideMenuClick = false;
        }, 0);
      },
      true,
    );

    document.addEventListener(
      "click",
      (event) => {
        if (!suppressOutsideMenuClick) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressOutsideMenuClick = false;
      },
      true,
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && viewMenu.open) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.closeMenus();
        }
      },
      true,
    );

    document.addEventListener("click", (event) => {
      if (!this.root.contains(event.target) || !event.target.closest("[data-menu]")) {
        this.closeMenus();
      }

      if (!event.target.closest("[data-role='level-picker']")) {
        this.closeLevelPicker();
      }
    });
  }

  bindSidebarResize() {
    const handle = this.ui.sidebarResizer;

    handle.addEventListener("pointerdown", (event) => {
      if (
        this.isSidebarCollapsed ||
        event.button !== 0 ||
        window.matchMedia("(max-width: 820px)").matches
      ) {
        return;
      }

      event.preventDefault();
      const startX = event.clientX;
      const startWidth = this.sidebarWidth;
      const minimumWidth = 180;
      const maximumWidth = this.getSidebarMaximumWidth();
      let pendingWidth = this.sidebarWidth;
      let appliedWidth = this.sidebarWidth;
      let sidebarAnimationFrame = null;
      handle.classList.add("is-resizing");
      this.ui.workspace.classList.add("is-sidebar-resizing");
      document.body.classList.add("is-sidebar-resizing");

      const clampResizeWidth = (width) => clamp(Math.round(width), minimumWidth, maximumWidth);

      const applyResize = () => {
        sidebarAnimationFrame = null;
        if (pendingWidth === appliedWidth) {
          return;
        }
        appliedWidth = pendingWidth;
        this.applySidebarWidth(pendingWidth);
      };

      const scheduleResize = (width) => {
        if (width === pendingWidth) {
          return;
        }
        pendingWidth = width;

        if (sidebarAnimationFrame !== null) {
          return;
        }

        sidebarAnimationFrame = window.requestAnimationFrame(applyResize);
      };

      const flushResize = () => {
        if (sidebarAnimationFrame !== null) {
          window.cancelAnimationFrame(sidebarAnimationFrame);
          applyResize();
        }
      };

      const resize = (pointerEvent) => {
        this.sidebarWidth = clampResizeWidth(startWidth + pointerEvent.clientX - startX);
        scheduleResize(this.sidebarWidth);
      };

      const finish = () => {
        document.removeEventListener("pointermove", resize);
        document.removeEventListener("pointerup", finish);
        document.removeEventListener("pointercancel", finish);
        flushResize();
        handle.classList.remove("is-resizing");
        this.ui.workspace.classList.remove("is-sidebar-resizing");
        document.body.classList.remove("is-sidebar-resizing");
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(this.sidebarWidth));
      };

      document.addEventListener("pointermove", resize);
      document.addEventListener("pointerup", finish);
      document.addEventListener("pointercancel", finish);
    });

    window.addEventListener("resize", () => {
      this.sidebarWidth = this.clampSidebarWidth(this.sidebarWidth);
      this.applySidebarWidth(this.sidebarWidth);
    });
  }

  toggleSidebarCollapsed() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.applySidebarCollapsedState();
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(this.isSidebarCollapsed));
    if (!this.isSidebarCollapsed) {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(this.sidebarWidth));
    }
  }

  loadSidebarCollapsed() {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  }

  loadSidebarWidth() {
    const storedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return this.clampSidebarWidth(Number.isFinite(storedWidth) && storedWidth > 0 ? storedWidth : 260);
  }

  applySidebarWidth(width) {
    this.ui.workspace.style.setProperty("--sidebar-width", `${this.clampSidebarWidth(width)}px`);
  }

  applySidebarCollapsedState() {
    this.ui.workspace.classList.toggle("is-sidebar-collapsed", this.isSidebarCollapsed);
    this.ui.sidebarToggle.textContent = this.isSidebarCollapsed ? "»" : "«";
    this.ui.sidebarToggle.title = this.isSidebarCollapsed
      ? "Restore asset panel"
      : "Collapse asset panel";
    this.ui.sidebarToggle.setAttribute(
      "aria-label",
      this.isSidebarCollapsed ? "Restore asset panel" : "Collapse asset panel",
    );
  }

  clampSidebarWidth(width) {
    const maximum = this.getSidebarMaximumWidth();
    return clamp(Math.round(width), 180, maximum);
  }

  getSidebarMaximumWidth() {
    return Math.max(180, Math.min(420, Math.floor(window.innerWidth * 0.4)));
  }

  closeMenus() {
    this.root.querySelectorAll("[data-menu]").forEach((menu) => {
      menu.removeAttribute("open");
    });
  }

  closePlacedPropertiesDialog() {
    document.querySelector(".placed-properties-dialog[open]")?.close();
  }

  closeLevelPicker() {
    this.ui.levelPicker.classList.remove("is-open");
  }

  setStartupStatus(message) {
    this.ui.startupStatus.textContent = message;
  }

  setCtrlPressed(isPressed) {
    this.isCtrlPressed = Boolean(isPressed);
    this.gridEditor?.setCtrlPressed(this.isCtrlPressed);
    this.syncModeStatus();
  }

  syncModeStatus() {
    const messages = [];
    if (this.isDragPaintMode) {
      messages.push(`Paint mode ${this.getBrushSizeLabel()}`);
    }
    if (this.isCtrlPressed) {
      messages.push("Multi-select mode");
    }
    this.ui.modeStatus.hidden = messages.length === 0;
    this.ui.modeStatus.textContent = messages.join(" / ");
  }

  setStatus(message) {
    this.ui.statusMessage.textContent = message;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector("#app");

  if (!root) {
    throw new Error("Editor root element was not found.");
  }

  const loaded = await loadProject();
  new DevEditor(root, loaded);
});

function rangeContains(range, x, y) {
  return x >= range.x && x < range.x + range.width && y >= range.y && y < range.y + range.height;
}

function isEditableTarget(target) {
  return target instanceof Element && Boolean(
    target.closest("input, select, textarea, dialog, [contenteditable='true']"),
  );
}

function rangesMatch(first, second) {
  return Boolean(
    first &&
    second &&
    first.x === second.x &&
    first.y === second.y &&
    first.width === second.width &&
    first.height === second.height,
  );
}

function formatRange(range) {
  if (!range) {
    return "-";
  }

  return `${toGridRef(range.x, range.y)} to ${toGridRef(
    range.x + range.width - 1,
    range.y + range.height - 1,
  )}`;
}

function createDeletedPlacedAssetsMessage(count) {
  return `Deleted ${count} placed asset${count === 1 ? "" : "s"}.`;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizePaintBrushSize(value) {
  const size = Number(value);
  return [1, 2, 3, 5].includes(size) ? size : 1;
}

function createCellKey(cell) {
  return `${cell.x}:${cell.y}`;
}

function getToolLabel(tool) {
  if (tool === "move") {
    return "Select/Move";
  }
  if (tool === "paint") {
    return "Paint";
  }
  return "Delete";
}

const LAYER_LABELS = {
  terrain: "Terrain",
  decorations: "Decorations",
  objects: "Objects",
  collisions: "Collisions",
  spawns: "Spawns",
  items: "Items",
  npcs: "NPCs",
  enemies: "Enemies",
  triggers: "Triggers",
  overlay: "Overlay",
};

function normalizePlacedLayer(layer) {
  if (layer === "triggers" || layer === "Trigger") {
    return "triggers";
  }
  return LAYERS.includes(layer) ? layer : "objects";
}

function createLayerOptions(selectedLayer) {
  return LAYERS.map(
    (layerName) =>
      `<option value="${layerName}" ${layerName === selectedLayer ? "selected" : ""}>${LAYER_LABELS[layerName] || toTitleCase(layerName)}</option>`,
  ).join("");
}

function createMixedLayerOptions(selectedLayer) {
  const mixedOption =
    selectedLayer === MIXED_VALUE
      ? `<option value="${MIXED_VALUE}" selected>Mixed</option>`
      : "";
  return `${mixedOption}${createLayerOptions(selectedLayer)}`;
}

function createMixedBooleanOptions(selectedValue) {
  const mixedOption =
    selectedValue === MIXED_VALUE
      ? `<option value="${MIXED_VALUE}" selected>Mixed</option>`
      : "";
  return `
    ${mixedOption}
    <option value="false" ${selectedValue === false ? "selected" : ""}>No</option>
    <option value="true" ${selectedValue === true ? "selected" : ""}>Yes</option>
  `;
}

function getCommonValue(items, getValue) {
  if (!items.length) {
    return MIXED_VALUE;
  }

  const [firstItem, ...remainingItems] = items;
  const firstValue = getValue(firstItem);
  return remainingItems.every((item) => getValue(item) === firstValue)
    ? firstValue
    : MIXED_VALUE;
}

function normalizeLayerOptions(layerOptions) {
  return layerOptions && typeof layerOptions === "object" && !Array.isArray(layerOptions)
    ? layerOptions
    : {};
}

function createLayerOptionsFields(layer, options) {
  const fieldValue = (key) => escapeAttribute(options[key] ?? "");
  const boolValue = (key, fallback = false) => Boolean(options[key] ?? fallback);
  const yesNoOptions = (key, fallback = false) => `
    <option value="false" ${!boolValue(key, fallback) ? "selected" : ""}>No</option>
    <option value="true" ${boolValue(key, fallback) ? "selected" : ""}>Yes</option>
  `;

  switch (layer) {
    case "terrain":
      return `
        <legend>Terrain Options</legend>
        <label>Terrain Tag <input name="terrainTag" value="${fieldValue("terrainTag")}" /></label>
        <p class="properties-hint">Use terrain tags to describe ground type for future movement, visuals, or rules.</p>
      `;
    case "decorations":
      return `
        <legend>Decoration Options</legend>
        <label>Decorative Only
          <select name="decorativeOnly">${yesNoOptions("decorativeOnly", true)}</select>
        </label>
        <p class="properties-hint">Decoration assets are visual dressing and should not affect movement unless future rules say otherwise.</p>
      `;
    case "objects":
      return `
        <legend>Object Options</legend>
        <label>Object Type / Note <input name="objectType" value="${fieldValue("objectType")}" /></label>
        <p class="properties-hint">Objects are general placed props. Use Blocks Movement above for current editor blocking intent.</p>
      `;
    case "collisions":
      return `
        <legend>Collision Options</legend>
        <label>Collision Type / Note <input name="collisionType" value="${fieldValue("collisionType")}" /></label>
        <p class="properties-hint">Collision entries mark future blocking or collision zones. Runtime collision is not implemented yet.</p>
      `;
    case "spawns":
      return `
        <legend>Spawn Options</legend>
        <label>Spawn Name <input name="spawnName" value="${fieldValue("spawnName")}" /></label>
        <label>Spawn Direction
          <select name="spawnDirection">
            ${createSelectOptions(["up", "down", "left", "right"], options.spawnDirection || "down")}
          </select>
        </label>
        <p class="properties-hint">Spawn fields mark future player or entity spawn points. Spawn behavior is not implemented yet.</p>
      `;
    case "items":
      return `
        <legend>Item Options</legend>
        <label>Item ID <input name="itemId" value="${fieldValue("itemId")}" /></label>
        <label>Quantity <input name="quantity" type="number" min="0" value="${fieldValue("quantity")}" /></label>
        <p class="properties-hint">Item fields identify future pickup data. Inventory and pickup runtime are not implemented yet.</p>
      `;
    case "npcs":
      return `
        <legend>NPC Options</legend>
        <label>NPC Name <input name="npcName" value="${fieldValue("npcName")}" /></label>
        <label>Dialogue ID <input name="dialogueId" value="${fieldValue("dialogueId")}" /></label>
        <p class="properties-hint">NPC fields prepare future dialogue connections. NPC runtime is not implemented yet.</p>
      `;
    case "enemies":
      return `
        <legend>Enemy Options</legend>
        <label>Enemy Type <input name="enemyType" value="${fieldValue("enemyType")}" /></label>
        <label>Spawn Chance <input name="spawnChance" type="number" min="0" max="100" value="${fieldValue("spawnChance")}" /></label>
        <p class="properties-hint">Enemy fields prepare future battle or encounter data. Enemy runtime is not implemented yet.</p>
      `;
    case "triggers":
      return `
        <legend>Trigger Options</legend>
        <label>Trigger Type
          <select name="triggerType">
            ${createSelectOptions(["none", "levelExit", "dialogue", "battle", "cutscene", "custom"], options.triggerType || "none")}
          </select>
        </label>
        <label>Target Level <input name="targetLevel" value="${fieldValue("targetLevel")}" /></label>
        <label>Target Spawn <input name="targetSpawn" value="${fieldValue("targetSpawn")}" /></label>
        <label>Dialogue ID <input name="dialogueId" value="${fieldValue("dialogueId")}" /></label>
        <label>Battle ID <input name="battleId" value="${fieldValue("battleId")}" /></label>
        <label>Cutscene ID <input name="cutsceneId" value="${fieldValue("cutsceneId")}" /></label>
        <p class="properties-hint">Trigger fields are metadata only. Level exits, dialogue, battles, and cutscenes are not implemented yet.</p>
      `;
    case "overlay":
      return `
        <legend>Overlay Options</legend>
        <label>Render Above Player
          <select name="renderAbovePlayer">${yesNoOptions("renderAbovePlayer", true)}</select>
        </label>
        <label>Overlay Type / Note <input name="overlayType" value="${fieldValue("overlayType")}" /></label>
        <p class="properties-hint">Overlay fields mark future above-player visuals. Runtime layering is not implemented yet.</p>
      `;
    default:
      return `
        <legend>Layer Options</legend>
        <p class="properties-hint">Choose a layer to edit layer-specific metadata.</p>
      `;
  }
}

function createSelectOptions(values, selectedValue) {
  return values.map((value) => {
    const selected = value === selectedValue ? "selected" : "";
    return `<option value="${escapeAttribute(value)}" ${selected}>${escapeHtml(toTitleCase(value))}</option>`;
  }).join("");
}

function readLayerSpecificOptions(data, layer) {
  switch (layer) {
    case "terrain":
      return { terrainTag: readFormText(data, "terrainTag") };
    case "decorations":
      return { decorativeOnly: data.get("decorativeOnly") === "true" };
    case "objects":
      return { objectType: readFormText(data, "objectType") };
    case "collisions":
      return { collisionType: readFormText(data, "collisionType") };
    case "spawns":
      return {
        spawnName: readFormText(data, "spawnName"),
        spawnDirection: readFormText(data, "spawnDirection"),
      };
    case "items":
      return {
        itemId: readFormText(data, "itemId"),
        quantity: readFormText(data, "quantity"),
      };
    case "npcs":
      return {
        npcName: readFormText(data, "npcName"),
        dialogueId: readFormText(data, "dialogueId"),
      };
    case "enemies":
      return {
        enemyType: readFormText(data, "enemyType"),
        spawnChance: readFormText(data, "spawnChance"),
      };
    case "triggers":
      return {
        triggerType: readFormText(data, "triggerType") || "none",
        targetLevel: readFormText(data, "targetLevel"),
        targetSpawn: readFormText(data, "targetSpawn"),
        dialogueId: readFormText(data, "dialogueId"),
        battleId: readFormText(data, "battleId"),
        cutsceneId: readFormText(data, "cutsceneId"),
      };
    case "overlay":
      return {
        renderAbovePlayer: data.get("renderAbovePlayer") === "true",
        overlayType: readFormText(data, "overlayType"),
      };
    default:
      return {};
  }
}

function readFormText(data, key) {
  return String(data.get(key) || "").trim();
}

function normalizeOpacity(opacity) {
  const number = Number(opacity);
  return Number.isFinite(number) ? clamp(Math.round(number), 0, 100) : 100;
}

function parseGridRef(value) {
  const match = String(value || "").trim().match(/^(\d+)\.([a-z]+)$/i);
  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = parseGridRow(match[2]);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
}

function parseGridRow(value) {
  const text = String(value || "").trim().toUpperCase();
  if (/^\d+$/.test(text)) {
    const row = Number(text);
    return Number.isInteger(row) && row > 0 ? row : NaN;
  }
  if (!/^[A-Z]+$/.test(text)) {
    return NaN;
  }

  let row = 0;
  for (const letter of text) {
    row = row * 26 + letter.charCodeAt(0) - 64;
  }
  return row;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function pickImagesWithInput() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      input.remove();
      resolve(files);
    });
    input.click();
  });
}

function toTitleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function cloneEditorData(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}
