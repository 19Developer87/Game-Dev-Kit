import { findObjectsAtCell, getPlacedObjects, numberToLetters, toGridRef } from "./LevelManager.js";

export class GridEditor {
  constructor({
    root,
    onCellClick,
    onHoverCell,
    onSelectionChange,
    onAssetDrop,
    onAssetRenderError,
    onPlacedObjectSelect,
    onPlacedObjectProperties,
    onPlacedObjectTransform,
    onCopyPreviewMove,
  }) {
    this.root = root;
    this.onCellClick = onCellClick;
    this.onHoverCell = onHoverCell;
    this.onSelectionChange = onSelectionChange;
    this.onAssetDrop = onAssetDrop;
    this.onAssetRenderError = onAssetRenderError;
    this.onPlacedObjectSelect = onPlacedObjectSelect;
    this.onPlacedObjectProperties = onPlacedObjectProperties;
    this.onPlacedObjectTransform = onPlacedObjectTransform;
    this.onCopyPreviewMove = onCopyPreviewMove;
    this.interactionMode = "paint";
    this.copyModeActive = false;
    this.gesture = null;
    this.level = null;
    this.surface = null;
    this.selectionBox = null;
    this.dropPreviewBox = null;
    this.copyPreviewBox = null;
    this.selectedPlacedObjectId = null;
    this.lastPlacedObjectPointerDown = null;
  }

  setInteractionMode(mode) {
    this.interactionMode = mode;
  }

  setCopyModeActive(isActive) {
    this.copyModeActive = Boolean(isActive);
    this.surface?.classList.toggle("is-copy-mode", this.copyModeActive);
  }

  render(
    level,
    assets,
    selection = null,
    dropPreview = null,
    selectedPlacedObjectId = null,
    copyPreview = null,
  ) {
    this.level = level;
    this.selectedPlacedObjectId = selectedPlacedObjectId;
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
    this.surface.classList.toggle("is-move-mode", this.interactionMode === "move");
    this.surface.classList.toggle("is-copy-mode", this.copyModeActive);
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
    this.renderPlacedObjects(assetsLayer, level, assets, selectedPlacedObjectId);

    const selectionLayer = document.createElement("div");
    selectionLayer.className = "selection-overlay-layer";
    this.selectionBox = document.createElement("div");
    this.selectionBox.className = "selection-box";
    this.dropPreviewBox = document.createElement("div");
    this.dropPreviewBox.className = "drop-preview-box";
    this.copyPreviewBox = document.createElement("div");
    this.copyPreviewBox.className = "copy-preview-box";
    selectionLayer.append(this.selectionBox, this.dropPreviewBox, this.copyPreviewBox);

    this.surface.append(cells, assetsLayer, selectionLayer);
    this.bindSurfacePointerEvents();
    this.bindSurfaceDragEvents();
    layout.append(corner, columnHeaders, rowHeaders, this.surface);
    wrap.append(layout);
    this.root.append(wrap);

    this.updateSelection(selection);
    this.updateDropPreview(dropPreview);
    this.updateCopyPreview(copyPreview);
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
      if (this.copyModeActive) {
        const target = this.getCellFromClientPoint(event.clientX, event.clientY);
        if (target) {
          this.onCopyPreviewMove?.(target);
        }
      }

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

      if (moved && this.interactionMode === "paint") {
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

    if (gesture.moved && this.interactionMode === "paint") {
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

  updateCopyPreview(preview) {
    if (!this.copyPreviewBox) {
      return;
    }

    if (!preview) {
      this.copyPreviewBox.hidden = true;
      return;
    }

    const assetKey = preview.asset?.id || "missing";
    if (this.copyPreviewBox.dataset.assetKey !== assetKey) {
      this.copyPreviewBox.replaceChildren();
      if (preview.asset?.src) {
        const image = document.createElement("img");
        image.src = preview.asset.src;
        image.alt = "";
        image.draggable = false;
        this.copyPreviewBox.append(image);
      } else {
        this.copyPreviewBox.textContent = "?";
      }
      this.copyPreviewBox.dataset.assetKey = assetKey;
    }

    this.positionFeedbackBox(this.copyPreviewBox, preview.range);
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

  renderPlacedObjects(layer, level, assets, selectedPlacedObjectId) {
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
      marker.style.zIndex = String(getPlacedAssetLayerOrder(placedObject.layer));
      const isSelected =
        this.interactionMode === "move" && placedObject.id === selectedPlacedObjectId;
      const isVisible = placedObject.visible !== false;
      const opacity = normalizeOpacity(placedObject.opacity);
      marker.classList.toggle("is-selected", isSelected);
      marker.classList.toggle("is-hidden", !isVisible);
      marker.classList.toggle("is-zero-opacity", isVisible && opacity === 0);

      if (asset?.src) {
        const image = document.createElement("img");
        image.src = asset.src;
        image.alt = "";
        image.draggable = false;
        image.style.opacity = isVisible ? String(opacity / 100) : "0";
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

      if (this.interactionMode === "move") {
        marker.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || event.target.closest(".resize-handle")) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          const now = event.timeStamp;
          const isDoubleClick =
            this.lastPlacedObjectPointerDown?.id === placedObject.id &&
            now - this.lastPlacedObjectPointerDown.time < 450;
          this.lastPlacedObjectPointerDown = { id: placedObject.id, time: now };
          if (isDoubleClick) {
            this.onPlacedObjectProperties?.(placedObject.id);
            return;
          }
          if (this.copyModeActive) {
            const target = this.getCellFromClientPoint(event.clientX, event.clientY);
            if (target) {
              this.onCellClick({
                ...target,
                existing: findObjectsAtCell(this.level, target.x, target.y),
              });
            }
            return;
          }

          if (!isSelected) {
            this.onPlacedObjectSelect?.(placedObject.id);
            return;
          }

          this.startPlacedObjectTransform(event, marker, placedObject, "move");
        });
      }

      if (isSelected) {
        this.appendResizeHandles(marker, placedObject);
      }

      layer.append(marker);
    });
  }

