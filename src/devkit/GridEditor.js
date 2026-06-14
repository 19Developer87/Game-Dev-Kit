import { findObjectsAtCell, getPlacedObjects, numberToLetters, toGridRef } from "./LevelManager.js";

const PLACED_ASSET_LAYER_ORDER = {
  terrain: 0,
  decorations: 10,
  objects: 20,
  collisions: 30,
  spawns: 40,
  items: 50,
  npcs: 60,
  enemies: 70,
  triggers: 80,
  overlay: 90,
};

export class GridEditor {
  constructor({
    root,
    onCellClick,
    onHoverCell,
    onSelectionChange,
    onAssetDrop,
    onAssetRenderError,
    onPlacedObjectSelect,
    onPlacedObjectToggleSelection,
    onPlacedObjectProperties,
    onPlacedObjectTransform,
    onPlacedObjectGroupMoveStart,
    onCopyPreviewMove,
    onDragPaintStart,
    onDragPaintCell,
    onDragPaintEnd,
    onDragPaintCancel,
    onLockedLayerInteraction,
    onLockedAssetInteraction,
  }) {
    this.root = root;
    this.onCellClick = onCellClick;
    this.onHoverCell = onHoverCell;
    this.onSelectionChange = onSelectionChange;
    this.onAssetDrop = onAssetDrop;
    this.onAssetRenderError = onAssetRenderError;
    this.onPlacedObjectSelect = onPlacedObjectSelect;
    this.onPlacedObjectToggleSelection = onPlacedObjectToggleSelection;
    this.onPlacedObjectProperties = onPlacedObjectProperties;
    this.onPlacedObjectTransform = onPlacedObjectTransform;
    this.onPlacedObjectGroupMoveStart = onPlacedObjectGroupMoveStart;
    this.onCopyPreviewMove = onCopyPreviewMove;
    this.onDragPaintStart = onDragPaintStart;
    this.onDragPaintCell = onDragPaintCell;
    this.onDragPaintEnd = onDragPaintEnd;
    this.onDragPaintCancel = onDragPaintCancel;
    this.onLockedLayerInteraction = onLockedLayerInteraction;
    this.onLockedAssetInteraction = onLockedAssetInteraction;
    this.interactionMode = "move";
    this.dragPaintModeActive = false;
    this.paintGesture = null;
    this.copyModeActive = false;
    this.copyMode = "copy";
    this.gesture = null;
    this.level = null;
    this.surface = null;
    this.hoverBox = null;
    this.multiSelectionLayer = null;
    this.selectionBox = null;
    this.dropPreviewBox = null;
    this.copyPreviewBox = null;
    this.paintPreviewLayer = null;
    this.selectedPlacedObjectId = null;
    this.selectedPlacedObjectIds = new Set();
    this.lastPlacedObjectPointerDown = null;
    this.lastPlacedObjectPropertiesOpen = null;
    this.lockedAssetStatusTimer = null;
    this.pendingSelectionCell = null;
    this.selectionAnimationFrame = null;
    this.lastLiveSelectionRange = null;
    this.lastHoveredCellKey = null;
    this.pendingCopyCell = null;
    this.copyAnimationFrame = null;
    this.isCtrlPressed = false;
    this.layerVisibility = {};
    this.layerLocks = {};
    this.placedObjectsById = new Map();
  }

  setInteractionMode(mode) {
    this.interactionMode = mode;
    this.surface?.classList.toggle("is-move-mode", this.interactionMode === "move");
  }

  setDragPaintModeActive(isActive) {
    this.dragPaintModeActive = Boolean(isActive);
    this.surface?.classList.toggle("is-drag-paint-mode", this.dragPaintModeActive);
    if (!this.dragPaintModeActive) {
      this.cancelPaintGesture();
      this.updatePaintPreview([]);
    }
  }

  setCopyModeActive(isActive, mode = "copy") {
    this.copyModeActive = Boolean(isActive);
    this.copyMode = mode;
    this.surface?.classList.toggle("is-copy-mode", this.copyModeActive);
    this.surface?.classList.toggle("is-cut-mode", this.copyModeActive && mode === "cut");
  }

  requestPlacedObjectProperties(placedObjectId) {
    const now = Date.now();
    const recentlyOpened =
      this.lastPlacedObjectPropertiesOpen?.id === placedObjectId &&
      now - this.lastPlacedObjectPropertiesOpen.time < 250;
    if (recentlyOpened) {
      return;
    }

    this.lastPlacedObjectPropertiesOpen = { id: placedObjectId, time: now };
    this.onPlacedObjectProperties?.(placedObjectId);
  }

