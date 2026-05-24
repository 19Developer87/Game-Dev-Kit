import { AssetPalette } from "./AssetPalette.js";
import { createEditorLayout } from "./DevEditorUI.js";
import { GridEditor } from "./GridEditor.js";
import {
  copyJsonToClipboard,
  createLevelExportName,
  createLevelSaveAsName,
  exportJson,
  saveJsonAs,
} from "./ImportExportManager.js";
import {
  clearCurrentLevel,
  countObjectsOutsideBounds,
  getCurrentLevel,
  placeAsset,
  removeObjectsAtCell,
  resizeCurrentLevel,
} from "./LevelManager.js";
import { loadProject, saveProject } from "./SaveManager.js";

class DevEditor {
  constructor(root) {
    const loaded = loadProject();

    this.root = root;
    this.project = loaded.project;
    this.startupMessage = loaded.message;
    this.selectedAsset = this.project.assets[0];
    this.activeTool = "paint";
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

    this.root.querySelector('[data-action="save"]').addEventListener("click", () => {
      this.save("Saved editor data to this browser.");
    });

    this.root.querySelector('[data-action="clear"]').addEventListener("click", () => {
      if (!window.confirm("Clear every placed asset from the current level?")) {
        return;
      }
      clearCurrentLevel(this.project);
      this.save("Cleared the current level and saved the empty grid.");
      this.render();
    });

    this.root.querySelector('[data-action="export-level"]').addEventListener("click", () => {
      const level = getCurrentLevel(this.project);
      exportJson(createLevelExportName(level), level);
      this.setStatus("Exported the current level JSON.");
    });

    this.root.querySelector('[data-action="export-project"]').addEventListener("click", () => {
      exportJson("game-dev-kit-project.json", this.project);
      this.setStatus("Exported the full project JSON.");
    });

    this.root.querySelector('[data-action="save-level-as"]').addEventListener("click", async () => {
      const level = getCurrentLevel(this.project);
      await this.saveJsonWithPicker(createLevelSaveAsName(level), level);
    });

    this.root
      .querySelector('[data-action="save-project-as"]')
      .addEventListener("click", async () => {
        await this.saveJsonWithPicker("game-dev-kit-project.json", this.project);
      });

    this.root
      .querySelector('[data-action="copy-level-json"]')
      .addEventListener("click", async () => {
        try {
          await copyJsonToClipboard(getCurrentLevel(this.project));
          this.setStatus("Copied current level JSON to clipboard.");
        } catch (error) {
          console.error(error);
          this.setStatus("Could not copy JSON to clipboard.");
        }
      });

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
      this.save(`Deleted assets at ${x + 1}, ${y + 1}.`);
      this.render();
      return;
    }

    placeAsset(level, this.selectedAsset, x, y);
    this.save(`Placed ${this.selectedAsset.name} at ${x + 1}, ${y + 1}.`);
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

    resizeCurrentLevel(this.project, width, height);
    this.save(`Grid resized to ${width}x${height}.`);
    this.render();
  }

  save(message) {
    saveProject(this.project);
    this.setStatus(message);
  }

  async saveJsonWithPicker(filename, data) {
    try {
      const result = await saveJsonAs(filename, data);

      if (result.fallback) {
        this.setStatus(
          "Your browser does not support choosing a folder, so the file was downloaded instead.",
        );
        return;
      }

      this.setStatus(`Saved ${result.filename}`);
    } catch (error) {
      if (error?.name === "AbortError") {
        this.setStatus("Save cancelled.");
        return;
      }

      console.error(error);
      this.setStatus("Could not save JSON.");
    }
  }

  render() {
    const level = getCurrentLevel(this.project);
    this.assetPalette.selectedAssetId = this.selectedAsset.id;
    this.assetPalette.render();
    this.gridEditor.render(level, this.project.assets);
    this.syncGridControls(level);
    this.syncToolButtons();
    this.ui.levelSummary.textContent = `${level.name} · ${level.gridWidth}x${level.gridHeight} · ${level.tileSize}px tiles`;
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
