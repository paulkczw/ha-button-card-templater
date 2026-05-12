/**
 * Button Card Templater Panel
 * Home Assistant custom panel for editing and testing button-card templates.
 *
 * Features:
 * - YAML editor for button_card_templates
 * - Template inheritance resolution (mergeDeep matching button-card internals)
 * - Live preview using actual button-card element
 * - Entity picker + state simulation
 * - Variables editor
 * - Import from dashboard / Export YAML
 */
(function () {
  "use strict";

  // ============================================================
  // CDN: js-yaml for YAML parsing
  // ============================================================
  const JSYAML_CDN =
    "https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js";

  let _jsyamlPromise = null;
  function loadJsYaml() {
    if (_jsyamlPromise) return _jsyamlPromise;
    _jsyamlPromise = new Promise((resolve, reject) => {
      if (window.jsyaml) {
        resolve(window.jsyaml);
        return;
      }
      const s = document.createElement("script");
      s.src = JSYAML_CDN;
      s.onload = () => resolve(window.jsyaml);
      s.onerror = () => reject(new Error("Failed to load js-yaml from CDN"));
      document.head.appendChild(s);
    });
    return _jsyamlPromise;
  }

  // ============================================================
  // Utility: Deep merge (matches button-card src/helpers.ts)
  // ============================================================
  function mergeDeep(/* ...objects */) {
    const isObject = (obj) => obj && typeof obj === "object";
    const args = Array.from(arguments);
    return args.reduce((prev, obj) => {
      if (!obj) return prev;
      Object.keys(obj).forEach((key) => {
        const pVal = prev[key];
        const oVal = obj[key];
        if (Array.isArray(pVal) && Array.isArray(oVal)) {
          prev[key] = pVal.concat(oVal);
        } else if (isObject(pVal) && isObject(oVal)) {
          prev[key] = mergeDeep(pVal, oVal);
        } else {
          prev[key] = oVal;
        }
      });
      return prev;
    }, {});
  }

  function mergeStatesById(intoStates, fromStates) {
    var result = [];
    if (intoStates) {
      intoStates.forEach(function (intoState) {
        var localState = Object.assign({}, intoState);
        if (fromStates) {
          fromStates.forEach(function (fromState) {
            if (fromState.id && intoState.id && fromState.id == intoState.id) {
              localState = mergeDeep(localState, fromState);
            }
          });
        }
        result.push(localState);
      });
    }
    if (fromStates) {
      result = result.concat(
        fromStates.filter(function (x) {
          return !intoStates
            ? true
            : !intoStates.find(function (y) {
                return y.id && x.id ? y.id == x.id : false;
              });
        })
      );
    }
    return result;
  }

  function deepClone(obj) {
    if (obj === undefined || obj === null) return obj;
    return JSON.parse(JSON.stringify(obj));
  }

  // ============================================================
  // Template Resolution (matches button-card _configFromLLTemplates)
  // ============================================================
  function resolveTemplate(templateName, allTemplates, visited) {
    visited = visited || [];
    if (visited.indexOf(templateName) !== -1) {
      throw new Error(
        "Circular template reference: " + visited.join(" -> ") + " -> " + templateName
      );
    }
    var newVisited = visited.concat([templateName]);

    var template = allTemplates[templateName];
    if (!template) {
      throw new Error("Template '" + templateName + "' not found");
    }

    var config = deepClone(template);
    var tpl = config.template;

    if (!tpl) {
      return config;
    }

    var result = {};
    var mergedStateConfig;
    var tpls = Array.isArray(tpl) ? tpl : [tpl];

    tpls.forEach(function (parentName) {
      if (!allTemplates[parentName]) {
        throw new Error(
          "Parent template '" +
            parentName +
            "' not found (referenced by '" +
            templateName +
            "')"
        );
      }
      var resolved = resolveTemplate(parentName, allTemplates, newVisited);
      result = mergeDeep(result, resolved);
      mergedStateConfig = mergeStatesById(mergedStateConfig, resolved.state);
    });

    result = mergeDeep(result, config);
    result.state = mergeStatesById(mergedStateConfig, config.state);
    delete result.template;

    return result;
  }

  // ============================================================
  // Default example YAML
  // ============================================================
  var DEFAULT_YAML =
    'button_card_templates:\n' +
    '  base:\n' +
    '    styles:\n' +
    '      card:\n' +
    '        - border-radius: 16px\n' +
    '        - padding: 12px\n' +
    '        - box-shadow: none\n' +
    '      name:\n' +
    '        - font-size: 13px\n' +
    '      icon:\n' +
    '        - width: 24px\n' +
    '  my_switch:\n' +
    '    template: base\n' +
    '    variables:\n' +
    '      color_on: var(--primary-color)\n' +
    '      color_off: var(--disabled-color)\n' +
    '    show_state: true\n' +
    '    show_name: true\n' +
    '    tap_action:\n' +
    '      action: toggle\n' +
    '    state:\n' +
    '      - value: "on"\n' +
    '        icon: mdi:lightbulb\n' +
    '        styles:\n' +
    '          card:\n' +
    '            - background-color: "[[[ return variables.color_on ]]]"\n' +
    '          icon:\n' +
    '            - color: white\n' +
    '      - value: "off"\n' +
    '        icon: mdi:lightbulb-outline\n' +
    '        styles:\n' +
    '          card:\n' +
    '            - background-color: "[[[ return variables.color_off ]]]"\n';

  // ============================================================
  // CSS Styles
  // ============================================================
  function getStyles() {
    return (
      ":host {\n" +
      "  display: block;\n" +
      "  height: 100vh;\n" +
      "  background: var(--primary-background-color, #fafafa);\n" +
      "  color: var(--primary-text-color, #212121);\n" +
      "  font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);\n" +
      "  --bct-accent: var(--primary-color, #03a9f4);\n" +
      "  --bct-surface: var(--card-background-color, #fff);\n" +
      "  --bct-border: var(--divider-color, #e0e0e0);\n" +
      "  --bct-text2: var(--secondary-text-color, #727272);\n" +
      "  --bct-error: var(--error-color, #db4437);\n" +
      "  --bct-radius: 12px;\n" +
      "}\n" +
      ".container {\n" +
      "  display: flex;\n" +
      "  flex-direction: column;\n" +
      "  height: 100%;\n" +
      "  overflow: hidden;\n" +
      "}\n" +
      /* ---- Toolbar ---- */
      ".toolbar {\n" +
      "  display: flex;\n" +
      "  align-items: center;\n" +
      "  justify-content: space-between;\n" +
      "  padding: 0 16px;\n" +
      "  height: 56px;\n" +
      "  min-height: 56px;\n" +
      "  background: var(--bct-surface);\n" +
      "  border-bottom: 1px solid var(--bct-border);\n" +
      "  gap: 12px;\n" +
      "  flex-wrap: wrap;\n" +
      "}\n" +
      ".toolbar-left {\n" +
      "  display: flex;\n" +
      "  align-items: center;\n" +
      "  gap: 16px;\n" +
      "  flex: 1;\n" +
      "  min-width: 0;\n" +
      "}\n" +
      ".toolbar-right {\n" +
      "  display: flex;\n" +
      "  align-items: center;\n" +
      "  gap: 8px;\n" +
      "}\n" +
      ".title {\n" +
      "  font-size: 20px;\n" +
      "  font-weight: 500;\n" +
      "  white-space: nowrap;\n" +
      "}\n" +
      ".template-select {\n" +
      "  padding: 6px 12px;\n" +
      "  border: 1px solid var(--bct-border);\n" +
      "  border-radius: 8px;\n" +
      "  background: var(--bct-surface);\n" +
      "  color: var(--primary-text-color);\n" +
      "  font-size: 14px;\n" +
      "  min-width: 180px;\n" +
      "  cursor: pointer;\n" +
      "}\n" +
      ".toolbar-btn {\n" +
      "  padding: 6px 16px;\n" +
      "  border: 1px solid var(--bct-border);\n" +
      "  border-radius: 8px;\n" +
      "  background: var(--bct-surface);\n" +
      "  color: var(--primary-text-color);\n" +
      "  font-size: 13px;\n" +
      "  cursor: pointer;\n" +
      "  transition: background 0.15s;\n" +
      "  white-space: nowrap;\n" +
      "}\n" +
      ".toolbar-btn:hover {\n" +
      "  background: var(--bct-border);\n" +
      "}\n" +
      ".toolbar-btn.primary {\n" +
      "  background: var(--bct-accent);\n" +
      "  color: #fff;\n" +
      "  border-color: var(--bct-accent);\n" +
      "}\n" +
      /* ---- Main Layout ---- */
      ".main {\n" +
      "  display: flex;\n" +
      "  flex: 1;\n" +
      "  overflow: hidden;\n" +
      "}\n" +
      ".editor-pane {\n" +
      "  flex: 1;\n" +
      "  display: flex;\n" +
      "  flex-direction: column;\n" +
      "  border-right: 1px solid var(--bct-border);\n" +
      "  min-width: 0;\n" +
      "}\n" +
      ".preview-pane {\n" +
      "  flex: 1;\n" +
      "  display: flex;\n" +
      "  flex-direction: column;\n" +
      "  overflow-y: auto;\n" +
      "  min-width: 0;\n" +
      "}\n" +
      ".pane-header {\n" +
      "  font-size: 12px;\n" +
      "  font-weight: 600;\n" +
      "  text-transform: uppercase;\n" +
      "  letter-spacing: 0.5px;\n" +
      "  color: var(--bct-text2);\n" +
      "  padding: 12px 16px 4px;\n" +
      "}\n" +
      ".pane-header.clickable {\n" +
      "  cursor: pointer;\n" +
      "  user-select: none;\n" +
      "}\n" +
      /* ---- Editor ---- */
      ".editor-wrapper {\n" +
      "  flex: 1;\n" +
      "  display: flex;\n" +
      "  overflow: hidden;\n" +
      "  padding: 0 8px 8px;\n" +
      "}\n" +
      ".editor-wrapper ha-code-editor {\n" +
      "  flex: 1;\n" +
      "  --code-mirror-max-height: none;\n" +
      "}\n" +
      ".yaml-textarea {\n" +
      "  flex: 1;\n" +
      "  width: 100%;\n" +
      "  border: 1px solid var(--bct-border);\n" +
      "  border-radius: var(--bct-radius);\n" +
      "  background: var(--bct-surface);\n" +
      "  color: var(--primary-text-color);\n" +
      "  font-family: 'Fira Code', 'Source Code Pro', 'Consolas', monospace;\n" +
      "  font-size: 13px;\n" +
      "  line-height: 1.5;\n" +
      "  padding: 12px;\n" +
      "  resize: none;\n" +
      "  tab-size: 2;\n" +
      "  outline: none;\n" +
      "}\n" +
      ".yaml-textarea:focus {\n" +
      "  border-color: var(--bct-accent);\n" +
      "}\n" +
      /* ---- Controls ---- */
      ".controls-section {\n" +
      "  padding: 0 16px 8px;\n" +
      "  border-bottom: 1px solid var(--bct-border);\n" +
      "}\n" +
      ".control-group {\n" +
      "  margin-bottom: 12px;\n" +
      "}\n" +
      ".control-group > label {\n" +
      "  display: block;\n" +
      "  font-size: 12px;\n" +
      "  font-weight: 500;\n" +
      "  color: var(--bct-text2);\n" +
      "  margin-bottom: 4px;\n" +
      "}\n" +
      ".state-buttons {\n" +
      "  display: flex;\n" +
      "  gap: 6px;\n" +
      "  flex-wrap: wrap;\n" +
      "  align-items: center;\n" +
      "}\n" +
      ".state-btn {\n" +
      "  padding: 4px 12px;\n" +
      "  border: 1px solid var(--bct-border);\n" +
      "  border-radius: 16px;\n" +
      "  background: var(--bct-surface);\n" +
      "  color: var(--primary-text-color);\n" +
      "  font-size: 12px;\n" +
      "  cursor: pointer;\n" +
      "  transition: all 0.15s;\n" +
      "}\n" +
      ".state-btn:hover {\n" +
      "  background: var(--bct-border);\n" +
      "}\n" +
      ".state-btn.active {\n" +
      "  background: var(--bct-accent);\n" +
      "  color: #fff;\n" +
      "  border-color: var(--bct-accent);\n" +
      "}\n" +
      ".custom-state-input {\n" +
      "  padding: 4px 10px;\n" +
      "  border: 1px solid var(--bct-border);\n" +
      "  border-radius: 16px;\n" +
      "  background: var(--bct-surface);\n" +
      "  color: var(--primary-text-color);\n" +
      "  font-size: 12px;\n" +
      "  width: 100px;\n" +
      "  outline: none;\n" +
      "}\n" +
      ".custom-state-input:focus {\n" +
      "  border-color: var(--bct-accent);\n" +
      "}\n" +
      "#entity-picker-wrapper ha-entity-picker {\n" +
      "  width: 100%;\n" +
      "}\n" +
      ".entity-input {\n" +
      "  width: 100%;\n" +
      "  padding: 8px 12px;\n" +
      "  border: 1px solid var(--bct-border);\n" +
      "  border-radius: 8px;\n" +
      "  background: var(--bct-surface);\n" +
      "  color: var(--primary-text-color);\n" +
      "  font-size: 14px;\n" +
      "  outline: none;\n" +
      "  box-sizing: border-box;\n" +
      "}\n" +
      ".entity-input:focus {\n" +
      "  border-color: var(--bct-accent);\n" +
      "}\n" +
      /* ---- Variables ---- */
      ".var-row {\n" +
      "  display: flex;\n" +
      "  align-items: center;\n" +
      "  gap: 8px;\n" +
      "  margin-bottom: 6px;\n" +
      "}\n" +
      ".var-key {\n" +
      "  font-size: 12px;\n" +
      "  font-family: monospace;\n" +
      "  color: var(--bct-text2);\n" +
      "  min-width: 100px;\n" +
      "  text-align: right;\n" +
      "}\n" +
      ".var-value {\n" +
      "  flex: 1;\n" +
      "  padding: 4px 8px;\n" +
      "  border: 1px solid var(--bct-border);\n" +
      "  border-radius: 6px;\n" +
      "  background: var(--bct-surface);\n" +
      "  color: var(--primary-text-color);\n" +
      "  font-family: monospace;\n" +
      "  font-size: 12px;\n" +
      "  outline: none;\n" +
      "}\n" +
      ".var-value:focus {\n" +
      "  border-color: var(--bct-accent);\n" +
      "}\n" +
      /* ---- Preview ---- */
      ".preview-section {\n" +
      "  flex: 1;\n" +
      "  display: flex;\n" +
      "  flex-direction: column;\n" +
      "  min-height: 200px;\n" +
      "}\n" +
      ".preview-container {\n" +
      "  flex: 1;\n" +
      "  display: flex;\n" +
      "  align-items: flex-start;\n" +
      "  justify-content: center;\n" +
      "  padding: 24px 16px;\n" +
      "  overflow: auto;\n" +
      "}\n" +
      ".preview-container > * {\n" +
      "  max-width: 300px;\n" +
      "  width: 100%;\n" +
      "}\n" +
      ".preview-placeholder {\n" +
      "  color: var(--bct-text2);\n" +
      "  font-size: 14px;\n" +
      "  text-align: center;\n" +
      "  padding: 40px 0;\n" +
      "}\n" +
      ".preview-warning {\n" +
      "  color: var(--warning-color, #ff9800);\n" +
      "  font-size: 13px;\n" +
      "  padding: 8px 16px;\n" +
      "  text-align: center;\n" +
      "}\n" +
      /* ---- Resolved config ---- */
      ".resolved-section {\n" +
      "  border-top: 1px solid var(--bct-border);\n" +
      "}\n" +
      ".resolved-section details {\n" +
      "  padding-bottom: 8px;\n" +
      "}\n" +
      ".resolved-section summary {\n" +
      "  list-style: none;\n" +
      "  cursor: pointer;\n" +
      "}\n" +
      ".resolved-section summary::-webkit-details-marker { display: none; }\n" +
      ".resolved-section summary::before {\n" +
      '  content: "\\25B6";\n' +
      "  display: inline-block;\n" +
      "  margin-right: 6px;\n" +
      "  font-size: 10px;\n" +
      "  transition: transform 0.2s;\n" +
      "}\n" +
      ".resolved-section details[open] summary::before {\n" +
      "  transform: rotate(90deg);\n" +
      "}\n" +
      ".resolved-config {\n" +
      "  margin: 0 16px 8px;\n" +
      "  padding: 12px;\n" +
      "  background: var(--bct-surface);\n" +
      "  border: 1px solid var(--bct-border);\n" +
      "  border-radius: var(--bct-radius);\n" +
      "  font-family: monospace;\n" +
      "  font-size: 12px;\n" +
      "  line-height: 1.5;\n" +
      "  overflow-x: auto;\n" +
      "  white-space: pre-wrap;\n" +
      "  max-height: 300px;\n" +
      "  overflow-y: auto;\n" +
      "}\n" +
      /* ---- Error bar ---- */
      ".error-bar {\n" +
      "  padding: 8px 16px;\n" +
      "  background: var(--bct-error);\n" +
      "  color: #fff;\n" +
      "  font-size: 13px;\n" +
      "  font-family: monospace;\n" +
      "  white-space: pre-wrap;\n" +
      "  max-height: 80px;\n" +
      "  overflow-y: auto;\n" +
      "}\n" +
      /* ---- Import Modal ---- */
      ".modal-overlay {\n" +
      "  position: fixed;\n" +
      "  top: 0; left: 0; right: 0; bottom: 0;\n" +
      "  background: rgba(0,0,0,0.5);\n" +
      "  display: flex;\n" +
      "  align-items: center;\n" +
      "  justify-content: center;\n" +
      "  z-index: 1000;\n" +
      "}\n" +
      ".modal {\n" +
      "  background: var(--bct-surface);\n" +
      "  border-radius: var(--bct-radius);\n" +
      "  padding: 24px;\n" +
      "  min-width: 350px;\n" +
      "  max-width: 500px;\n" +
      "  box-shadow: 0 8px 32px rgba(0,0,0,0.3);\n" +
      "}\n" +
      ".modal h3 {\n" +
      "  margin: 0 0 16px;\n" +
      "  font-size: 18px;\n" +
      "}\n" +
      ".modal-select {\n" +
      "  width: 100%;\n" +
      "  padding: 8px 12px;\n" +
      "  border: 1px solid var(--bct-border);\n" +
      "  border-radius: 8px;\n" +
      "  background: var(--bct-surface);\n" +
      "  color: var(--primary-text-color);\n" +
      "  font-size: 14px;\n" +
      "  margin-bottom: 16px;\n" +
      "}\n" +
      ".modal-buttons {\n" +
      "  display: flex;\n" +
      "  justify-content: flex-end;\n" +
      "  gap: 8px;\n" +
      "}\n"
    );
  }

  // ============================================================
  // Panel Custom Element (class-based, required for Custom Elements v1)
  // ============================================================
  class ButtonCardTemplaterPanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._narrow = false;
      this._panel = null;
      this._jsyaml = null;
      this._templates = {};
      this._selectedTemplate = "";
      this._selectedEntity = "";
      this._stateOverride = "";
      this._variableOverrides = {};
      this._error = null;
      this._debounceTimer = null;
      this._initialized = false;
      this._cardEl = null;
      this._editor = null; // { element, getValue, setValue }
      this._sourceDashboard = null; // url_path of imported dashboard (null = default)
    }

    // ---- Property: hass (set by HA frontend) ----
    set hass(hass) {
      this._hass = hass;
      var picker = this.shadowRoot.querySelector("ha-entity-picker");
      if (picker) picker.hass = hass;
      if (this._cardEl && hass) {
        this._cardEl.hass = this._buildPreviewHass();
      }
    }

    set narrow(v) {
      this._narrow = v;
    }

    set panel(v) {
      this._panel = v;
    }

    // ---- Lifecycle ----
    connectedCallback() {
      var self = this;
      loadJsYaml()
        .then(function (jsyaml) {
          self._jsyaml = jsyaml;
          self._buildUI();
          self._initialized = true;
          self._setEditorValue(DEFAULT_YAML);
          self._parseAndUpdate();
        })
        .catch(function (err) {
          self.shadowRoot.innerHTML =
            '<div style="padding:32px;color:red;">Error loading dependencies: ' +
            err.message +
            "</div>";
        });
    }

    // ---- Build UI ----
    _buildUI() {
      var shadow = this.shadowRoot;
      shadow.innerHTML = "";

      var style = document.createElement("style");
      style.textContent = getStyles();
      shadow.appendChild(style);

      var container = document.createElement("div");
      container.className = "container";
      container.innerHTML =
        '<div class="toolbar">' +
        '  <div class="toolbar-left">' +
        '    <span class="title">Button Card Templater</span>' +
        '    <select id="template-select" class="template-select">' +
        '      <option value="">-- Select Template --</option>' +
        "    </select>" +
        "  </div>" +
        '  <div class="toolbar-right">' +
        '    <button id="btn-import" class="toolbar-btn">Import</button>' +
        '    <button id="btn-save" class="toolbar-btn primary">Save to Dashboard</button>' +
        '    <button id="btn-export" class="toolbar-btn">Export</button>' +
        '    <button id="btn-copy" class="toolbar-btn">Copy</button>' +
        "  </div>" +
        "</div>" +
        '<div class="main">' +
        '  <div class="editor-pane">' +
        '    <div class="pane-header">Templates YAML</div>' +
        '    <div class="editor-wrapper" id="editor-wrapper"></div>' +
        "  </div>" +
        '  <div class="preview-pane">' +
        '    <div class="controls-section">' +
        '      <div class="pane-header">Controls</div>' +
        '      <div class="control-group">' +
        "        <label>Entity</label>" +
        '        <div id="entity-picker-wrapper"></div>' +
        "      </div>" +
        '      <div class="control-group">' +
        "        <label>State Override</label>" +
        '        <div class="state-buttons" id="state-buttons">' +
        '          <button class="state-btn active" data-state="">Auto</button>' +
        '          <button class="state-btn" data-state="on">on</button>' +
        '          <button class="state-btn" data-state="off">off</button>' +
        '          <button class="state-btn" data-state="unavailable">unavailable</button>' +
        '          <input type="text" id="custom-state" placeholder="custom..." class="custom-state-input">' +
        "        </div>" +
        "      </div>" +
        '      <div class="control-group" id="variables-section" style="display:none">' +
        "        <label>Variables</label>" +
        '        <div id="variables-editor"></div>' +
        "      </div>" +
        "    </div>" +
        '    <div class="preview-section">' +
        '      <div class="pane-header">Preview</div>' +
        '      <div id="preview-container" class="preview-container">' +
        '        <div class="preview-placeholder">Select a template to preview</div>' +
        "      </div>" +
        "    </div>" +
        '    <div class="resolved-section">' +
        "      <details>" +
        '        <summary class="pane-header clickable">Resolved Config</summary>' +
        '        <pre id="resolved-config" class="resolved-config">Select a template</pre>' +
        "      </details>" +
        "    </div>" +
        "  </div>" +
        "</div>" +
        '<div id="error-bar" class="error-bar" style="display:none"></div>';
      shadow.appendChild(container);

      this._setupEditor();
      this._setupEntityPicker();
      this._attachEventListeners();
    }

    // ---- Setup Code Editor ----
    _setupEditor() {
      var wrapper = this.shadowRoot.getElementById("editor-wrapper");
      var self = this;

      // Try ha-code-editor first (HA's built-in CodeMirror wrapper)
      if (customElements.get("ha-code-editor")) {
        var haCE = document.createElement("ha-code-editor");
        haCE.mode = "yaml";
        haCE.autofocus = true;
        haCE.autocompleteEntities = false;
        haCE.addEventListener("value-changed", function (e) {
          self._onYamlChange(e.detail.value);
        });
        wrapper.appendChild(haCE);
        this._editor = {
          element: haCE,
          getValue: function () {
            return haCE.value;
          },
          setValue: function (v) {
            haCE.value = v;
          },
        };
      } else {
        // Fallback: styled textarea
        var ta = document.createElement("textarea");
        ta.className = "yaml-textarea";
        ta.spellcheck = false;
        ta.placeholder = "Paste your button_card_templates YAML here...";
        ta.addEventListener("keydown", function (e) {
          if (e.key === "Tab") {
            e.preventDefault();
            var start = ta.selectionStart;
            var end = ta.selectionEnd;
            ta.value =
              ta.value.substring(0, start) + "  " + ta.value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + 2;
            self._onYamlChange(ta.value);
          }
        });
        ta.addEventListener("input", function () {
          self._onYamlChange(ta.value);
        });
        wrapper.appendChild(ta);
        this._editor = {
          element: ta,
          getValue: function () {
            return ta.value;
          },
          setValue: function (v) {
            ta.value = v;
          },
        };
      }
    }

    // ---- Setup Entity Picker ----
    _setupEntityPicker() {
      var wrapper = this.shadowRoot.getElementById("entity-picker-wrapper");
      var self = this;

      if (customElements.get("ha-entity-picker")) {
        var picker = document.createElement("ha-entity-picker");
        picker.hass = this._hass;
        picker.allowCustomEntity = true;
        picker.addEventListener("value-changed", function (e) {
          self._selectedEntity = e.detail.value || "";
          self._scheduleUpdate();
        });
        wrapper.appendChild(picker);
      } else {
        // Fallback: text input
        var input = document.createElement("input");
        input.type = "text";
        input.className = "entity-input";
        input.placeholder = "light.living_room";
        input.addEventListener("input", function () {
          self._selectedEntity = input.value;
          self._scheduleUpdate();
        });
        wrapper.appendChild(input);
      }
    }

    // ---- Attach Event Listeners ----
    _attachEventListeners() {
      var self = this;

      this.shadowRoot
        .getElementById("template-select")
        .addEventListener("change", function (e) {
          self._selectedTemplate = e.target.value;
          self._variableOverrides = {};
          self._updateVariablesEditor();
          self._scheduleUpdate();
        });

      this.shadowRoot
        .getElementById("state-buttons")
        .addEventListener("click", function (e) {
          if (!e.target.classList.contains("state-btn")) return;
          self.shadowRoot
            .querySelectorAll(".state-btn")
            .forEach(function (btn) {
              btn.classList.remove("active");
            });
          e.target.classList.add("active");
          self._stateOverride = e.target.getAttribute("data-state");
          self.shadowRoot.getElementById("custom-state").value = "";
          self._scheduleUpdate();
        });

      this.shadowRoot
        .getElementById("custom-state")
        .addEventListener("input", function (e) {
          if (e.target.value) {
            self.shadowRoot
              .querySelectorAll(".state-btn")
              .forEach(function (btn) {
                btn.classList.remove("active");
              });
            self._stateOverride = e.target.value;
            self._scheduleUpdate();
          }
        });

      this.shadowRoot
        .getElementById("btn-import")
        .addEventListener("click", function () {
          self._showImportModal();
        });

      this.shadowRoot
        .getElementById("btn-save")
        .addEventListener("click", function () {
          self._showSaveModal();
        });

      this.shadowRoot
        .getElementById("btn-export")
        .addEventListener("click", function () {
          self._exportYaml();
        });

      this.shadowRoot
        .getElementById("btn-copy")
        .addEventListener("click", function () {
          self._copyToClipboard();
        });
    }

    // ---- Editor helpers ----
    _setEditorValue(value) {
      if (this._editor) this._editor.setValue(value);
    }

    _getEditorValue() {
      return this._editor ? this._editor.getValue() : "";
    }

    // ---- YAML Changed (triggers debounced update) ----
    _onYamlChange(yaml) {
      this._scheduleUpdate();
    }

    _scheduleUpdate() {
      var self = this;
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(function () {
        self._parseAndUpdate();
      }, 400);
    }

    // ---- Parse YAML and Update Everything ----
    _parseAndUpdate() {
      if (!this._jsyaml || !this._initialized) return;

      var yaml = this._getEditorValue();
      this._hideError();

      try {
        var parsed = this._jsyaml.load(yaml);
        if (!parsed) {
          this._templates = {};
          this._updateTemplateSelector();
          this._updatePreview();
          return;
        }

        // Support both { button_card_templates: {...} } and flat { name: {...} }
        var templates = parsed.button_card_templates || parsed;

        if (typeof templates !== "object" || Array.isArray(templates)) {
          throw new Error(
            "Expected an object with template definitions. Use the format:\nbutton_card_templates:\n  template_name:\n    ..."
          );
        }

        this._templates = templates;
        this._updateTemplateSelector();
        this._updatePreview();
      } catch (e) {
        this._showError(e.message);
      }
    }

    // ---- Update Template Selector Dropdown ----
    _updateTemplateSelector() {
      var select = this.shadowRoot.getElementById("template-select");
      var current = this._selectedTemplate;
      var names = Object.keys(this._templates);

      select.innerHTML =
        '<option value="">-- Select Template (' + names.length + ") --</option>";
      names.forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        if (name === current) opt.selected = true;
        select.appendChild(opt);
      });

      if (!current || names.indexOf(current) === -1) {
        if (names.length > 0) {
          this._selectedTemplate = names[0];
          select.value = names[0];
        } else {
          this._selectedTemplate = "";
        }
      }

      this._updateVariablesEditor();
    }

    // ---- Update Variables Editor ----
    _updateVariablesEditor() {
      var section = this.shadowRoot.getElementById("variables-section");
      var editor = this.shadowRoot.getElementById("variables-editor");
      var self = this;

      if (!this._selectedTemplate || !this._templates[this._selectedTemplate]) {
        section.style.display = "none";
        return;
      }

      var resolved;
      try {
        resolved = resolveTemplate(this._selectedTemplate, this._templates);
      } catch (e) {
        section.style.display = "none";
        return;
      }

      var vars = resolved.variables;
      if (!vars || Object.keys(vars).length === 0) {
        section.style.display = "none";
        return;
      }

      section.style.display = "block";
      editor.innerHTML = "";

      Object.keys(vars).forEach(function (key) {
        var originalValue = vars[key];
        var displayValue =
          typeof originalValue === "object"
            ? JSON.stringify(originalValue)
            : String(originalValue || "");

        var row = document.createElement("div");
        row.className = "var-row";

        var keyEl = document.createElement("span");
        keyEl.className = "var-key";
        keyEl.textContent = key;

        var valEl = document.createElement("input");
        valEl.className = "var-value";
        valEl.value =
          self._variableOverrides[key] !== undefined
            ? self._variableOverrides[key]
            : displayValue;
        valEl.placeholder = displayValue;
        valEl.addEventListener("input", function () {
          if (valEl.value === "" || valEl.value === displayValue) {
            delete self._variableOverrides[key];
          } else {
            self._variableOverrides[key] = valEl.value;
          }
          self._scheduleUpdate();
        });

        row.appendChild(keyEl);
        row.appendChild(valEl);
        editor.appendChild(row);
      });
    }

    // ---- Build Preview Hass Object ----
    _buildPreviewHass() {
      if (!this._hass) return null;

      var entityId = this._selectedEntity || "light.mock_entity";
      var stateOverride = this._stateOverride;
      var realState = this._hass.states[entityId];

      var mockState = {
        entity_id: entityId,
        state: stateOverride || (realState ? realState.state : "on"),
        attributes: Object.assign(
          {
            friendly_name: entityId.split(".").pop().replace(/_/g, " "),
            icon: "mdi:lightbulb",
          },
          realState ? realState.attributes : {}
        ),
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        context: { id: "mock", parent_id: null, user_id: null },
      };

      var states = Object.assign({}, this._hass.states);
      states[entityId] = mockState;

      return Object.assign({}, this._hass, { states: states });
    }

    // ---- Update Preview ----
    _updatePreview() {
      var container = this.shadowRoot.getElementById("preview-container");
      var resolvedEl = this.shadowRoot.getElementById("resolved-config");

      if (!this._selectedTemplate || !this._templates[this._selectedTemplate]) {
        container.innerHTML =
          '<div class="preview-placeholder">Select a template to preview</div>';
        resolvedEl.textContent = "Select a template";
        return;
      }

      // Resolve the template
      var resolved;
      try {
        resolved = resolveTemplate(this._selectedTemplate, this._templates);
      } catch (e) {
        container.innerHTML =
          '<div class="preview-placeholder" style="color:var(--bct-error)">' +
          e.message +
          "</div>";
        resolvedEl.textContent = "Error: " + e.message;
        return;
      }

      // Apply variable overrides
      if (resolved.variables && Object.keys(this._variableOverrides).length > 0) {
        resolved.variables = Object.assign(
          {},
          resolved.variables,
          this._variableOverrides
        );
      }

      // Set entity
      var entityId = this._selectedEntity || "light.mock_entity";
      resolved.entity = entityId;

      // Ensure type is set for button-card
      if (!resolved.type) {
        resolved.type = "custom:button-card";
      }

      // Show resolved config as YAML
      try {
        resolvedEl.textContent = this._jsyaml.dump(resolved, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
        });
      } catch (e) {
        resolvedEl.textContent = JSON.stringify(resolved, null, 2);
      }

      // Check if button-card custom element is available
      if (!customElements.get("button-card")) {
        container.innerHTML =
          '<div class="preview-warning">' +
          "button-card is not loaded yet. Visit a dashboard with button-cards first, then return here." +
          "</div>" +
          '<div class="preview-placeholder">Resolved config is shown below.</div>';
        return;
      }

      // Create or reuse the button-card element for preview
      try {
        if (!this._cardEl) {
          this._cardEl = document.createElement("button-card");
          this._cardEl.preview = true;
        }

        this._cardEl.setConfig(resolved);

        var previewHass = this._buildPreviewHass();
        if (previewHass) {
          this._cardEl.hass = previewHass;
        }

        container.innerHTML = "";
        container.appendChild(this._cardEl);
        this._hideError();
      } catch (e) {
        container.innerHTML =
          '<div class="preview-placeholder" style="color:var(--bct-error)">' +
          "Preview error: " +
          e.message +
          "</div>";
        this._cardEl = null;
      }
    }

    // ---- Error display ----
    _showError(msg) {
      var bar = this.shadowRoot.getElementById("error-bar");
      if (bar) {
        bar.textContent = msg;
        bar.style.display = "block";
      }
    }

    _hideError() {
      var bar = this.shadowRoot.getElementById("error-bar");
      if (bar) bar.style.display = "none";
    }

    // ---- Import from Dashboard ----
    _showImportModal() {
      var self = this;
      if (!this._hass) {
        this._showError("Home Assistant connection not available");
        return;
      }

      this._hass
        .callWS({ type: "lovelace/dashboards/list" })
        .then(function (dashboards) {
          var overlay = document.createElement("div");
          overlay.className = "modal-overlay";

          var modal = document.createElement("div");
          modal.className = "modal";

          var options = '<option value="lovelace">Default (lovelace)</option>';
          dashboards.forEach(function (d) {
            options +=
              '<option value="' +
              d.url_path +
              '">' +
              (d.title || d.url_path) +
              "</option>";
          });

          modal.innerHTML =
            "<h3>Import Templates from Dashboard</h3>" +
            '<select class="modal-select" id="modal-dashboard-select">' +
            options +
            "</select>" +
            '<div class="modal-buttons">' +
            '  <button class="toolbar-btn" id="modal-cancel">Cancel</button>' +
            '  <button class="toolbar-btn primary" id="modal-import">Import</button>' +
            "</div>";

          overlay.appendChild(modal);
          self.shadowRoot.appendChild(overlay);

          overlay.addEventListener("click", function (e) {
            if (e.target === overlay) overlay.remove();
          });

          modal
            .querySelector("#modal-cancel")
            .addEventListener("click", function () {
              overlay.remove();
            });

          modal
            .querySelector("#modal-import")
            .addEventListener("click", function () {
              var urlPath = modal.querySelector(
                "#modal-dashboard-select"
              ).value;
              overlay.remove();
              self._importDashboard(
                urlPath === "lovelace" ? null : urlPath
              );
            });
        })
        .catch(function () {
          self._importDashboard(null);
        });
    }

    _importDashboard(urlPath) {
      var self = this;
      var params = { type: "lovelace/config" };
      if (urlPath) params.url_path = urlPath;

      this._hass
        .callWS(params)
        .then(function (config) {
          var templates = config.button_card_templates;
          if (!templates || Object.keys(templates).length === 0) {
            self._showError(
              "No button_card_templates found in this dashboard."
            );
            return;
          }

          // Track source dashboard for save-back
          self._sourceDashboard = urlPath;
          self._updateSaveButton();

          var yaml =
            "button_card_templates:\n" +
            self._jsyaml
              .dump(templates, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
              })
              .replace(/^/gm, "  ");

          self._setEditorValue(yaml);
          self._parseAndUpdate();
          self._hideError();
        })
        .catch(function (err) {
          self._showError("Failed to import: " + err.message);
        });
    }

    // ---- Update Save button label to show target ----
    _updateSaveButton() {
      var btn = this.shadowRoot.getElementById("btn-save");
      if (btn) {
        var target = this._sourceDashboard || "lovelace";
        btn.textContent = "Save to " + target;
        btn.title = "Save templates back to dashboard: " + target;
      }
    }

    // ---- Save to Dashboard ----
    _showSaveModal() {
      var self = this;
      if (!this._hass) {
        this._showError("Home Assistant connection not available");
        return;
      }

      // Parse current editor content first
      var yaml = this._getEditorValue();
      var parsed;
      try {
        parsed = this._jsyaml.load(yaml);
        if (!parsed) throw new Error("Empty YAML");
      } catch (e) {
        this._showError("Cannot save: invalid YAML - " + e.message);
        return;
      }

      var newTemplates = parsed.button_card_templates || parsed;
      if (typeof newTemplates !== "object" || Array.isArray(newTemplates)) {
        this._showError("Cannot save: invalid template format");
        return;
      }

      var templateCount = Object.keys(newTemplates).length;

      // Show confirmation with dashboard selector
      this._hass
        .callWS({ type: "lovelace/dashboards/list" })
        .then(function (dashboards) {
          var overlay = document.createElement("div");
          overlay.className = "modal-overlay";

          var modal = document.createElement("div");
          modal.className = "modal";

          var options = '<option value="lovelace"' +
            (self._sourceDashboard === null ? ' selected' : '') +
            '>Default (lovelace)</option>';
          dashboards.forEach(function (d) {
            var sel = d.url_path === self._sourceDashboard ? " selected" : "";
            options +=
              '<option value="' + d.url_path + '"' + sel + '>' +
              (d.title || d.url_path) +
              "</option>";
          });

          modal.innerHTML =
            "<h3>Save Templates to Dashboard</h3>" +
            '<p style="font-size:14px;color:var(--bct-text2);margin:0 0 12px">' +
            "This will replace <strong>all " + templateCount + " button_card_templates</strong> " +
            "in the selected dashboard.</p>" +
            '<select class="modal-select" id="modal-save-select">' +
            options +
            "</select>" +
            '<div style="background:var(--warning-color,#ff9800);color:#fff;padding:8px 12px;' +
            'border-radius:8px;font-size:13px;margin-bottom:16px">' +
            "Warning: This overwrites the existing templates in the dashboard. " +
            "Other dashboard config (views, etc.) is preserved.</div>" +
            '<div class="modal-buttons">' +
            '  <button class="toolbar-btn" id="modal-save-cancel">Cancel</button>' +
            '  <button class="toolbar-btn primary" id="modal-save-confirm">Save</button>' +
            "</div>";

          overlay.appendChild(modal);
          self.shadowRoot.appendChild(overlay);

          overlay.addEventListener("click", function (e) {
            if (e.target === overlay) overlay.remove();
          });

          modal
            .querySelector("#modal-save-cancel")
            .addEventListener("click", function () {
              overlay.remove();
            });

          modal
            .querySelector("#modal-save-confirm")
            .addEventListener("click", function () {
              var urlPath = modal.querySelector("#modal-save-select").value;
              overlay.remove();
              self._saveToDashboard(
                urlPath === "lovelace" ? null : urlPath,
                newTemplates
              );
            });
        })
        .catch(function () {
          // If dashboard list fails, save to source or default
          self._saveToDashboard(self._sourceDashboard, newTemplates);
        });
    }

    _saveToDashboard(urlPath, newTemplates) {
      var self = this;

      // First, read current dashboard config
      var readParams = { type: "lovelace/config" };
      if (urlPath) readParams.url_path = urlPath;

      this._hass
        .callWS(readParams)
        .then(function (currentConfig) {
          // Replace only button_card_templates, keep everything else
          var updatedConfig = Object.assign({}, currentConfig, {
            button_card_templates: newTemplates,
          });

          // Save back
          var saveParams = {
            type: "lovelace/config/save",
            config: updatedConfig,
          };
          if (urlPath) saveParams.url_path = urlPath;

          return self._hass.callWS(saveParams);
        })
        .then(function () {
          // Track this dashboard as source
          self._sourceDashboard = urlPath;
          self._updateSaveButton();

          // Show success feedback
          var btn = self.shadowRoot.getElementById("btn-save");
          var original = btn.textContent;
          btn.textContent = "Saved!";
          btn.style.background = "var(--success-color, #43a047)";
          setTimeout(function () {
            btn.textContent = original;
            btn.style.background = "";
          }, 2000);

          self._hideError();
        })
        .catch(function (err) {
          self._showError("Failed to save: " + err.message);
        });
    }

    // ---- Export YAML ----
    _exportYaml() {
      var yaml = this._getEditorValue();
      if (!yaml) return;

      var blob = new Blob([yaml], { type: "text/yaml" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "button_card_templates.yaml";
      a.click();
      URL.revokeObjectURL(url);
    }

    // ---- Copy to Clipboard ----
    _copyToClipboard() {
      var self = this;
      var yaml = this._getEditorValue();
      if (!yaml) return;

      navigator.clipboard
        .writeText(yaml)
        .then(function () {
          var btn = self.shadowRoot.getElementById("btn-copy");
          var original = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(function () {
            btn.textContent = original;
          }, 1500);
        })
        .catch(function () {
          // Fallback for insecure contexts
          var ta = document.createElement("textarea");
          ta.value = yaml;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        });
    }
  }

  // Register the custom element
  customElements.define(
    "button-card-templater-panel",
    ButtonCardTemplaterPanel
  );
})();
