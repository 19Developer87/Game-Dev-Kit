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
  countObjectsOutsideBounds,
  createCopiedLevelData,
  createLevelFileData,
  createProjectIndex,
  createNewLevel,
  deleteCurrentLevel,
  getCurrentLevel,
  hasLevelContent,
  pasteLevelContent,
  placeAsset,
  reorderLevel,
  renameCurrentLevel,
  removeObjectsAtCell,
  resizeCurrentLevel,
  switchLevel,
} from "./LevelManager.js";
import { createProjectBackup, loadProject, saveProject } from "./SaveManager.js";

class DevEditor {
  constructor(root) {
    const loaded = loadProject();

    this.root = root;
    this.project = loaded.project;
    this.startupMessage = loaded.message;
    this.selectedAsset = this.project.assets[0];
    this.activeTool = "paint";
    this.projectFolderHandle = null;
    this.deletedLevelFilenames = [];
    this.copiedLevel = this.loadCopiedLevel();
    this.ui = createEditorLayout(root);

    this.gridEditor = new GridEditor({
      root: this.ui.gridStage,
      onCellClick: (cell) => this.handleCellClick(cell),
    });

    this.assetPalette = new AssetPalette({
      root: this.ui.assetPalette,
      assets: this.project.assets,
      selectedAssetId: this.selectedAsset.id,
      onSelect: (asset) => {
        this.selectedAsset = asset;
        this.activeTool = "paint";
        this.syncToolButtons();
        this.render();
        this.setStatus(`Selected ${asset.name}.`);
      },
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
        this.syncToolButtons();
        this.setStatus(`${this.activeTool === "paint" ? "Paint" : "Delete"} tool active.`);
      });
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
      this.autosave(`Deleted ${level.name}. A backup was saved in this browser.`);
      this.render();
    });

    this.root.querySelector('[data-action="clear"]').addEventListener("click", () => {
      if (!window.confirm("Clear every placed asset from the current level?")) {
        return;
      }
      clearCurrentLevel(this.project);
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
      this.autosave(`Deleted assets at ${x + 1}, ${y + 1}.`);
      this.render();
      return;
    }

    placeAsset(level, this.selectedAsset, x, y);
    this.autosave(`Placed ${this.selectedAsset.name} at ${x + 1}, ${y + 1}.`);
    this.render();
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
    this.autosave(`Grid resized to ${width}x${height}.`);
    this.render();
  }

  autosave(message) {
    saveProject(this.project);
    this.setStatus(message);
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
          "Your browser does not support choosing a project folder, so the project and level JSON files were downloaded instead.",
        );
        return;
      }

      await saveProjectFilesToFolder({
        folderHandle: this.projectFolderHandle,
        projectIndex: projectFiles.projectIndex,
        levels: projectFiles.levels,
        deletedLevelFilenames: this.deletedLevelFilenames.filter(
          (filename) => !projectFiles.levels.some((level) => level.filename === filename),
        ),
      });
      this.deletedLevelFilenames = [];
      this.setStatus(
        "Saved project/game-dev-kit-project.json and level JSON files into the selected Game Dev Kit folder.",
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
      levels: this.project.levels.map((level) => ({
        filename: level.filename || `${level.id}.json`,
        data: createLevelFileData(level),
      })),
    };
  }

  render() {
    const level = getCurrentLevel(this.project);
    this.assetPalette.selectedAssetId = this.selectedAsset.id;
    this.assetPalette.render();
    this.gridEditor.render(level, this.project.assets);
    this.syncLevelSelector(level);
    this.syncGridControls(level);
    this.syncToolButtons();
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

document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("#app");

  if (!root) {
    throw new Error("Editor root element was not found.");
  }

  new DevEditor(root);
});
