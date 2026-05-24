import { findObjectsAtCell, getPlacedObjects } from "./LevelManager.js";

export class GridEditor {
  constructor({ root, onCellClick }) {
    this.root = root;
    this.onCellClick = onCellClick;
  }

  render(level, assets) {
    this.root.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "grid-wrap";

    const grid = document.createElement("div");
    grid.className = "editor-grid";
    grid.style.gridTemplateColumns = `repeat(${level.gridWidth}, ${level.tileSize}px)`;

    const assetLookup = new Map(assets.map((asset) => [asset.id, asset]));
    const placedLookup = new Map(
      getPlacedObjects(level).map((placedObject) => [
        `${placedObject.x},${placedObject.y}`,
        placedObject,
      ]),
    );

    for (let y = 0; y < level.gridHeight; y += 1) {
      for (let x = 0; x < level.gridWidth; x += 1) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "grid-cell";
        cell.style.width = `${level.tileSize}px`;
        cell.style.height = `${level.tileSize}px`;
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.setAttribute("aria-label", `Cell ${x + 1}, ${y + 1}`);

        const placedObject = placedLookup.get(`${x},${y}`);
        if (placedObject) {
          const asset = assetLookup.get(placedObject.assetId);
          const marker = document.createElement("span");
          marker.className = `placed-asset ${placedObject.assetId}`;
          marker.title = placedObject.name || placedObject.assetId;
          marker.style.background = asset?.color || "#69737a";
          marker.textContent = asset?.glyph || "";
          cell.append(marker);
        }

        cell.addEventListener("click", () => {
          this.onCellClick({ x, y, existing: findObjectsAtCell(level, x, y) });
        });

        grid.append(cell);
      }
    }

    wrap.append(grid);
    this.root.append(wrap);
  }
}
