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
                <option value="custom">Custom</option>
              </select>
            </label>
            <span class="custom-size" data-role="custom-size">
              <label>
                W
                <input data-role="custom-width" type="number" min="1" max="100" />
              </label>
              <label>
                H
                <input data-role="custom-height" type="number" min="1" max="100" />
              </label>
              <button type="button" data-action="apply-custom-size">Apply</button>
            </span>
          </div>
          <div class="toolbar-group">
            <button type="button" data-tool="paint" class="is-active">Paint</button>
            <button type="button" data-tool="delete">Delete</button>
          </div>
        </div>
      </header>
      <main class="workspace">
        <aside class="sidebar" data-role="asset-palette"></aside>
        <section class="main-panel">
          <div class="editor-menu-row">
            <div class="title-block">
              <h1>Game Dev Kit Level Editor</h1>
              <p data-role="startup-status"></p>
            </div>
            <nav class="menu-bar" aria-label="Editor menus">
              <details class="menu" data-menu>
                <summary>File</summary>
                <div class="menu-panel">
                  <button type="button" data-action="save">Save</button>
                  <button type="button" data-action="choose-project-folder">Choose Project Folder</button>
                  <button type="button" data-action="save-as-folder">Save As</button>
                </div>
              </details>
              <details class="menu" data-menu>
                <summary>Edit</summary>
                <div class="menu-panel">
                  <button type="button" data-action="copy-level">Copy Level</button>
                  <button type="button" data-action="paste-level">Paste Level</button>
                </div>
              </details>
            </nav>
          </div>
          <div class="status-bar">
            <div class="status-message" data-role="status-message"></div>
            <div class="level-summary" data-role="level-summary"></div>
          </div>
          <div class="grid-stage" data-role="grid-stage"></div>
        </section>
      </main>
    </div>
  `;

  return {
    assetPalette: root.querySelector('[data-role="asset-palette"]'),
    customHeight: root.querySelector('[data-role="custom-height"]'),
    customSize: root.querySelector('[data-role="custom-size"]'),
    customWidth: root.querySelector('[data-role="custom-width"]'),
    gridSize: root.querySelector('[data-role="grid-size"]'),
    gridStage: root.querySelector('[data-role="grid-stage"]'),
    levelPicker: root.querySelector('[data-role="level-picker"]'),
    levelPickerButton: root.querySelector('[data-role="level-picker-button"]'),
    levelPickerPanel: root.querySelector('[data-role="level-picker-panel"]'),
    levelSummary: root.querySelector('[data-role="level-summary"]'),
    selectedLevelName: root.querySelector('[data-role="selected-level-name"]'),
    startupStatus: root.querySelector('[data-role="startup-status"]'),
    statusMessage: root.querySelector('[data-role="status-message"]'),
  };
}