  scheduleLockedAssetInteraction(placedObject) {
    window.clearTimeout(this.lockedAssetStatusTimer);
    this.lockedAssetStatusTimer = window.setTimeout(() => {
      this.lockedAssetStatusTimer = null;
      this.onLockedAssetInteraction?.(placedObject);
    }, 475);
  }

  cancelLockedAssetInteractionStatus() {
    window.clearTimeout(this.lockedAssetStatusTimer);
    this.lockedAssetStatusTimer = null;
  }

  setLayerVisibility(layerVisibility) {
    this.layerVisibility = { ...layerVisibility };
    this.surface?.querySelectorAll(".placed-asset").forEach((marker) => {
      marker.classList.toggle(
        "is-layer-hidden",
        !this.isLayerVisible(marker.dataset.layer),
      );
    });
    this.syncPlacedObjectSelection(
      this.selectedPlacedObjectId,
      Array.from(this.selectedPlacedObjectIds),
    );
  }

  setLayerLocks(layerLocks) {
    this.layerLocks = { ...layerLocks };
    this.surface?.querySelectorAll(".placed-asset").forEach((marker) => {
      marker.classList.toggle(
        "is-layer-locked",
        this.isLayerLocked(marker.dataset.layer),
      );
    });
    this.syncPlacedObjectSelection(
      this.selectedPlacedObjectId,
      Array.from(this.selectedPlacedObjectIds),
    );
  }

  setCtrlPressed(isPressed) {
    this.isCtrlPressed = Boolean(isPressed);
    this.surface?.classList.toggle("is-multi-select-mode", this.isCtrlPressed);
  }

  refreshPlacedObjects(level, assets, selectedPlacedObjectId, selectedPlacedObjectIds = []) {
    const currentLayer = this.surface?.querySelector(".asset-overlay-layer");
    if (!currentLayer) {
      return;
    }

    this.level = level;
    this.selectedPlacedObjectId = selectedPlacedObjectId;
    this.selectedPlacedObjectIds = new Set(selectedPlacedObjectIds);
    this.placedObjectsById.clear();
    const nextLayer = document.createElement("div");
    nextLayer.className = "asset-overlay-layer";
    this.renderPlacedObjects(nextLayer, level, assets, selectedPlacedObjectId);
    currentLayer.replaceWith(nextLayer);
  }

  syncPlacedObjectSelection(selectedPlacedObjectId, selectedPlacedObjectIds = []) {
    this.selectedPlacedObjectId = selectedPlacedObjectId;
    this.selectedPlacedObjectIds = new Set(selectedPlacedObjectIds);

    this.surface?.querySelectorAll(".placed-asset").forEach((marker) => {
      marker.classList.remove("is-selected", "is-primary-selected");
      marker.querySelectorAll(".resize-handle").forEach((handle) => handle.remove());

      const placedObjectId = marker.dataset.placedObjectId;
      const isSelected =
        this.interactionMode === "move" &&
        this.selectedPlacedObjectIds.has(placedObjectId) &&
        this.isLayerVisible(marker.dataset.layer) &&
        !this.isLayerLocked(marker.dataset.layer);
      if (!isSelected) {
        return;
      }

      marker.classList.add("is-selected");
      marker.classList.toggle(
        "is-primary-selected",
        placedObjectId === this.selectedPlacedObjectId,
      );
      if (this.selectedPlacedObjectIds.size <= 1) {
        const placedObject = this.placedObjectsById.get(placedObjectId);
        if (placedObject && placedObject.editorLocked !== true) {
          this.appendResizeHandles(marker, placedObject);
        }
      }
    });
  }

