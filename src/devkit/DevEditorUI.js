export function createEditorLayout(root) {
  root.innerHTML = `
    <div class="editor-shell">
      <header class="topbar">
        <div class="toolbar">
          <div class="level-controls">
            <label>
              Level
              <span class="level-picker" data-role="level-picker">
                <button type="button" class="level-picker-button" data-role="level-picker-button">
                  <span data-role="selected-level-name"></span>
                  <span aria-hidden="true">▼</span>
                </button>
                <span class="level-picker-panel" data-role="level-picker-panel"></span>
              </span>
            </label>
            <button type="button" data-action="create-level">Create New Level</button>
            <button type="button" data-action="rename-level">Rename Level</button>
            <button type="button" data-action="delete-level" class="danger">Delete Level</button>
            <button type="button" data-action="clear" class="danger">Clear Level</button>
          </div>
          <div class="grid-controls" data-role="grid-controls">
            <label>
              Grid
              <select data-role="grid-size">
                <option value="10">10x10</option>
                <option value="20">20x20</option>
                <option value="30">30x30</option>
                <option value="40">40x40</option>
                <option value="50">50x50</option>
                <option value="75">75x75</option>
                <option value="100">100x100</option>
                <option value="150">150x150</option>
                <option value="200">200x200</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <span class="custom-size" data-role="custom-size">
              <label>
                W
                <input data-role="custom-width" type="number" min="1" max="500" />
              </label>
              <label>
                H
                <input data-role="custom-height" type="number" min="1" max="500" />
              </label>
              <button type="button" data-action="apply-custom-size">Apply</button>
            </span>
          </div>
          <div class="toolbar-group">
            <button type="button" data-tool="move" class="is-active" title="Select/Move (Q)">Select/Move</button>
            <button type="button" data-tool="delete" title="Delete (E)">Delete</button>
            <button type="button" data-action="place-selected-asset">Place Selected Asset</button>
          </div>
        </div>
      </header>
      <main class="workspace">
        <aside class="sidebar" data-role="sidebar">
          <button
            type="button"
            class="sidebar-toggle"
            data-action="toggle-sidebar"
            aria-label="Collapse asset panel"
            title="Collapse asset panel"
          >«</button>
          <div class="sidebar-content" data-role="asset-palette"></div>
        </aside>
        <div
          class="sidebar-resizer"
          data-role="sidebar-resizer"
          role="separator"
          aria-label="Resize asset panel"
          aria-orientation="vertical"
        ></div>
        <section class="main-panel">
          <div class="editor-menu-row">
            <div class="title-block">
              <h1>Game Dev Kit Level Editor</h1>
              <p data-role="startup-status"></p>
            </div>
            <nav class="menu-bar" aria-label="Editor menus">
              <details class="menu" data-menu>
                <summary>File</summary>
                <div class="menu-panel file-menu-panel">
                  <button type="button" data-action="choose-project-folder">Choose Project Folder</button>
                  <button type="button" data-action="save">Save</button>
                  <button type="button" data-action="save-as-folder">Save As</button>
                </div>
              </details>
              <details class="menu" data-menu>
                <summary>Edit</summary>
                <div class="menu-panel">
                  <button type="button" data-action="copy-level">Copy Level</button>
                  <button type="button" data-action="paste-level">Paste Level</button>
                  <div class="menu-panel-divider"></div>
                  <button type="button" data-action="copy-selected-assets" title="Ctrl+C">Copy Selected Assets</button>
                  <button type="button" data-action="cut-selected-assets" title="Ctrl+X">Cut Selected Assets</button>
                  <button type="button" data-action="duplicate-selected-assets" title="Ctrl+D">Duplicate Selected Assets</button>
                  <div class="menu-panel-divider"></div>
                  <button type="button" data-action="fill-selected-area">Fill Selected Area</button>
                  <button type="button" data-action="clear-selected-area">Clear Selected Area</button>
                  <div class="menu-panel-divider"></div>
                  <button type="button" data-action="edit-placed-asset-properties">Properties</button>
                </div>
              </details>
              <details class="menu" data-menu data-role="view-menu">
                <summary>View</summary>
                <div class="menu-panel view-menu-panel">
                  <div class="menu-flyout-item" data-role="layer-visibility-flyout">
                    <button
                      type="button"
                      class="menu-flyout-trigger"
                      data-flyout-trigger="layer-visibility"
                      aria-expanded="false"
                    >
                      <span>Layer Visibility</span>
                      <span aria-hidden="true">&rsaquo;</span>
                    </button>
                    <div class="menu-flyout-panel" data-flyout-panel="layer-visibility">
                      <p class="menu-panel-heading">Layer Visibility</p>
                      ${createLayerVisibilityControls()}
                    </div>
                  </div>
                  <div class="menu-flyout-item" data-role="layer-locking-flyout">
                    <button
                      type="button"
                      class="menu-flyout-trigger"
                      data-flyout-trigger="layer-locking"
                      aria-expanded="false"
                    >
                      <span>Layer Locking</span>
                      <span aria-hidden="true">&rsaquo;</span>
                    </button>
                    <div class="menu-flyout-panel" data-flyout-panel="layer-locking">
                      <p class="menu-panel-heading">Layer Locking</p>
                      ${createLayerLockControls()}
                    </div>
                  </div>
                  <div class="menu-panel-divider"></div>
                  <button type="button" data-action="show-all-layers">Show All Layers</button>
                  <button type="button" data-action="unlock-all-layers">Unlock All Layers and Assets</button>
                </div>
              </details>
              <details class="menu is-disabled" data-menu data-role="asset-menu">
                <summary aria-disabled="true">Asset</summary>
                <div class="menu-panel">
                  <button type="button" data-action="placed-asset-properties">Properties</button>
                </div>
              </details>
            </nav>
          </div>
          <div class="status-bar">
            <div class="status-message" data-role="status-message"></div>
            <div class="coordinate-status" data-role="coordinate-status">Hover: - · Selected: -</div>
            <div class="level-summary" data-role="level-summary"></div>
          </div>
          <div class="grid-stage" data-role="grid-stage"></div>
        </section>
      </main>
    </div>
  `;

  return {
    assetPalette: root.querySelector('[data-role="asset-palette"]'),
    assetMenu: root.querySelector('[data-role="asset-menu"]'),
    customHeight: root.querySelector('[data-role="custom-height"]'),
    customSize: root.querySelector('[data-role="custom-size"]'),
    customWidth: root.querySelector('[data-role="custom-width"]'),
    coordinateStatus: root.querySelector('[data-role="coordinate-status"]'),
    copySelectedAssetsButton: root.querySelector('[data-action="copy-selected-assets"]'),
    cutSelectedAssetsButton: root.querySelector('[data-action="cut-selected-assets"]'),
    duplicateSelectedAssetsButton: root.querySelector('[data-action="duplicate-selected-assets"]'),
    editPropertiesButton: root.querySelector('[data-action="edit-placed-asset-properties"]'),
    fillSelectedAreaButton: root.querySelector('[data-action="fill-selected-area"]'),
    clearSelectedAreaButton: root.querySelector('[data-action="clear-selected-area"]'),
    gridSize: root.querySelector('[data-role="grid-size"]'),
    gridStage: root.querySelector('[data-role="grid-stage"]'),
    layerVisibilityInputs: Array.from(
      root.querySelectorAll('[data-role="layer-visibility-toggle"]'),
    ),
    layerLockInputs: Array.from(
      root.querySelectorAll('[data-role="layer-lock-toggle"]'),
    ),
    levelPicker: root.querySelector('[data-role="level-picker"]'),
    levelPickerButton: root.querySelector('[data-role="level-picker-button"]'),
    levelPickerPanel: root.querySelector('[data-role="level-picker-panel"]'),
    levelSummary: root.querySelector('[data-role="level-summary"]'),
    placeSelectedAssetButton: root.querySelector('[data-action="place-selected-asset"]'),
    selectedLevelName: root.querySelector('[data-role="selected-level-name"]'),
    sidebar: root.querySelector('[data-role="sidebar"]'),
    sidebarResizer: root.querySelector('[data-role="sidebar-resizer"]'),
    sidebarToggle: root.querySelector('[data-action="toggle-sidebar"]'),
    startupStatus: root.querySelector('[data-role="startup-status"]'),
    statusMessage: root.querySelector('[data-role="status-message"]'),
    workspace: root.querySelector(".workspace"),
  };
}

function createLayerVisibilityControls() {
  return getKnownLayerNames().map(
    (layerName) => `
      <label class="layer-control-option">
        <input
          type="checkbox"
          data-role="layer-visibility-toggle"
          data-layer="${layerName}"
          checked
        />
        <span>${layerName}</span>
      </label>
    `,
  ).join("");
}

function createLayerLockControls() {
  return getKnownLayerNames().map(
    (layerName) => `
      <label class="layer-control-option">
        <input
          type="checkbox"
          data-role="layer-lock-toggle"
          data-layer="${layerName}"
        />
        <span>${layerName} locked</span>
      </label>
    `,
  ).join("");
}

function getKnownLayerNames() {
  return [
    "terrain",
    "decorations",
    "objects",
    "collisions",
    "spawns",
    "items",
    "npcs",
    "enemies",
    "triggers",
    "overlay",
  ];
}
