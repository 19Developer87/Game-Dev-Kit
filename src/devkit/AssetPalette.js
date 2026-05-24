export class AssetPalette {
  constructor({ root, assets, selectedAssetId, onSelect }) {
    this.root = root;
    this.assets = assets;
    this.selectedAssetId = selectedAssetId;
    this.onSelect = onSelect;
  }

  render() {
    this.root.innerHTML = "";

    const heading = document.createElement("h2");
    heading.textContent = "Assets";

    const list = document.createElement("div");
    list.className = "asset-list";

    this.assets.forEach((asset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "asset-button";
      button.dataset.assetId = asset.id;
      button.classList.toggle("is-active", asset.id === this.selectedAssetId);

      const chip = document.createElement("span");
      chip.className = "asset-chip";
      chip.style.background = asset.color;
      chip.textContent = asset.glyph;

      const label = document.createElement("span");
      label.textContent = asset.name;

      button.append(chip, label);
      button.addEventListener("click", () => {
        this.selectedAssetId = asset.id;
        this.onSelect(asset);
      });

      list.append(button);
    });

    const help = document.createElement("p");
    help.className = "help-text";
    help.textContent = "Select an asset, click the grid to place or replace it, or switch to Delete to clear cells.";

    this.root.append(heading, list, help);
  }
}