  render(
    level,
    assets,
    selection = null,
    dropPreview = null,
    selectedPlacedObjectId = null,
    selectedPlacedObjectIds = [],
    copyPreview = null,
    multiSelections = [],
  ) {
    this.level = level;
    this.selectedPlacedObjectId = selectedPlacedObjectId;
    this.selectedPlacedObjectIds = new Set(selectedPlacedObjectIds);
    this.placedObjectsById = new Map();
    this.cancelPendingSelectionFrame();
    this.cancelPendingCopyFrame();
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
    this.surface.tabIndex = 0;
    this.surface.classList.toggle("is-move-mode", this.interactionMode === "move");
    this.surface.classList.toggle("is-drag-paint-mode", this.dragPaintModeActive);
    this.surface.classList.toggle("is-multi-select-mode", this.isCtrlPressed);
    this.surface.classList.toggle("is-copy-mode", this.copyModeActive);
    this.surface.classList.toggle(
      "is-cut-mode",
      this.copyModeActive && this.copyMode === "cut",
    );
    this.surface.style.width = `${level.gridWidth * level.tileSize}px`;
    this.surface.style.height = `${level.gridHeight * level.tileSize}px`;

    const cells = document.createElement("div");
    cells.className = "editor-grid-cells";
    cells.setAttribute("aria-hidden", "true");

    const assetsLayer = document.createElement("div");
    assetsLayer.className = "asset-overlay-layer";
    this.renderPlacedObjects(assetsLayer, level, assets, selectedPlacedObjectId);

    const selectionLayer = document.createElement("div");
    selectionLayer.className = "selection-overlay-layer";
    this.hoverBox = document.createElement("div");
    this.hoverBox.className = "hover-box";
    this.multiSelectionLayer = document.createElement("div");
    this.multiSelectionLayer.className = "multi-selection-layer";
    this.selectionBox = document.createElement("div");
    this.selectionBox.className = "selection-box";
    this.dropPreviewBox = document.createElement("div");
    this.dropPreviewBox.className = "drop-preview-box";
    this.copyPreviewBox = document.createElement("div");
    this.copyPreviewBox.className = "copy-preview-box";
    this.paintPreviewLayer = document.createElement("div");
    this.paintPreviewLayer.className = "paint-preview-layer";
    selectionLayer.append(
      this.multiSelectionLayer,
      this.selectionBox,
      this.dropPreviewBox,
      this.copyPreviewBox,
      this.paintPreviewLayer,
    );

    this.surface.append(cells, this.hoverBox, assetsLayer, selectionLayer);
    this.bindSurfacePointerEvents();
    this.bindSurfaceDragEvents();
    layout.append(corner, columnHeaders, rowHeaders, this.surface);
    wrap.append(layout);
    this.root.append(wrap);

    this.updateSelection(selection);
    this.updateMultiSelections(multiSelections);
    this.updateDropPreview(dropPreview);
    this.updateCopyPreview(copyPreview);
  }