  appendResizeHandles(marker, placedObject) {
    ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((direction) => {
      const handle = document.createElement("span");
      handle.className = `resize-handle resize-handle-${direction}`;
      handle.dataset.direction = direction;
      handle.setAttribute("aria-hidden", "true");
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.startPlacedObjectTransform(event, marker, placedObject, "resize", direction);
      });
      marker.append(handle);
    });
  }

  startPlacedObjectTransform(event, marker, placedObject, action, direction = null) {
    const startBounds = {
      x: Number(placedObject.x) || 1,
      y: Number(placedObject.y) || 1,
      width: Number(placedObject.width) || 1,
      height: Number(placedObject.height) || 1,
    };
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    let preview = startBounds;

    marker.setPointerCapture(event.pointerId);

    const movePreview = (pointerEvent) => {
      preview = this.calculateTransformBounds(
        startBounds,
        pointerEvent.clientX - startClientX,
        pointerEvent.clientY - startClientY,
        action,
        direction,
      );
      this.positionMarker(marker, preview);
    };

    const finishTransform = (pointerEvent) => {
      marker.removeEventListener("pointermove", movePreview);
      marker.removeEventListener("pointerup", finishTransform);
      marker.removeEventListener("pointercancel", cancelTransform);
      if (marker.hasPointerCapture?.(pointerEvent.pointerId)) {
        marker.releasePointerCapture(pointerEvent.pointerId);
      }

      if (!sameBounds(preview, startBounds)) {
        this.onPlacedObjectTransform?.({
          placedObjectId: placedObject.id,
          ...preview,
          action,
        });
      }
    };

    const cancelTransform = (pointerEvent) => {
      marker.removeEventListener("pointermove", movePreview);
      marker.removeEventListener("pointerup", finishTransform);
      marker.removeEventListener("pointercancel", cancelTransform);
      if (marker.hasPointerCapture?.(pointerEvent.pointerId)) {
        marker.releasePointerCapture(pointerEvent.pointerId);
      }
      this.positionMarker(marker, startBounds);
    };

    marker.addEventListener("pointermove", movePreview);
    marker.addEventListener("pointerup", finishTransform);
    marker.addEventListener("pointercancel", cancelTransform);
  }

  calculateTransformBounds(start, deltaX, deltaY, action, direction) {
    const cellsX = Math.round(deltaX / this.level.tileSize);
    const cellsY = Math.round(deltaY / this.level.tileSize);

    if (action === "move") {
      return {
        ...start,
        x: clamp(start.x + cellsX, 1, this.level.gridWidth - start.width + 1),
        y: clamp(start.y + cellsY, 1, this.level.gridHeight - start.height + 1),
      };
    }

    let left = start.x;
    let top = start.y;
    let right = start.x + start.width - 1;
    let bottom = start.y + start.height - 1;

    if (direction.includes("w")) {
      left = clamp(start.x + cellsX, 1, right);
    }
    if (direction.includes("e")) {
      right = clamp(right + cellsX, left, this.level.gridWidth);
    }
    if (direction.includes("n")) {
      top = clamp(start.y + cellsY, 1, bottom);
    }
    if (direction.includes("s")) {
      bottom = clamp(bottom + cellsY, top, this.level.gridHeight);
    }

    return {
      x: left,
      y: top,
      width: right - left + 1,
      height: bottom - top + 1,
    };
  }

  positionMarker(marker, bounds) {
    marker.style.left = `${(bounds.x - 1) * this.level.tileSize}px`;
    marker.style.top = `${(bounds.y - 1) * this.level.tileSize}px`;
    marker.style.width = `${bounds.width * this.level.tileSize}px`;
    marker.style.height = `${bounds.height * this.level.tileSize}px`;
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

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function sameBounds(first, second) {
  return (
    first.x === second.x &&
    first.y === second.y &&
    first.width === second.width &&
    first.height === second.height
  );
}

function normalizeOpacity(opacity) {
  const number = Number(opacity);
  return Number.isFinite(number) ? clamp(Math.round(number), 0, 100) : 100;
}

function getPlacedAssetLayerOrder(layer) {
  return {
    terrain: 0,
    objects: 10,
    overlay: 20,
    triggers: 30,
    Trigger: 30,
  }[layer] ?? 10;
}
