export class AssetPalette {
  constructor({
    root,
    assetRegistry,
    selectedAssetId,
    onSelect,
    onCreateCategory,
    onImportAsset,
    onCleanCategories,
    onDeleteCategory,
    onDeleteAsset,
  }) {
    this.root = root;
    this.assetRegistry = assetRegistry;
    this.selectedAssetId = selectedAssetId;
    this.onSelect = onSelect;
    this.onCreateCategory = onCreateCategory;
    this.onImportAsset = onImportAsset;
    this.onCleanCategories = onCleanCategories;
    this.onDeleteCategory = onDeleteCategory;
    this.onDeleteAsset = onDeleteAsset;
    this.searchTerm = "";
  }

  render() {
    this.root.innerHTML = "";

    const heading = document.createElement("h2");
    heading.textContent = "Assets";

    const actions = document.createElement("div");
    actions.className = "asset-actions";

    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.textContent = "Import Asset";
    importButton.addEventListener("click", () => this.onImportAsset());

    const categoryButton = document.createElement("button");
    categoryButton.type = "button";
    categoryButton.textContent = "Create Category";
    categoryButton.addEventListener("click", () => this.onCreateCategory());

    const cleanButton = document.createElement("button");
    cleanButton.type = "button";
    cleanButton.className = "subtle-action";
    cleanButton.textContent = "Clean Empty Categories";
    cleanButton.addEventListener("click", () => this.onCleanCategories());

    actions.append(categoryButton, importButton, cleanButton);

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search assets";
    search.className = "asset-search";
    search.value = this.searchTerm;
    search.addEventListener("input", () => {
      this.searchTerm = search.value;
      this.render();
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    });

    const list = document.createElement("div");
    list.className = "asset-list";

    const assets = this.assetRegistry.assets || [];
    const filteredAssets = this.filterAssets(assets);
    const categories = this.assetRegistry.categories || [];
    const unassignedAssets = filteredAssets.filter(
      (asset) =>
        !categories.some(
          (category) => asset.categoryId === category.id || asset.category === category.name,
        ),
    );

    const hasSearch = this.searchTerm.trim().length > 0;

    if (categories.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-message";
      empty.textContent = "No categories yet. Create a category or import assets into a new category.";
      list.append(empty);
    }

    if (categories.length > 0 && hasSearch && filteredAssets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-message";
      empty.textContent = "No assets found.";
      list.append(empty);
    } else {
      categories.forEach((category) => {
        const categoryAssets = filteredAssets.filter(
          (asset) => asset.categoryId === category.id || asset.category === category.name,
        );

        if (hasSearch && categoryAssets.length === 0) {
          return;
        }

        list.append(this.renderCategory(category, categoryAssets));
      });
    }

    if (unassignedAssets.length > 0) {
      const invalid = document.createElement("p");
      invalid.className = "empty-message";
      invalid.textContent = `${unassignedAssets.length} asset${unassignedAssets.length === 1 ? "" : "s"} need a category assignment before they can be used.`;
      list.append(invalid);
    }

    const help = document.createElement("p");
    help.className = "help-text";
    help.textContent =
      "Select an imported asset, then drag it from a category onto the grid or a highlighted area. Use Paint mode to drag-paint repeated 1x1 assets. In Select/Move, drag on the grid to select areas or move placed assets.";

    this.root.append(heading, actions, search, list, help);
  }

  filterAssets(assets) {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return assets;
    }

    return assets.filter((asset) => asset.name.toLowerCase().includes(term));
  }

  renderCategory(category, assets) {
    const section = document.createElement("details");
    section.className = "asset-category";
    section.open = true;

    const summary = document.createElement("summary");
    const categoryName = document.createElement("span");
    categoryName.textContent = `${category.name} (${assets.length})`;
    summary.append(categoryName);
    const deleteCategory = document.createElement("button");
    deleteCategory.type = "button";
    deleteCategory.className = "icon-action category-delete";
    deleteCategory.title = `Delete category ${category.name}`;
    deleteCategory.setAttribute("aria-label", `Delete category ${category.name}`);
    deleteCategory.textContent = "x";
    deleteCategory.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onDeleteCategory(category);
    });
    summary.append(deleteCategory);

    const categoryList = document.createElement("div");
    categoryList.className = "asset-category-list";

    if (assets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "category-empty-message";
      empty.textContent = "No assets in this category yet.";
      categoryList.append(empty);
    } else {
      assets.forEach((asset) => {
        categoryList.append(this.renderAssetButton(asset));
      });
    }

    section.append(summary, categoryList);
    return section;
  }

  renderAssetButton(asset) {
    const button = document.createElement("div");
    button.className = "asset-button";
    button.tabIndex = 0;
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", `Select asset ${asset.name}`);
    button.dataset.assetId = asset.id;
    button.draggable = true;
    button.classList.toggle("is-active", asset.id === this.selectedAssetId);

    const preview = document.createElement("span");
    preview.className = "asset-preview";

    if (asset.src) {
      const image = document.createElement("img");
      image.src = asset.src;
      image.alt = "";
      image.draggable = false;
      preview.append(image);
    } else {
      preview.textContent = "?";
    }

    const label = document.createElement("span");
    label.className = "asset-label";
    label.textContent = asset.name;

    const deleteAsset = document.createElement("button");
    deleteAsset.type = "button";
    deleteAsset.className = "icon-action asset-delete";
    deleteAsset.title = `Delete asset ${asset.name}`;
    deleteAsset.setAttribute("aria-label", `Delete asset ${asset.name}`);
    deleteAsset.textContent = "x";
    deleteAsset.draggable = false;
    deleteAsset.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onDeleteAsset(asset);
    });

    button.append(preview, label, deleteAsset);
    button.addEventListener("click", () => {
      this.selectedAssetId = asset.id;
      this.onSelect(asset);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.selectedAssetId = asset.id;
        this.onSelect(asset);
      }
    });

    button.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-game-dev-kit-asset", asset.id);
      event.dataTransfer.setData("text/plain", asset.id);
    });

    return button;
  }
}