  bindSurfacePointerEvents() {
    this.surface.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const target = this.getCellFromClientPoint(event.clientX, event.clientY);
      if (!target) {
        return;
      }

      event.preventDefault();

      if (this.dragPaintModeActive && this.interactionMode === "move" && !this.copyModeActive) {
        this.cancelPendingSelectionFrame();
        this.gesture = null;
        this.paintGesture = {
          pointerId: event.pointerId,
          current: target,
        };
        this.surface.setPointerCapture(event.pointerId);
        this.onDragPaintStart?.(target);
        return;
      }

      if (this.gesture?.moved) {
        this.completeGesture();
      }
      this.cancelPendingSelectionFrame();
      this.gesture = {
        pointerId: event.pointerId,
        start: target,
        current: target,
        moved: false,
        additive: (event.ctrlKey || this.isCtrlPressed) && this.interactionMode === "move",
      };
      this.lastLiveSelectionRange = null;
      this.surface.setPointerCapture(event.pointerId);
    });

    this.surface.addEventListener("pointermove", (event) => {
      const target = this.getCellFromClientPoint(event.clientX, event.clientY);
      if (target) {
        this.reportHoveredCell(target);
      }

      if (this.copyModeActive) {
        if (target) {
          this.scheduleCopyPreviewUpdate(target);
        }
      }

      if (!this.gesture || event.pointerId !== this.gesture.pointerId) {
        if (this.paintGesture && event.pointerId === this.paintGesture.pointerId && target) {
          this.paintGesture.current = target;
          this.onDragPaintCell?.(target);
        }
        return;
      }

      if (!target) {
        return;
      }

      const current = target;
      this.gesture.current = current;
      const moved = current.x !== this.gesture.start.x || current.y !== this.gesture.start.y;

      if (
        moved &&
        (this.interactionMode === "move" || this.interactionMode === "delete") &&
        !this.copyModeActive
      ) {
        this.gesture.moved = true;
        this.scheduleSelectionUpdate(current);
      }
    });

    this.surface.addEventListener("pointerup", (event) => {
      if (this.paintGesture && event.pointerId === this.paintGesture.pointerId) {
        this.completePaintGesture();
        return;
      }

      if (this.gesture && event.pointerId === this.gesture.pointerId) {
        this.completeGesture();
      }
    });

    this.surface.addEventListener("mouseup", () => {
      if (this.paintGesture) {
        this.completePaintGesture();
        return;
      }

      if (this.gesture) {
        this.completeGesture();
      }
    });

    this.surface.addEventListener("pointercancel", () => {
      this.cancelPaintGesture();
      this.cancelPendingSelectionFrame();
      this.gesture = null;
    });

    this.surface.addEventListener("pointerleave", () => {
      this.lastHoveredCellKey = null;
      this.positionFeedbackBox(this.hoverBox, null);
      if (!this.paintGesture) {
        this.updatePaintPreview([]);
      }
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

  reportHoveredCell(cell) {
    const key = `${cell.x}:${cell.y}`;
    if (key === this.lastHoveredCellKey) {
      return;
    }

    this.lastHoveredCellKey = key;
    this.positionFeedbackBox(this.hoverBox, { ...cell, width: 1, height: 1 });
    this.onHoverCell({ ...cell, gridRef: toGridRef(cell.x, cell.y) });
  }

  completeGesture() {
    const gesture = this.gesture;
    this.gesture = null;
    this.cancelPendingSelectionFrame();

    if (!gesture) {
      return;
    }

    if (this.surface.hasPointerCapture?.(gesture.pointerId)) {
      this.surface.releasePointerCapture(gesture.pointerId);
    }

    if (
      gesture.moved &&
      (this.interactionMode === "move" || this.interactionMode === "delete") &&
      !this.copyModeActive
    ) {
      const range = createRange(
        gesture.start.x,
        gesture.start.y,
        gesture.current.x,
        gesture.current.y,
      );
      this.updateSelection(range);
      this.onSelectionChange(range, "selectionReady", { additive: gesture.additive });
      return;
    }

    this.onCellClick({
      ...gesture.start,
      existing: findObjectsAtCell(this.level, gesture.start.x, gesture.start.y),
      additive: gesture.additive,
    });
  }

  updateSelection(selection) {
    this.positionFeedbackBox(this.selectionBox, selection);
    this.lastLiveSelectionRange = selection ? { ...selection } : null;
  }

  updateMultiSelections(selections = []) {
    if (!this.multiSelectionLayer) {
      return;
    }

    this.multiSelectionLayer.replaceChildren();
    selections.forEach((selection) => {
      const box = document.createElement("div");
      box.className = "selection-box multi-selection-box";
      this.positionFeedbackBox(box, selection);
      this.multiSelectionLayer.append(box);
    });
  }

  cancelGesture() {
    this.cancelPendingSelectionFrame();
    this.gesture = null;
    this.cancelPaintGesture();
  }

  completePaintGesture() {
    const paintGesture = this.paintGesture;
    this.paintGesture = null;
    if (!paintGesture) {
      return;
    }

    if (this.surface.hasPointerCapture?.(paintGesture.pointerId)) {
      this.surface.releasePointerCapture(paintGesture.pointerId);
    }

    this.onDragPaintEnd?.();
  }

  cancelPaintGesture() {
    const paintGesture = this.paintGesture;
    this.paintGesture = null;
    if (paintGesture && this.surface?.hasPointerCapture?.(paintGesture.pointerId)) {
      this.surface.releasePointerCapture(paintGesture.pointerId);
    }
    this.onDragPaintCancel?.();
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
      this.copyPreviewBox.classList.remove("is-cut-preview");
      return;
    }

    this.copyPreviewBox.classList.toggle("is-cut-preview", preview.mode === "cut");
    if (this.copyPreviewBox.dataset.previewKey !== preview.key) {
      this.copyPreviewBox.replaceChildren();
      preview.items.forEach((item) => {
        const previewItem = document.createElement("div");
        previewItem.className = "copy-preview-item";
        previewItem.style.left = `${(item.range.x - preview.range.x) * this.level.tileSize}px`;
        previewItem.style.top = `${(item.range.y - preview.range.y) * this.level.tileSize}px`;
        previewItem.style.width = `${item.range.width * this.level.tileSize}px`;
        previewItem.style.height = `${item.range.height * this.level.tileSize}px`;
        if (item.asset?.src) {
          const image = document.createElement("img");
          image.src = item.asset.src;
          image.alt = "";
          image.draggable = false;
          image.style.opacity = item.placedObject.visible === false
            ? "0.18"
            : String(normalizeOpacity(item.placedObject.opacity) / 100);
          previewItem.append(image);
        } else {
          previewItem.textContent = "?";
        }
        this.copyPreviewBox.append(previewItem);
      });
      this.copyPreviewBox.dataset.previewKey = preview.key;
    }

    this.positionFeedbackBox(this.copyPreviewBox, preview.range);
  }

  updateCopyPreviewPosition(range) {
    this.positionFeedbackBox(this.copyPreviewBox, range);
  }

  updatePaintPreview(cells = []) {
    if (!this.paintPreviewLayer) {
      return;
    }

    this.paintPreviewLayer.replaceChildren();
    cells.forEach((cell) => {
      const box = document.createElement("div");
      box.className = "paint-preview-cell";
      this.positionFeedbackBox(box, { x: cell.x, y: cell.y, width: 1, height: 1 });
      this.paintPreviewLayer.append(box);
    });
  }

  scheduleSelectionUpdate(current) {
    this.pendingSelectionCell = current;

    if (this.selectionAnimationFrame !== null) {
      return;
    }

    this.selectionAnimationFrame = window.requestAnimationFrame(() => {
      this.selectionAnimationFrame = null;
      this.flushSelectionUpdate();
    });
  }

  flushSelectionUpdate() {
    if (!this.gesture || !this.pendingSelectionCell) {
      this.pendingSelectionCell = null;
      return;
    }

    const current = this.pendingSelectionCell;
    this.pendingSelectionCell = null;
    const range = createRange(
      this.gesture.start.x,
      this.gesture.start.y,
      current.x,
      current.y,
    );

    if (rangesMatch(range, this.lastLiveSelectionRange)) {
      return;
    }

    this.updateSelection(range);
    this.onSelectionChange(range, "draggingSelection", { additive: this.gesture.additive });
  }

  cancelPendingSelectionFrame() {
    if (this.selectionAnimationFrame !== null) {
      window.cancelAnimationFrame(this.selectionAnimationFrame);
      this.selectionAnimationFrame = null;
    }
    this.pendingSelectionCell = null;
  }

  cancelPendingCopyFrame() {
    if (this.copyAnimationFrame !== null) {
      window.cancelAnimationFrame(this.copyAnimationFrame);
      this.copyAnimationFrame = null;
    }
    this.pendingCopyCell = null;
  }

  scheduleCopyPreviewUpdate(target) {
    this.pendingCopyCell = target;

    if (this.copyAnimationFrame !== null) {
      return;
    }

    this.copyAnimationFrame = window.requestAnimationFrame(() => {
      this.copyAnimationFrame = null;
      const pending = this.pendingCopyCell;
      this.pendingCopyCell = null;
      if (pending) {
        this.onCopyPreviewMove?.(pending);
      }
    });
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
    const placedObjects = getPlacedObjects(level).sort(comparePlacedAssetRenderOrder);

    placedObjects.forEach((placedObject) => {
      this.placedObjectsById.set(placedObject.id, placedObject);
      const asset = assetLookup.get(placedObject.assetId);
      const marker = document.createElement("div");
      marker.className = "placed-asset";
      marker.dataset.placedObjectId = placedObject.id;
      marker.dataset.layer = normalizePlacedLayer(placedObject.layer);
      marker.title = `${asset?.name || placedObject.name || placedObject.assetId} ${placedObject.rangeRef || ""}`.trim();
      marker.style.left = `${(Number(placedObject.x) - 1) * level.tileSize}px`;
      marker.style.top = `${(Number(placedObject.y) - 1) * level.tileSize}px`;
      marker.style.width = `${(Number(placedObject.width) || 1) * level.tileSize}px`;
      marker.style.height = `${(Number(placedObject.height) || 1) * level.tileSize}px`;
      marker.style.zIndex = String(getPlacedAssetLayerOrder(placedObject.layer));
      const isSelected =
        this.interactionMode === "move" &&
        this.isLayerVisible(placedObject.layer) &&
        !this.isLayerLocked(placedObject.layer) &&
        (placedObject.id === selectedPlacedObjectId || this.selectedPlacedObjectIds.has(placedObject.id));
      const isPrimarySelected = isSelected && placedObject.id === selectedPlacedObjectId;
      const isVisible = placedObject.visible !== false;
      const opacity = normalizeOpacity(placedObject.opacity);
      marker.classList.toggle("is-selected", isSelected);
      marker.classList.toggle("is-primary-selected", isPrimarySelected);
      marker.classList.toggle("is-hidden", !isVisible);
      marker.classList.toggle("is-zero-opacity", isVisible && opacity === 0);
      marker.classList.toggle(
        "is-layer-hidden",
        !this.isLayerVisible(marker.dataset.layer),
      );
      marker.classList.toggle(
        "is-layer-locked",
        this.isLayerLocked(marker.dataset.layer),
      );
      marker.classList.toggle("is-asset-locked", placedObject.editorLocked === true);

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

          if (this.dragPaintModeActive && !this.copyModeActive) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          if (this.isLayerLocked(placedObject.layer)) {
            this.onLockedLayerInteraction?.(normalizePlacedLayer(placedObject.layer));
            return;
          }
          if ((event.ctrlKey || this.isCtrlPressed) && !this.copyModeActive) {
            this.cancelLockedAssetInteractionStatus();
            this.onPlacedObjectToggleSelection?.(placedObject.id);
            return;
          }
          const now = event.timeStamp;
          const isDoubleClick =
            this.lastPlacedObjectPointerDown?.id === placedObject.id &&
            now - this.lastPlacedObjectPointerDown.time < 450;
          this.lastPlacedObjectPointerDown = { id: placedObject.id, time: now };
          if (isDoubleClick) {
            this.cancelLockedAssetInteractionStatus();
            this.requestPlacedObjectProperties(placedObject.id);
            return;
          }
          if (placedObject.editorLocked === true) {
            if (!isSelected) {
              this.selectedPlacedObjectIds = new Set([placedObject.id]);
              this.onPlacedObjectSelect?.(placedObject.id);
            }
            this.scheduleLockedAssetInteraction(placedObject);
            return;
          }
          this.cancelLockedAssetInteractionStatus();
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

          if (isSelected && this.selectedPlacedObjectIds.size > 1) {
            this.startPlacedObjectGroupTransform(event, placedObject);
            return;
          }

          if (!isSelected) {
            this.selectedPlacedObjectIds = new Set([placedObject.id]);
          }

          this.startPlacedObjectTransform(event, marker, placedObject, "move");
        });

        marker.addEventListener("dblclick", (event) => {
          if (event.button !== 0 || event.target.closest(".resize-handle")) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          if (this.isLayerLocked(placedObject.layer)) {
            this.onLockedLayerInteraction?.(normalizePlacedLayer(placedObject.layer));
            return;
          }
          this.cancelLockedAssetInteractionStatus();
          this.requestPlacedObjectProperties(placedObject.id);
        });
      }

      if (isSelected && this.selectedPlacedObjectIds.size <= 1 && placedObject.editorLocked !== true) {
        this.appendResizeHandles(marker, placedObject);
      }

      layer.append(marker);
    });
  }

  isLayerVisible(layerName) {
    return this.layerVisibility[normalizePlacedLayer(layerName)] !== false;
  }

  isLayerLocked(layerName) {
    return this.layerLocks[normalizePlacedLayer(layerName)] === true;
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

        if (this.dragPaintModeActive && !this.copyModeActive) {
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
    let pendingPreview = null;
    let transformAnimationFrame = null;

    const applyPreview = () => {
      transformAnimationFrame = null;
      if (!pendingPreview) {
        return;
      }
      preview = pendingPreview;
      pendingPreview = null;
      this.positionMarker(marker, preview);
    };

    const schedulePreview = (bounds) => {
      pendingPreview = bounds;
      if (transformAnimationFrame !== null) {
        return;
      }
      transformAnimationFrame = window.requestAnimationFrame(applyPreview);
    };

    const cancelPreviewFrame = () => {
      if (transformAnimationFrame !== null) {
        window.cancelAnimationFrame(transformAnimationFrame);
        transformAnimationFrame = null;
      }
      pendingPreview = null;
    };

    const flushPreview = () => {
      if (transformAnimationFrame !== null) {
        window.cancelAnimationFrame(transformAnimationFrame);
        applyPreview();
      }
    };

    marker.setPointerCapture(event.pointerId);

    const movePreview = (pointerEvent) => {
      schedulePreview(
        this.calculateTransformBounds(
          startBounds,
          pointerEvent.clientX - startClientX,
          pointerEvent.clientY - startClientY,
          action,
          direction,
        ),
      );
    };

    const finishTransform = (pointerEvent) => {
      marker.removeEventListener("pointermove", movePreview);
      marker.removeEventListener("pointerup", finishTransform);
      marker.removeEventListener("pointercancel", cancelTransform);
      flushPreview();
      if (marker.hasPointerCapture?.(pointerEvent.pointerId)) {
        marker.releasePointerCapture(pointerEvent.pointerId);
      }

      if (!sameBounds(preview, startBounds)) {
        this.onPlacedObjectTransform?.({
          placedObjectId: placedObject.id,
          ...preview,
          action,
        });
      } else if (action === "move") {
        this.onPlacedObjectSelect?.(placedObject.id);
      }
    };

    const cancelTransform = (pointerEvent) => {
      marker.removeEventListener("pointermove", movePreview);
      marker.removeEventListener("pointerup", finishTransform);
      marker.removeEventListener("pointercancel", cancelTransform);
      cancelPreviewFrame();
      if (marker.hasPointerCapture?.(pointerEvent.pointerId)) {
        marker.releasePointerCapture(pointerEvent.pointerId);
      }
      this.positionMarker(marker, startBounds);
    };

    marker.addEventListener("pointermove", movePreview);
    marker.addEventListener("pointerup", finishTransform);
    marker.addEventListener("pointercancel", cancelTransform);
  }

  startPlacedObjectGroupTransform(event, activePlacedObject) {
    const selectedIds = Array.from(this.selectedPlacedObjectIds);
    const selectedObjects = getPlacedObjects(this.level).filter(
      (placedObject) =>
        this.isLayerVisible(placedObject.layer) &&
        !this.isLayerLocked(placedObject.layer) &&
        placedObject.editorLocked !== true &&
        this.selectedPlacedObjectIds.has(placedObject.id),
    );

    if (selectedObjects.length <= 1) {
      const marker = this.surface.querySelector(
        `.placed-asset[data-placed-object-id="${CSS.escape(activePlacedObject.id)}"]`,
      );
      if (marker) {
        this.startPlacedObjectTransform(event, marker, activePlacedObject, "move");
      }
      return;
    }

    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startBoundsById = new Map(
      selectedObjects.map((placedObject) => [
        placedObject.id,
        {
          x: Number(placedObject.x) || 1,
          y: Number(placedObject.y) || 1,
          width: Number(placedObject.width) || 1,
          height: Number(placedObject.height) || 1,
        },
      ]),
    );
    let preview = this.calculateGroupMoveBounds(startBoundsById, 0, 0);
    let hasStartedGroupMove = false;
    let pendingGroupPreview = null;
    let groupAnimationFrame = null;
    const markersById = new Map(
      selectedObjects.map((placedObject) => [
        placedObject.id,
        this.surface.querySelector(
          `.placed-asset[data-placed-object-id="${CSS.escape(placedObject.id)}"]`,
        ),
      ]),
    );

    const applyGroupPreview = () => {
      groupAnimationFrame = null;
      if (!pendingGroupPreview) {
        return;
      }
      preview = pendingGroupPreview;
      pendingGroupPreview = null;
      preview.boundsById.forEach((bounds, placedObjectId) => {
        const marker = markersById.get(placedObjectId);
        if (marker) {
          this.positionMarker(marker, bounds);
        }
      });
    };

    const scheduleGroupPreview = (nextPreview) => {
      pendingGroupPreview = nextPreview;
      if (groupAnimationFrame !== null) {
        return;
      }
      groupAnimationFrame = window.requestAnimationFrame(applyGroupPreview);
    };

    const cancelGroupPreviewFrame = () => {
      if (groupAnimationFrame !== null) {
        window.cancelAnimationFrame(groupAnimationFrame);
        groupAnimationFrame = null;
      }
      pendingGroupPreview = null;
    };

    const flushGroupPreview = () => {
      if (groupAnimationFrame !== null) {
        window.cancelAnimationFrame(groupAnimationFrame);
        applyGroupPreview();
      }
    };

    const movePreview = (pointerEvent) => {
      const cellsX = Math.round((pointerEvent.clientX - startClientX) / this.level.tileSize);
      const cellsY = Math.round((pointerEvent.clientY - startClientY) / this.level.tileSize);
      if (!hasStartedGroupMove && (cellsX !== 0 || cellsY !== 0)) {
        hasStartedGroupMove = true;
        this.onPlacedObjectGroupMoveStart?.();
      }
      scheduleGroupPreview(this.calculateGroupMoveBounds(startBoundsById, cellsX, cellsY));
    };

    const finishTransform = (pointerEvent) => {
      this.surface.removeEventListener("pointermove", movePreview);
      this.surface.removeEventListener("pointerup", finishTransform);
      this.surface.removeEventListener("pointercancel", cancelTransform);
      flushGroupPreview();
      if (this.surface.hasPointerCapture?.(pointerEvent.pointerId)) {
        this.surface.releasePointerCapture(pointerEvent.pointerId);
      }

      if (preview.deltaX !== 0 || preview.deltaY !== 0) {
        this.onPlacedObjectTransform?.({
          placedObjectId: activePlacedObject.id,
          placedObjectIds: selectedIds,
          boundsById: Array.from(preview.boundsById.entries()),
          action: "group-move",
        });
      }
    };

    const cancelTransform = (pointerEvent) => {
      this.surface.removeEventListener("pointermove", movePreview);
      this.surface.removeEventListener("pointerup", finishTransform);
      this.surface.removeEventListener("pointercancel", cancelTransform);
      cancelGroupPreviewFrame();
      if (this.surface.hasPointerCapture?.(pointerEvent.pointerId)) {
        this.surface.releasePointerCapture(pointerEvent.pointerId);
      }
      startBoundsById.forEach((bounds, placedObjectId) => {
        const marker = markersById.get(placedObjectId);
        if (marker) {
          this.positionMarker(marker, bounds);
        }
      });
    };

    this.surface.setPointerCapture(event.pointerId);
    this.surface.addEventListener("pointermove", movePreview);
    this.surface.addEventListener("pointerup", finishTransform);
    this.surface.addEventListener("pointercancel", cancelTransform);
  }

  calculateGroupMoveBounds(startBoundsById, requestedDeltaX, requestedDeltaY) {
    let minDeltaX = -Infinity;
    let maxDeltaX = Infinity;
    let minDeltaY = -Infinity;
    let maxDeltaY = Infinity;

    startBoundsById.forEach((bounds) => {
      minDeltaX = Math.max(minDeltaX, 1 - bounds.x);
      maxDeltaX = Math.min(maxDeltaX, this.level.gridWidth - (bounds.x + bounds.width - 1));
      minDeltaY = Math.max(minDeltaY, 1 - bounds.y);
      maxDeltaY = Math.min(maxDeltaY, this.level.gridHeight - (bounds.y + bounds.height - 1));
    });

    const deltaX = clamp(requestedDeltaX, minDeltaX, maxDeltaX);
    const deltaY = clamp(requestedDeltaY, minDeltaY, maxDeltaY);
    const boundsById = new Map();

    startBoundsById.forEach((bounds, placedObjectId) => {
      boundsById.set(placedObjectId, {
        ...bounds,
        x: bounds.x + deltaX,
        y: bounds.y + deltaY,
      });
    });

    return { deltaX, deltaY, boundsById };
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

function rangesMatch(first, second) {
  if (!first || !second) {
    return first === second;
  }

  return sameBounds(first, second);
}

function normalizeOpacity(opacity) {
  const number = Number(opacity);
  return Number.isFinite(number) ? clamp(Math.round(number), 0, 100) : 100;
}

function getPlacedAssetLayerOrder(layer) {
  return PLACED_ASSET_LAYER_ORDER[normalizePlacedLayer(layer)] ?? PLACED_ASSET_LAYER_ORDER.objects;
}

function comparePlacedAssetRenderOrder(first, second) {
  const layerOrder = getPlacedAssetLayerOrder(first.layer) - getPlacedAssetLayerOrder(second.layer);
  if (layerOrder !== 0) {
    return layerOrder;
  }

  const yOrder = (Number(first.y) || 1) - (Number(second.y) || 1);
  if (yOrder !== 0) {
    return yOrder;
  }

  const xOrder = (Number(first.x) || 1) - (Number(second.x) || 1);
  if (xOrder !== 0) {
    return xOrder;
  }

  return String(first.id || "").localeCompare(String(second.id || ""));
}

function normalizePlacedLayer(layer) {
  if (layer === "Trigger") {
    return "triggers";
  }
  return Object.prototype.hasOwnProperty.call(PLACED_ASSET_LAYER_ORDER, layer)
    ? layer
    : "objects";
}
