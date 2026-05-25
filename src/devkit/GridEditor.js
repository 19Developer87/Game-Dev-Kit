import { findObjectsAtCell, getPlacedObjects, numberToLetters, toGridRef } from "./LevelManager.js";

export class GridEditor {
  constructor({
    root,
    onCellClick,
    onHoverCell,
    onSelectionChange,
    onAssetDrop,
    onAssetRenderError,
  }) {
    this.root = root;
    this.onCellClick = onCellClick;
    this.onHoverCell = onHoverCell;
    this.onSelectionChange = onSelectionChange;
    this.onAssetDrop = onAssetDrop;
    this.onAssetRenderError = onAssetRenderError;
    this.interactionMode = "paint";
    this.gesture = null;
    this.level = null;
    this.surface = null;
    this.selectionBox = null;
    this.dropPreviewBox = null;
  }

  setInteractionMode(mode) {
    this.interactionMode = mode;
  }

  render(level, assets, selection = null, dropPreview = null) {
    this.level = level;
    this.root.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "grid-wrap";

    const layout = document.createElement("div");
    layout.className = "grid-layout";
    layout.style.setProperty("--tile-size", `${level.tileSize}px`);
    layout.style.setProperty("--grid-width", String(level.gridWidth));
    layout.style.setProperty("--grid-height", String(level.gridHeight));

    const corner = document.createElement("div");
    corner.className = "grid-header grid-corner";

    const columnHeaders = document.createElement("div");
    columnHeaders.className = "grid-column-headers";
    columnHeaders.style.gridTemplateColumns = `repeat(${level.gridWidth}, ${level.tileSize}px)`;
    for (let x = 1; x <= level.gridWidth; x += 1) {
      const header = document.createElement("div");
      header.className = "grid-header";
      header.textContent = String(x);
      columnHeaders.append(header);
    }

    const rowHeaders = document.createElement("div");
    rowHeaders.className = "grid-row-headers";
    rowHeaders.style.gridTemplateRows = `repeat(${level.gridHeight}, ${level.tileSize}px)`;
    for (let y = 1; y <= level.gridHeight; y += 1) {
      const header = document.createElement("div");
      header.className = "grid-header";
      header.textContent = numberToLetters(y);
      rowHeaders.append(header);
    }

    this.surface = document.createElement("div");
    this.surface.className = "grid-surface";
    this.surface.style.width = `${level.gridWidth * level.tileSize}px`;
    this.surface.style.height = `${level.gridHeight * level.tileSize}px`;

    const cells = document.createElement("div");
    cells.className = "editor-grid-cells";
    cells.style.gridTemplateColumns = `repeat(${level.gridWidth}, ${level.tileSize}px)`;
    cells.style.gridTemplateRows = `repeat(${level.gridHeight}, ${level.tileSize}px)`;
    for (let y = 1; y <= level.gridHeight; y += 1) {
      for (let x = 1; x <= level.gridWidth; x += 1) {
        cells.append(this.renderCell(level, x, y));
      }
    }

    const assetsLayer = document.createElement("div");
    assetsLayer.className = "asset-overlay-layer";
    this.renderPlacedObjects(assetsLayer, level, assets);

    const selectionLayer = document.createElement("div");
    selectionLayer.className = "selection-overlay-layer";
    this.selectionBox = document.createElement("div");
    this.selectionBox.className = "selection-box";
    this.dropPreviewBox = document.createElement("div");
    this.dropPreviewBox.className = "drop-preview-box";
    selectionLayer.append(this.selectionBox, this.dropPreviewBox);

    this.surface.append(cells, assetsLayer, selectionLayer);
    this.bindSurfacePointerEvents();
    this.bindSurfaceDragEvents();
    layout.append(corner, columnHeaders, rowHeaders, this.surface);
    wrap.append(layout);
    this.root.append(wrap);

    this.updateSelection(selection);
    this.updateDropPreview(dropPreview);
  }

  renderCell(level, x, y) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "grid-cell";
    cell.dataset.x = String(x);
    cell.dataset.y = String(y);
    cell.setAttribute("aria-label", `Cell ${toGridRef(x, y)}`);

    cell.addEventListener("pointerenter", () => {
      this.onHoverCell({ x, y, gridRef: toGridRef(x, y) });
    });

