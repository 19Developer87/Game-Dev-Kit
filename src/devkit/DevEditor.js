import { AssetPalette } from "./AssetPalette.js";
import {
  COPIED_LEVEL_STORAGE_KEY,
  LAYER_LOCKS_STORAGE_KEY,
  LAYER_VISIBILITY_STORAGE_KEY,
  LAYERS,
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
  createAssetRegistryData,
  createCopiedLevelData,
  createLevelFileData,
  createProjectIndex,
  createNewLevel,
  deleteCurrentLevel,
  getCurrentLevel,
  hasLevelContent,
  pasteLevelContent,
  placeAsset,
  findObjectsInRange,
  findAssetCategoryByName,
  deleteAssetCategory,
  deleteImportedAsset,
  duplicatePlacedAssetGroup,
  getPlacedObjects,
  isAssetUsedOnAnyLevel,
  reorderLevel,
  removeEmptyAssetCategories,
  renameCurrentLevel,
  removeObjectsInRange,
  removeObjectsAtCell,
  removePlacedObjectById,
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
    this.selectionState = "idle";
    this.selectionConfirmationTimer = null;
    this.hoveredGridRef = null;
    this.dropPreviewRange = null;
    this.selectedPlacedObjectId = null;
    this.selectedPlacedObjectIds = new Set();
    this.copiedPlacedGroup = null;
    this.copyPreviewOrigin = null;
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
      onSelectionChange: (range, state) => this.handleSelectionChange(range, state),
      onAssetDrop: (drop) => this.handleAssetDrop(drop),
      onPlacedObjectSelect: (placedObjectId) => this.selectPlacedObject(placedObjectId),
      onPlacedObjectProperties: (placedObjectId) => this.openPlacedAssetProperties(placedObjectId),
      onPlacedObjectTransform: (transform) => this.transformPlacedObject(transform),
      onPlacedObjectGroupMoveStart: () => this.clearGridAreaSelection(),
      onCopyPreviewMove: (cell) => this.moveCopyPreview(cell),
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
        this.activateTool("move");
        if (this.selectionState === "selectionReady") {
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
    });

    this.bindEvents();
    this.render();
    this.setStartupStatus(this.startupMessage);
    this.setStatus(this.startupMessage);
  }

  bindEvents() {
    this.root.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        this.activateTool(button.dataset.tool);
      });
    });

    this.root.querySelector('[data-action="place-selected-asset"]').addEventListener("click", async () => {
      await this.placeSelectedAssetInRange();
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

      if (
        event.ctrlKey &&
        !event.metaKey &&
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
        w: "move",
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
        if (this.copiedPlacedGroup) {
          event.preventDefault();
          this.cancelCopyPlacement();
          this.render();
          this.setStatus("Copy placement cancelled.");
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

    this.root.querySelector('[data-action="paste-level"]').addEventListener("click", async () => {
      await this.pasteCopiedLevel();
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
        message: "Clear every placed asset from the current level? This cannot be undone.",
        confirmLabel: "Clear Level",
        danger: true,
      });

      if (!confirmed) {
        return;
      }
      clearCurrentLevel(this.project);
      this.clearSelection();
      this.clearPlacedObjectSelection();
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

  async handleCellClick({ x, y }) {
    const level = getCurrentLevel(this.project);

    if (this.activeTool === "move") {
      if (this.copiedPlacedGroup) {
        await this.pasteCopiedPlacedAssetAt(x, y);
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
  }

  handleSelectionChange(range, state) {
    const hadPlacedObjectSelection = this.activeTool === "move" && this.selectedPlacedObjectIds.size > 0;
    this.selectedRange = range;
    this.selectionState = state;
    this.dropPreviewRange = null;
    if (hadPlacedObjectSelection) {
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
      }
      return;
    }

    this.syncPlacementButton();
    this.gridEditor.updateSelection(this.selectedRange);
    this.gridEditor.updateDropPreview(null);

    if (this.activeTool === "delete") {
      if (state === "selectionReady") {
        this.deleteAssetsInRange(range, { clearSelection: true });
      }
      return;
    }

    if (state === "selectionReady") {
      const selectedObjects = findObjectsInRange(
        getCurrentLevel(this.project),
        range.x,
        range.y,
        range.width,
        range.height,
        this.getEditableLayerNames(),
      ).filter((placedObject) => placedObject.editorLocked !== true);
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
    if (this.selectedRange && !rangeContains(this.selectedRange, x, y)) {
      this.clearSelection();
    }
    const range = this.getPlacementRangeForCell(x, y);
    this.dropPreviewRange = null;
    await this.placeAssetInRange(asset, range, "drop");
  }

  activateTool(tool) {
    if (!["move", "delete"].includes(tool)) {
      return;
    }

    this.activeTool = tool;
    if (tool === "delete") {
      this.clearSelection();
    }
    if (tool !== "move") {
      this.clearPlacedObjectSelection();
    }
    this.gridEditor.setInteractionMode(tool);
    this.syncToolButtons();
    this.render();
    this.setStatus(`${getToolLabel(tool)} tool active.`);
  }

  selectPlacedObject(placedObjectId) {
    if (this.activeTool !== "move") {
      return;
    }

    const placedObject = getPlacedObjects(
      getCurrentLevel(this.project),
      this.getEditableLayerNames(),
    ).find(
      (candidate) =>
        candidate.id === placedObjectId &&
        candidate.editorLocked !== true,
    );
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
    this.setStatus("Placed asset selected. Drag to move or use a handle to resize.");
  }

  openPlacedAssetProperties(placedObjectId = this.selectedPlacedObjectId) {
    const explicitPlacedObject = arguments.length > 0;
    if (this.selectedPlacedObjectIds.size > 1 && !explicitPlacedObject) {
      this.setStatus("Select one asset to edit properties.");
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
    if (placedObject.editorLocked === true) {
      this.clearPlacedObjectSelection();
    } else {
      this.setPlacedObjectSelection([placedObjectId], placedObjectId);
    }
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
        ? findObjectsInRange(
            level,
            result.values.x,
            result.values.y,
            result.values.width,
            result.values.height,
          ).filter((candidate) => candidate.id !== placedObject.id)
        : [];

      const lockedOverlap = overlaps.find((candidate) =>
        this.isPlacedObjectProtected(candidate),
      );
      if (lockedOverlap) {
        error.hidden = false;
        error.textContent = `Changes were not applied because the new bounds overlap ${
          this.isLayerLocked(lockedOverlap.layer)
            ? `locked layer "${normalizePlacedLayer(lockedOverlap.layer)}"`
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

      const updatedObject = updatePlacedAssetProperties(level, placedObject.id, result.values);
      if (!updatedObject) {
        error.hidden = false;
        error.textContent = "The selected placed asset could not be found.";
        return;
      }

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

    this.autosave(createDeletedPlacedAssetsMessage(removedObjects.length));
    return true;
  }

  deleteAssetsInSelectedRange() {
    if (!this.selectedRange || this.selectionState !== "selectionReady") {
      return false;
    }

    return this.deleteAssetsInRange(this.selectedRange);
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

    const existing = findObjectsInRange(level, x, y, width, height).filter(
      (placedObject) => placedObject.id !== placedObjectId,
    );

    if (this.blockActionForLockedOverlaps(existing, "Move/resize")) {
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

    const updatedObject = updatePlacedAssetBounds(level, placedObjectId, x, y, width, height);
    if (!updatedObject) {
      this.setStatus("Unable to update the selected asset.");
      this.render();
      return false;
    }

    this.setPlacedObjectSelection([placedObjectId], placedObjectId);
    this.render();
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
      findObjectsInRange(level, bounds.x, bounds.y, bounds.width, bounds.height).forEach(
        (candidate) => {
          if (!selectedIdSet.has(candidate.id) && !overlappingObjects.some((item) => item.id === candidate.id)) {
            overlappingObjects.push(candidate);
          }
        },
      );
    });

    if (overlappingObjects.length > 0) {
      if (this.blockActionForLockedOverlaps(overlappingObjects, "Group move")) {
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

    const updatedObjects = updatePlacedAssetGroupBounds(level, updates);
    if (!updatedObjects) {
      this.setStatus("Unable to update the selected assets.");
      this.render();
      return false;
    }

    this.setPlacedObjectSelection(selectedIds, placedObjectId || selectedIds[0]);
    this.render();
    this.autosave(`Moved ${updatedObjects.length} selected assets.`);
    return true;
  }

  startCopyPlacement() {
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

    if (selectedObjects.length === 0) {
      this.setStatus("No unlocked visible assets selected to copy.");
      return;
    }

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
    this.copiedPlacedGroup = {
      width: maximumX - minimumX + 1,
      height: maximumY - minimumY + 1,
      primarySourceId: this.selectedPlacedObjectId || selectedObjects[0].id,
      objects: selectedObjects.map((placedObject) => ({
        sourceObject: cloneEditorData(placedObject),
        offsetX: (Number(placedObject.x) || 1) - minimumX,
        offsetY: (Number(placedObject.y) || 1) - minimumY,
      })),
    };
    this.copyPreviewOrigin = this.getCopiedPlacementOrigin(minimumX, minimumY);
    this.gridEditor.setCopyModeActive(true);
    this.render();
    if (selectedIds.length === 1 && selectedObjects.length === 1) {
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
    const targetCopies = this.copiedPlacedGroup.objects.map((copy) => ({
      sourceObject: copy.sourceObject,
      x: origin.x + copy.offsetX,
      y: origin.y + copy.offsetY,
      width: Math.max(1, Number(copy.sourceObject.width) || 1),
      height: Math.max(1, Number(copy.sourceObject.height) || 1),
    }));
    const existingById = new Map();
    targetCopies.forEach((copy) => {
      findObjectsInRange(level, copy.x, copy.y, copy.width, copy.height).forEach(
        (placedObject) => existingById.set(placedObject.id, placedObject),
      );
    });
    const existing = Array.from(existingById.values());

    if (this.blockActionForLockedOverlaps(existing, "Copied group placement")) {
      return false;
    }

    if (existing.length > 0) {
      const confirmed = await this.showConfirmModal({
        title: "Overlap Existing Assets?",
        message: this.createOverlapWarningMessage(
          `Placing this copied ${targetCopies.length === 1 ? "asset" : "group"} will overlap existing assets. Continue?`,
          existing,
        ),
        confirmLabel: targetCopies.length === 1 ? "Place Copy" : "Place Group",
      });

      if (!confirmed) {
        this.setStatus("Copy placement cancelled. Click another grid cell or press Escape.");
        return false;
      }
    }

    const primarySourceId = this.copiedPlacedGroup.primarySourceId;
    const placedObjects = duplicatePlacedAssetGroup(
      level,
      targetCopies,
      existing.map((placedObject) => placedObject.id),
    );
    if (!placedObjects) {
      this.setStatus("Unable to paste the copied assets.");
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
    this.autosave(
      `Pasted ${placedObjects.length} copied asset${placedObjects.length === 1 ? "" : "s"} on ${level.name}.`,
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

  createCopyPreview() {
    if (!this.copiedPlacedGroup || !this.copyPreviewOrigin) {
      return null;
    }

    return {
      key: this.copiedPlacedGroup.objects
        .map((copy) => `${copy.sourceObject.id}:${copy.sourceObject.assetId}`)
        .join("|"),
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

    await this.placeAssetInRange(asset, range, "button");
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
    const existing = findObjectsInRange(level, range.x, range.y, range.width, range.height);

    if (this.blockActionForLockedOverlaps(existing, "Asset placement")) {
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

  clearSelection() {
    if (this.selectionConfirmationTimer) {
      window.clearTimeout(this.selectionConfirmationTimer);
      this.selectionConfirmationTimer = null;
    }
    this.selectedRange = null;
    this.selectionState = "idle";
    this.dropPreviewRange = null;
    this.gridEditor.cancelGesture();
    this.gridEditor.updateSelection(null);
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
    this.selectionState = "idle";
    this.dropPreviewRange = null;
    this.gridEditor.updateSelection(null);
    this.gridEditor.updateDropPreview(null);
    this.syncCoordinateStatus();
    this.syncPlacementButton();
  }

  setSelectionReadyStatus() {
    const selected = `${toGridRef(this.selectedRange.x, this.selectedRange.y)} to ${toGridRef(
      this.selectedRange.x + this.selectedRange.width - 1,
      this.selectedRange.y + this.selectedRange.height - 1,
    )}`;
    this.setStatus(`Selected: ${selected}. Click Place Selected Asset or drag an asset here.`);
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
    const assetCount = this.project.assetRegistry.assets.filter(
      (asset) => asset.categoryId === category.id,
    ).length;

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

      deleteAssetCategory(this.project, category.id);
      this.render();
      this.autosave(`Deleted category ${category.name}.`);
      return;
    }

    this.setStatus("This category contains assets. Delete or move the assets first.");
    await this.showAlertModal("This category contains assets. Delete or move the assets first.", {
      title: "Category Not Empty",
    });
  }

  async deleteAsset(asset) {
    if (isAssetUsedOnAnyLevel(this.project, asset.id)) {
      this.setStatus(
        "This asset is currently used on a level. Remove placed copies first before deleting the asset.",
      );
      await this.showAlertModal(
        "This asset is currently used on a level. Remove placed copies first before deleting the asset.",
        { title: "Asset Is In Use" },
      );
      return;
    }

    const confirmed = await this.showConfirmModal({
      title: `Delete "${asset.name}"?`,
      message: "Delete this imported palette asset? Placed grid copies are not deleted by this action.",
      confirmLabel: "Delete Asset",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    deleteImportedAsset(this.project, asset.id);
    if (this.selectedAsset?.id === asset.id) {
      this.selectedAsset = this.project.assets[0] || null;
    }
    this.render();
    this.autosave(`Deleted asset ${asset.name}.`);
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
          `Asset added to ${importedAsset.category}. Click Place Selected Asset or drag the asset onto the grid to place it.`,
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
    this.gridEditor.setInteractionMode(this.activeTool);
    this.gridEditor.render(
      level,
      this.project.assets,
      this.selectedRange,
      this.dropPreviewRange,
      this.selectedPlacedObjectId,
      Array.from(this.selectedPlacedObjectIds),
      this.createCopyPreview(),
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
    this.syncAssetMenu();
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
    });
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
    const selected = this.selectedRange
      ? `${toGridRef(this.selectedRange.x, this.selectedRange.y)} to ${toGridRef(
          this.selectedRange.x + this.selectedRange.width - 1,
          this.selectedRange.y + this.selectedRange.height - 1,
        )}`
      : "-";

    this.ui.coordinateStatus.textContent = `Hover: ${hover} · Selected: ${selected}`;
  }

  syncPlacementButton() {
    this.ui.placeSelectedAssetButton.disabled = !(
      this.selectedAsset &&
      this.selectedRange &&
      this.selectionState === "selectionReady" &&
      this.activeTool !== "delete"
    );
  }

  syncAssetMenu() {
    const isEnabled =
      this.activeTool === "move" &&
      Boolean(this.selectedPlacedObjectId) &&
      this.selectedPlacedObjectIds.size <= 1;
    this.ui.assetMenu.classList.toggle("is-disabled", !isEnabled);
    this.ui.assetMenu.querySelector("summary").setAttribute("aria-disabled", String(!isEnabled));
    this.ui.assetMenu.querySelector("button").disabled = !isEnabled;
    this.ui.editPropertiesButton.disabled = !isEnabled;
    if (!isEnabled) {
      this.ui.assetMenu.removeAttribute("open");
    }
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

function getToolLabel(tool) {
  return tool === "move" ? "Select/Move" : "Delete";
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
