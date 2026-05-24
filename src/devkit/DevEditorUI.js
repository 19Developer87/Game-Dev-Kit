export function createEditorLayout(root) {
  root.innerHTML = `
    <div class="editor-shell">
      <header class="topbar">
        <div class="title-block">
          <h1>Game Dev Kit Level Editor</h1>
          <p data-role="startup-status"></p>
        </div>
        <div class="toolbar">
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
          <div class="toolbar-group">
            <button type="button" data-action="save">Save</button>
            <button type="button" data-action="clear" class="danger">Clear Level</button>
            <button type="button" data-action="export-level">Export Level JSON</button>
            <button type="button" data-action="export-project">Export Project JSON</button>
            <button type="button" data-action="save-level-as">Save JSON As...</button>
            <button type="button" data-action="save-project-as">Save Full Project As...</button>
            <button type="button" data-action="copy-level-json">Copy JSON to Clipboard</button>
          </div>
        </div>
      </header>
      <main class="workspace">
        <aside class="sidebar" data-role="asset-palette"></aside>
        <section class="main-panel">
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
    levelSummary: root.querySelector('[data-role="level-summary"]'),
    startupStatus: root.querySelector('[data-role="startup-status"]'),
    statusMessage: root.querySelector('[data-role="status-message"]'),
  };
}
