import { AssetPalette } from "./AssetPalette.js";
import { COPIED_LEVEL_STORAGE_KEY } from "./EditorTypes.js";
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
  isAssetUsedOnAnyLevel,
  reorderLevel,
  removeEmptyAssetCategories,
  renameCurrentLevel,
  removeObjectsAtCell,
  resizeCurrentLevel,
  switchLevel,
  toGridRef,
} from "./LevelManager.js";
import { createProjectBackup, loadProject, saveProject } from "./SaveManager.js";

class DevEditor {
  constructor(root, loaded) {
    this.root = root;
    this.project = loaded.project;
    this.startupMessage = loaded.message;
    this.selectedAsset = this.project.assets[0] || null;
    this.activeTool = "paint";
    this.projectFolderHandle = null;
    this.saveQueue = Promise.resolve();
    this.deletedLevelFilenames = [];
    this.copiedLevel = this.loadCopiedLevel();
    this.selectedRange = null;
    this.selectionState = "idle";
    this.selectionConfirmationTimer = null;
    this.hoveredGridRef = null;
    this.dropPreviewRange = null;
    this.ui = createEditorLayout(root);

    this.gridEditor = new GridEditor({
      root: this.ui.gridStage,
      onCellClick: (cell) => this.handleCellClick(cell),
      onHoverCell: (cell) => this.handleHoverCell(cell),
      onSelectionChange: (range, state) => this.handleSelectionChange(range, state),
      onAssetDrop: (drop) => this.handleAssetDrop(drop),
      onAssetRenderError: (placedObject, asset) => {
        this.setStatus(
          `Unable to render asset "${asset?.name || placedObject.assetId}" at ${placedObject.rangeRef}.`,
        );
      },
    });

    this.assetPalette = new AssetPalette({
      root: this.ui.assetPalette,
      assetRegistry: this.project.assetRegistry,
      selectedAssetId: this.selectedAsset?.id || null,
      onSelect: (asset) => {
        this.selectedAsset = asset;
        this.activeTool = "paint";
        this.syncToolButtons();
        this.render();
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
        this.activeTool = button.dataset.tool;
        if (this.activeTool === "delete") {
          this.clearSelection();
        }
        this.gridEditor.setInteractionMode(this.activeTool);
        this.syncToolButtons();
        this.setStatus(`${this.activeTool === "paint" ? "Paint" : "Delete"} tool active.`);
      });
    });

    this.root.querySelector('[data-action="place-selected-asset"]').addEventListener("click", () => {
      this.placeSelectedAssetInRange();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.target.closest("input, select, textarea, dialog")) {
        this.clearSelection();
        this.setStatus("Selection cleared.");
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

    this.root.querySelector('[data-action="paste-level"]').addEventListener("click", () => {
      this.pasteCopiedLevel();
      this.closeMenus();
    });

    this.ui.levelPickerButton.addEventListener("click", () => {
      this.ui.levelPicker.classList.toggle("is-open");
    });

    this.root.querySelector('[data-action="create-level"]').addEventListener("click", () => {
      const name = window.prompt("New level name", "New Level");

      if (!name?.trim()) {
        this.setStatus("Create level cancelled.");
        return;
      }

      const level = createNewLevel(this.project, name.trim());
      this.clearSelection();
      this.autosave(`Created ${level.name}.`);
      this.render();
    });

    this.root.querySelector('[data-action="rename-level"]').addEventListener("click", () => {
      const level = getCurrentLevel(this.project);
      const name = window.prompt("Rename level", level.name);

      if (!name?.trim()) {
        this.setStatus("Rename cancelled.");
        return;
      }

      renameCurrentLevel(this.project, name.trim());
      this.autosave(`Renamed level to ${name.trim()}.`);
      this.render();
    });

    this.root.querySelector('[data-action="delete-level"]').addEventListener("click", () => {
      const level = getCurrentLevel(this.project);

      if (this.project.levels.length <= 1) {
        this.setStatus("At least one level is required.");
        return;
      }

      if (!window.confirm(`Delete "${level.name}"? This cannot be undone from the editor.`)) {
        this.setStatus("Delete level cancelled.");
        return;
      }

      createProjectBackup(this.project, `Before deleting ${level.name}`);
      const deletedLevel = deleteCurrentLevel(this.project);
      if (deletedLevel?.filename) {
        this.deletedLevelFilenames.push(deletedLevel.filename);
      }
      this.clearSelection();
      this.autosave(`Deleted ${level.name}. A backup was saved in this browser.`);
      this.render();
    });

    this.root.querySelector('[data-action="clear"]').addEventListener("click", () => {
      if (!window.confirm("Clear every placed asset from the current level?")) {
        return;
      }
      clearCurrentLevel(this.project);
      this.clearSelection();
      this.autosave("Cleared the current level and saved the empty grid.");
      this.render();
    });

    this.bindMenuBehavior();

    this.ui.gridSize.addEventListener("change", () => {
      const value = this.ui.gridSize.value;
      this.ui.customSize.classList.toggle("is-visible", value === "custom");

      if (value !== "custom") {
        const size = Number(value);
        this.resizeGrid(size, size);
      }
    });

    this.root
      .querySelector('[data-action="apply-custom-size"]')
      .addEventListener("click", () => {
        const width = Number(this.ui.customWidth.value);
        const height = Number(this.ui.customHeight.value);

        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
          this.setStatus("Enter a custom width and height of at least 1.");
          return;
        }

        this.resizeGrid(Math.min(width, 100), Math.min(height, 100));
      });
  }