    cell.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      if (this.gesture?.moved) {
        this.completeGesture();
      }
      this.gesture = {
        pointerId: event.pointerId,
        start: { x, y },
        current: { x, y },
        moved: false,
      };
      this.surface.setPointerCapture(event.pointerId);
    });

    return cell;
  }

  bindSurfacePointerEvents() {
    this.surface.addEventListener("pointermove", (event) => {
      if (!this.gesture || event.pointerId !== this.gesture.pointerId) {
        return;
      }

      const cell = this.findCellAtPoint(event.clientX, event.clientY);
      if (!cell) {
        return;
      }

      const current = readCellPosition(cell);
      this.gesture.current = current;
      const moved = current.x !== this.gesture.start.x || current.y !== this.gesture.start.y;

      if (moved && this.interactionMode !== "delete") {
        this.gesture.moved = true;
        const range = createRange(
          this.gesture.start.x,
          this.gesture.start.y,
          current.x,
          current.y,
        );
        this.updateSelection(range);
        this.onSelectionChange(range, "draggingSelection");
      }
    });

    this.surface.addEventListener("pointerup", (event) => {
      if (this.gesture && event.pointerId === this.gesture.pointerId) {
        this.completeGesture();
      }
    });

    this.surface.addEventListener("mouseup", () => {
      if (this.gesture) {
        this.completeGesture();
      }
    });

    this.surface.addEventListener("pointercancel", () => {
      this.gesture = null;
    });
  }

  bindSurfaceDragEvents() {
    this.surface.addEventListener("dragover", (event) => {
      const target = this.getCellFromClientPoint(event.clientX, event.clientY);

      if (!target) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      this.onHoverCell({
        ...target,
        gridRef: toGridRef(target.x, target.y),
        isDropTarget: true,
      });
    });

    this.surface.addEventListener("dragleave", (event) => {
      if (!this.surface.contains(event.relatedTarget)) {
        this.updateDropPreview(null);
      }
    });

    this.surface.addEventListener("drop", (event) => {
      const target = this.getCellFromClientPoint(event.clientX, event.clientY);

      if (!target) {
        return;
      }

      event.preventDefault();
      const assetId =
        event.dataTransfer.getData("application/x-game-dev-kit-asset") ||
        event.dataTransfer.getData("text/plain");
      this.updateDropPreview(null);
      this.onAssetDrop({ assetId, ...target });
    });
  }

  completeGesture() {
    const gesture = this.gesture;
    this.gesture = null;

    if (!gesture) {
      return;
    }

    if (this.surface.hasPointerCapture?.(gesture.pointerId)) {
      this.surface.releasePointerCapture(gesture.pointerId);
    }

    if (gesture.moved && this.interactionMode !== "delete") {
      const range = createRange(
        gesture.start.x,
        gesture.start.y,
        gesture.current.x,
        gesture.current.y,
      );
      this.updateSelection(range);
      this.onSelectionChange(range, "selectionReady");
      return;
    }

    this.onCellClick({
      ...gesture.start,
      existing: findObjectsAtCell(this.level, gesture.start.x, gesture.start.y),
    });
  }

  updateSelection(selection) {
    this.positionFeedbackBox(this.selectionBox, selection);
  }

  cancelGesture() {
    this.gesture = null;
  }

  updateDropPreview(range) {
    this.positionFeedbackBox(this.dropPreviewBox, range);
  }

  positionFeedbackBox(box, range) {
    if (!box) {
      return;
    }

    if (!range) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    box.style.left = `${(range.x - 1) * this.level.tileSize}px`;
    box.style.top = `${(range.y - 1) * this.level.tileSize}px`;
    box.style.width = `${range.width * this.level.tileSize}px`;
    box.style.height = `${range.height * this.level.tileSize}px`;
  }

  renderPlacedObjects(layer, level, assets) {
    const assetLookup = new Map(assets.map((asset) => [asset.id, asset]));

    getPlacedObjects(level).forEach((placedObject) => {
      const asset = assetLookup.get(placedObject.assetId);
      const marker = document.createElement("div");
      marker.className = "placed-asset";
      marker.title = `${asset?.name || placedObject.name || placedObject.assetId} ${placedObject.rangeRef || ""}`.trim();
      marker.style.left = `${(Number(placedObject.x) - 1) * level.tileSize}px`;
      marker.style.top = `${(Number(placedObject.y) - 1) * level.tileSize}px`;
      marker.style.width = `${(Number(placedObject.width) || 1) * level.tileSize}px`;
      marker.style.height = `${(Number(placedObject.height) || 1) * level.tileSize}px`;

      if (asset?.src) {
        const image = document.createElement("img");
        image.src = asset.src;
        image.alt = "";
        image.draggable = false;
        image.addEventListener("error", () => {
          marker.classList.add("is-missing");
          marker.textContent = "Missing image";
          this.onAssetRenderError?.(placedObject, asset);
        });
        marker.append(image);
      } else {
        marker.classList.add(asset ? "is-missing" : "is-legacy");
        marker.textContent = asset ? "Missing image" : placedObject.name?.charAt(0) || "?";
        marker.style.background = asset?.color || "#69737a";
      }

      layer.append(marker);
    });
  }

  findCellAtPoint(clientX, clientY) {
    return document.elementFromPoint(clientX, clientY)?.closest(".grid-cell");
  }

  getCellFromClientPoint(clientX, clientY) {
    const bounds = this.surface.getBoundingClientRect();
    const x = Math.floor((clientX - bounds.left) / this.level.tileSize) + 1;
    const y = Math.floor((clientY - bounds.top) / this.level.tileSize) + 1;

    if (x < 1 || x > this.level.gridWidth || y < 1 || y > this.level.gridHeight) {
      return null;
    }

    return { x, y };
  }
}

function readCellPosition(cell) {
  return {
    x: Number(cell.dataset.x),
    y: Number(cell.dataset.y),
  };
}

function createRange(startX, startY, endX, endY) {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX) + 1;
  const height = Math.abs(endY - startY) + 1;

  return { x, y, width, height };
}