  handleCellClick({ x, y }) {
    const level = getCurrentLevel(this.project);

    if (this.activeTool === "delete") {
      removeObjectsAtCell(level, x, y);
      this.autosave(`Deleted assets at ${toGridRef(x, y)}.`);
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

      this.placeAssetInRange(this.selectedAsset, this.selectedRange, "selection");
      return;
    }

    if (!this.selectedAsset) {
      this.setStatus("Import or select an asset before placing.");
      return;
    }

    this.placeAssetInRange(this.selectedAsset, { x, y, width: 1, height: 1 }, "cell");
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
    this.selectedRange = range;
    this.selectionState = state;
    this.dropPreviewRange = null;
    this.syncCoordinateStatus();
    this.syncPlacementButton();
    this.gridEditor.updateSelection(this.selectedRange);
    this.gridEditor.updateDropPreview(null);

    if (this.selectionConfirmationTimer) {
      window.clearTimeout(this.selectionConfirmationTimer);
      this.selectionConfirmationTimer = null;
    }

    if (state === "selectionReady") {
      this.setSelectionReadyStatus();
    } else if (state === "draggingSelection") {
      const pendingRange = { ...range };
      this.selectionConfirmationTimer = window.setTimeout(() => {
        if (
          this.selectionState === "draggingSelection" &&
          rangesMatch(this.selectedRange, pendingRange)
        ) {
          this.selectionState = "selectionReady";
          this.setSelectionReadyStatus();
        }
      }, 0);
    }
  }

  handleAssetDrop({ assetId, x, y }) {
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
    this.placeAssetInRange(asset, range, "drop");
  }

  placeSelectedAssetInRange(asset = this.selectedAsset, range = this.selectedRange) {
    if (!asset) {
      this.setStatus("No asset selected.");
      return;
    }

    if (!range || this.selectionState !== "selectionReady") {
      this.setStatus("No grid area selected.");
      return;
    }

    this.placeAssetInRange(asset, range, "button");
  }

  placeAssetInRange(asset, range, source) {
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

    const level = getCurrentLevel(this.project);
    const existing = findObjectsInRange(level, range.x, range.y, range.width, range.height);

    if (
      existing.length > 0 &&
      !window.confirm("Placing this asset will replace existing assets in the selected area. Continue?")
    ) {
      this.setStatus("Placement cancelled.");
      this.render();
      return false;
    }

    const placedObject = placeAsset(level, asset, range.x, range.y, range.width, range.height);
    this.selectionState = this.selectedRange ? "selectionReady" : "idle";
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

  setSelectionReadyStatus() {
    const selected = `${toGridRef(this.selectedRange.x, this.selectedRange.y)} to ${toGridRef(
      this.selectedRange.x + this.selectedRange.width - 1,
      this.selectedRange.y + this.selectedRange.height - 1,
    )}`;
    this.setStatus(`Selected: ${selected}. Click Place Selected Asset or drag an asset here.`);
    this.syncPlacementButton();
  }

  createCategory() {
    const name = window.prompt("Category name", "New Category");

    if (!name?.trim()) {
      this.setStatus("Create category cancelled.");
      return;
    }

    if (findAssetCategoryByName(this.project, name.trim())) {
      this.setStatus("Category already exists.");
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

  deleteCategory(category) {
    const assetCount = this.project.assetRegistry.assets.filter(
      (asset) => asset.categoryId === category.id,
    ).length;

    if (assetCount === 0) {
      if (!window.confirm(`Delete category "${category.name}"?`)) {
        return;
      }

      deleteAssetCategory(this.project, category.id);
      this.render();
      this.autosave(`Deleted category ${category.name}.`);
      return;
    }

    this.setStatus("This category contains assets. Delete or move the assets first.");
  }

  deleteAsset(asset) {
    if (isAssetUsedOnAnyLevel(this.project, asset.id)) {
      this.setStatus(
        "This asset is currently used on a level. Remove placed copies first before deleting the asset.",
      );
      return;
    }

    if (!window.confirm(`Delete asset "${asset.name}"?`)) {
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
      if (window.confirm("Place this asset into the selected grid area?")) {
        this.placeAssetInRange(importedAsset, pendingPlacementRange, "import");
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

  resizeGrid(width, height) {
    const level = getCurrentLevel(this.project);
    const outsideCount = countObjectsOutsideBounds(level, width, height);

    if (
      outsideCount > 0 &&
      !window.confirm(
        `${outsideCount} placed asset(s) are outside the new grid size and will be removed. Continue?`,
      )
    ) {
      this.render();
      return;
    }

    if (outsideCount > 0) {
      createProjectBackup(this.project, `Before resizing ${level.name} to ${width}x${height}`);
    }
    resizeCurrentLevel(this.project, width, height);
    this.clearSelection();
    this.autosave(`Grid resized to ${width}x${height}.`);
    this.render();
  }

  autosave(message) {
    this.setStatus(message);
    this.saveQueue = this.saveQueue
      .then(() => saveProject(this.project))
      .catch((error) => {
        console.error("Could not save browser editor data.", error);
        this.setStatus(`${message} Browser storage failed; this change may not survive refresh.`);
      });
    return this.saveQueue;
  }

  copyCurrentLevel() {
    this.copiedLevel = createCopiedLevelData(getCurrentLevel(this.project));
    localStorage.setItem(COPIED_LEVEL_STORAGE_KEY, JSON.stringify(this.copiedLevel));
    this.setStatus("Copied current level.");
  }

  pasteCopiedLevel() {
    if (!this.copiedLevel) {
      this.setStatus("No copied level available.");
      return;
    }

    const currentLevel = getCurrentLevel(this.project);

    if (
      hasLevelContent(currentLevel) &&
      !window.confirm(
        "Pasting this level will replace the current level's grid size and all placed assets/objects on this level. Existing assets on this level may be lost. Continue?",
      )
    ) {
      this.setStatus("Paste level cancelled.");
      return;
    }

    pasteLevelContent(this.project, this.copiedLevel);
    this.clearSelection();
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
        deletedLevelFilenames: this.deletedLevelFilenames.filter(
          (filename) => !projectFiles.levels.some((level) => level.filename === filename),
        ),
      });
      this.deletedLevelFilenames = [];
      this.setStatus(
        "Saved project JSON, level JSON files, and assets/assetRegistry.json into the selected Game Dev Kit folder.",
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
    this.gridEditor.render(level, this.project.assets, this.selectedRange, this.dropPreviewRange);
    this.syncLevelSelector(level);
    this.syncGridControls(level);
    this.syncToolButtons();
    this.syncCoordinateStatus();
    this.syncPlacementButton();
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
    const presetValues = ["10", "20", "30", "40", "50"];
    const preset = sameSize && presetValues.includes(String(level.gridWidth))
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

  bindMenuBehavior() {
    this.root.querySelectorAll("[data-menu]").forEach((menu) => {
      menu.addEventListener("toggle", () => {
        if (!menu.open) {
          return;
        }

        this.root.querySelectorAll("[data-menu]").forEach((otherMenu) => {
          if (otherMenu !== menu) {
            otherMenu.removeAttribute("open");
          }
        });
      });
    });

    this.root.querySelectorAll(".menu-panel button").forEach((button) => {
      button.addEventListener("click", () => {
        this.closeMenus();
      });
    });

    document.addEventListener("click", (event) => {
      if (!this.root.contains(event.target) || !event.target.closest("[data-menu]")) {
        this.closeMenus();
      }

      if (!event.target.closest("[data-role='level-picker']")) {
        this.closeLevelPicker();
      }
    });
  }

  closeMenus() {
    this.root.querySelectorAll("[data-menu]").forEach((menu) => {
      menu.removeAttribute("open");
    });
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
