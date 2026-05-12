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
  // CSS Styles
  // ============================================================
  var STYLES = "\
:host{display:block;height:100vh;background:var(--primary-background-color,#fafafa);color:var(--primary-text-color,#212121);font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif);--bct-accent:var(--primary-color,#03a9f4);--bct-surface:var(--card-background-color,#fff);--bct-border:var(--divider-color,#e0e0e0);--bct-text2:var(--secondary-text-color,#727272);--bct-error:var(--error-color,#db4437);--bct-radius:12px}\
.container{display:flex;flex-direction:column;height:100%;overflow:hidden}\
.toolbar{display:flex;align-items:center;padding:0 16px;min-height:56px;background:var(--bct-surface);border-bottom:1px solid var(--bct-border);gap:12px;flex-wrap:wrap}\
.title{font-size:20px;font-weight:500;white-space:nowrap;margin-right:8px}\
.tb-group{display:flex;align-items:center;gap:6px}\
.tb-group label{font-size:12px;font-weight:500;color:var(--bct-text2);white-space:nowrap}\
.tb-select{padding:6px 12px;border:1px solid var(--bct-border);border-radius:8px;background:var(--bct-surface);color:var(--primary-text-color);font-size:14px;min-width:140px;cursor:pointer}\
.tb-spacer{flex:1}\
.tb{padding:6px 14px;border:1px solid var(--bct-border);border-radius:8px;background:var(--bct-surface);color:var(--primary-text-color);font-size:13px;cursor:pointer;transition:background .15s;white-space:nowrap}\
.tb:hover{background:var(--bct-border)}\
.tb.primary{background:var(--bct-accent);color:#fff;border-color:var(--bct-accent)}\
.tb.danger{color:var(--bct-error);border-color:var(--bct-error)}\
.tb.danger:hover{background:var(--bct-error);color:#fff}\
.main{display:flex;flex:1;overflow:hidden}\
.editor-pane{display:flex;flex-direction:column;min-width:200px;width:50%;overflow:hidden}\
.splitter{width:6px;cursor:col-resize;background:var(--bct-border);position:relative;flex-shrink:0;transition:background .15s}\
.splitter:hover,.splitter.active{background:var(--bct-accent)}\
.splitter::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:2px;height:32px;border-radius:1px;background:var(--bct-text2);opacity:.4}\
.splitter:hover::after,.splitter.active::after{opacity:1;background:#fff}\
.preview-pane{display:flex;flex-direction:column;overflow-y:auto;min-width:200px;flex:1}\
.pane-header{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--bct-text2);padding:12px 16px 4px}\
.pane-header.clickable{cursor:pointer;user-select:none}\
.editor-wrapper{flex:1;display:flex;overflow:hidden;padding:0 8px 8px}\
.editor-wrapper ha-code-editor{flex:1;--code-mirror-max-height:none}\
.yaml-textarea{flex:1;width:100%;border:1px solid var(--bct-border);border-radius:var(--bct-radius);background:var(--bct-surface);color:var(--primary-text-color);font-family:'Fira Code','Source Code Pro',Consolas,monospace;font-size:13px;line-height:1.5;padding:12px;resize:none;tab-size:2;outline:none}\
.yaml-textarea:focus{border-color:var(--bct-accent)}\
.controls-section{padding:0 16px 8px;border-bottom:1px solid var(--bct-border)}\
.control-group{margin-bottom:12px}\
.control-group>label{display:block;font-size:12px;font-weight:500;color:var(--bct-text2);margin-bottom:4px}\
.state-buttons{display:flex;gap:6px;flex-wrap:wrap;align-items:center}\
.state-btn{padding:4px 12px;border:1px solid var(--bct-border);border-radius:16px;background:var(--bct-surface);color:var(--primary-text-color);font-size:12px;cursor:pointer;transition:all .15s}\
.state-btn:hover{background:var(--bct-border)}\
.state-btn.active{background:var(--bct-accent);color:#fff;border-color:var(--bct-accent)}\
.custom-state-input{padding:4px 10px;border:1px solid var(--bct-border);border-radius:16px;background:var(--bct-surface);color:var(--primary-text-color);font-size:12px;width:100px;outline:none}\
.custom-state-input:focus{border-color:var(--bct-accent)}\
#entity-picker-wrapper ha-entity-picker{width:100%}\
.entity-input{width:100%;padding:8px 12px;border:1px solid var(--bct-border);border-radius:8px;background:var(--bct-surface);color:var(--primary-text-color);font-size:14px;outline:none;box-sizing:border-box}\
.entity-input:focus{border-color:var(--bct-accent)}\
.var-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}\
.var-key{font-size:12px;font-family:monospace;color:var(--bct-text2);min-width:100px;text-align:right}\
.var-value{flex:1;padding:4px 8px;border:1px solid var(--bct-border);border-radius:6px;background:var(--bct-surface);color:var(--primary-text-color);font-family:monospace;font-size:12px;outline:none}\
.var-value:focus{border-color:var(--bct-accent)}\
.preview-section{flex:1;display:flex;flex-direction:column;min-height:200px}\
.preview-container{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow:auto}\
.preview-container>*{max-width:300px;width:100%}\
.preview-placeholder{color:var(--bct-text2);font-size:14px;text-align:center;padding:40px 0}\
.preview-warning{color:var(--warning-color,#ff9800);font-size:13px;padding:8px 16px;text-align:center}\
.resolved-section{border-top:1px solid var(--bct-border)}\
.resolved-section details{padding-bottom:8px}\
.resolved-section summary{list-style:none;cursor:pointer}\
.resolved-section summary::-webkit-details-marker{display:none}\
.resolved-section summary::before{content:'\\25B6';display:inline-block;margin-right:6px;font-size:10px;transition:transform .2s}\
.resolved-section details[open] summary::before{transform:rotate(90deg)}\
.resolved-config{margin:0 16px 8px;padding:12px;background:var(--bct-surface);border:1px solid var(--bct-border);border-radius:var(--bct-radius);font-family:monospace;font-size:12px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;max-height:300px;overflow-y:auto}\
.error-bar{padding:8px 16px;background:var(--bct-error);color:#fff;font-size:13px;font-family:monospace;white-space:pre-wrap;max-height:80px;overflow-y:auto}\
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000}\
.modal{background:var(--bct-surface);border-radius:var(--bct-radius);padding:24px;min-width:300px;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,.3)}\
.modal h3{margin:0 0 16px;font-size:18px}\
.modal input[type=text]{width:100%;padding:8px 12px;border:1px solid var(--bct-border);border-radius:8px;background:var(--bct-surface);color:var(--primary-text-color);font-size:14px;box-sizing:border-box;outline:none;margin-bottom:16px}\
.modal-buttons{display:flex;justify-content:flex-end;gap:8px}\
.attr-row{display:flex;align-items:center;gap:4px;margin-bottom:4px}\
.attr-row input{flex:1;padding:3px 6px;border:1px solid var(--bct-border);border-radius:4px;background:var(--bct-surface);color:var(--primary-text-color);font-family:monospace;font-size:11px;outline:none;min-width:0}\
.attr-row input:focus{border-color:var(--bct-accent)}\
.attr-row .rm{background:none;border:none;color:var(--bct-error);cursor:pointer;font-size:14px;padding:2px 4px;line-height:1}\
.add-btn{background:none;border:1px dashed var(--bct-border);border-radius:6px;color:var(--bct-text2);font-size:11px;padding:4px 10px;cursor:pointer;width:100%}\
.add-btn:hover{border-color:var(--bct-accent);color:var(--bct-accent)}\
.extra-entity{border:1px solid var(--bct-border);border-radius:8px;padding:6px 8px;margin-bottom:6px}\
.extra-entity-header{display:flex;align-items:center;gap:4px;margin-bottom:4px}\
.extra-entity-header input{flex:1;padding:3px 6px;border:1px solid var(--bct-border);border-radius:4px;background:var(--bct-surface);color:var(--primary-text-color);font-family:monospace;font-size:11px;outline:none}\
.extra-entity-header input:focus{border-color:var(--bct-accent)}\
.section-toggle{font-size:11px;color:var(--bct-text2);cursor:pointer;user-select:none;padding:4px 0}\
.section-toggle:hover{color:var(--bct-accent)}\
";

  // ============================================================
  // Panel Custom Element
  // ============================================================
  class ButtonCardTemplaterPanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._jsyaml = null;
      this._allTemplates = {};       // { name: configObj } -- all templates in memory
      this._selectedDashboard = null; // url_path (null = default lovelace)
      this._selectedTemplate = "";
      this._selectedEntity = "";
      this._stateOverride = "";
      this._variableOverrides = {};
      this._attributeOverrides = {};  // { key: value } for main entity attributes
      this._extraEntities = [];       // [ { entity_id, state, attributes:{} } ] for states[...] mocks
      this._debounceTimer = null;
      this._initialized = false;
      this._cardEl = null;
      this._editor = null;
      this._skipNextCommit = false;   // prevent commit loop on programmatic editor set
    }

    set hass(hass) {
      this._hass = hass;
      var picker = this.shadowRoot && this.shadowRoot.querySelector("ha-entity-picker");
      if (picker) picker.hass = hass;
      if (this._cardEl && hass) this._cardEl.hass = this._buildPreviewHass();
      // Auto-load dashboards on first hass
      if (hass && this._initialized && !this._dashboardsLoaded) this._loadDashboards();
    }
    set narrow(v) {}
    set panel(v) {}

    // ---- Lifecycle ----
    connectedCallback() {
      var self = this;
      loadJsYaml().then(function (y) {
        self._jsyaml = y;
        self._buildUI();
        self._initialized = true;
        if (self._hass) self._loadDashboards();
      }).catch(function (e) {
        self.shadowRoot.innerHTML = '<div style="padding:32px;color:red;">Error: ' + e.message + '</div>';
      });
    }

    // ---- Build UI ----
    _buildUI() {
      var s = this.shadowRoot;
      s.innerHTML = '';
      var style = document.createElement('style');
      style.textContent = STYLES;
      s.appendChild(style);

      var c = document.createElement('div');
      c.className = 'container';
      c.innerHTML =
        '<div class="toolbar">' +
        '  <span class="title">Card Templater</span>' +
        '  <div class="tb-group"><label>Dashboard</label><select id="sel-dash" class="tb-select"></select></div>' +
        '  <div class="tb-group"><label>Template</label><select id="sel-tpl" class="tb-select"></select></div>' +
        '  <button id="btn-new" class="tb">+ New</button>' +
        '  <button id="btn-del" class="tb danger">Delete</button>' +
        '  <div class="tb-spacer"></div>' +
        '  <button id="btn-save" class="tb primary">Save</button>' +
        '  <button id="btn-copy" class="tb">Copy</button>' +
        '</div>' +
        '<div class="main">' +
        '  <div class="editor-pane">' +
        '    <div class="pane-header" id="editor-title">Template</div>' +
        '    <div class="editor-wrapper" id="editor-wrapper"></div>' +
        '  </div>' +
        '  <div class="splitter" id="splitter"></div>' +
        '  <div class="preview-pane">' +
        '    <div class="controls-section">' +
        '      <div class="pane-header">Controls</div>' +
        '      <div class="control-group"><label>Entity</label><div id="entity-picker-wrapper"></div></div>' +
        '      <div class="control-group"><label>State Override</label>' +
        '        <div class="state-buttons" id="state-buttons">' +
        '          <button class="state-btn active" data-state="">Auto</button>' +
        '          <button class="state-btn" data-state="on">on</button>' +
        '          <button class="state-btn" data-state="off">off</button>' +
        '          <button class="state-btn" data-state="unavailable">unavailable</button>' +
        '          <input type="text" id="custom-state" placeholder="custom..." class="custom-state-input">' +
        '        </div>' +
        '      </div>' +
        '      <div class="control-group" id="variables-section" style="display:none"><label>Variables</label><div id="variables-editor"></div></div>' +
        '      <div class="control-group"><label>Entity Attributes</label><div id="attr-editor"></div><button class="add-btn" id="btn-add-attr">+ Add Attribute</button></div>' +
        '      <div class="control-group"><label>Extra Entities <span style="font-weight:400;opacity:.7">(for states[...] access)</span></label><div id="extra-entities"></div><button class="add-btn" id="btn-add-entity">+ Add Entity</button></div>' +
        '    </div>' +
        '    <div class="preview-section"><div class="pane-header">Preview</div>' +
        '      <div id="preview-container" class="preview-container"><div class="preview-placeholder">Select a dashboard to start</div></div>' +
        '    </div>' +
        '    <div class="resolved-section"><details><summary class="pane-header clickable">Resolved Config</summary>' +
        '      <pre id="resolved-config" class="resolved-config"></pre></details></div>' +
        '  </div>' +
        '</div>' +
        '<div id="error-bar" class="error-bar" style="display:none"></div>';
      s.appendChild(c);

      this._setupEditor();
      this._setupEntityPicker();
      this._attachEvents();
    }

    // ---- Editor ----
    _setupEditor() {
      var w = this.shadowRoot.getElementById('editor-wrapper'), self = this;
      if (customElements.get('ha-code-editor')) {
        var ed = document.createElement('ha-code-editor');
        ed.mode = 'yaml'; ed.autofocus = true; ed.autocompleteEntities = false;
        ed.addEventListener('value-changed', function (e) { self._onEditorChange(e.detail.value); });
        w.appendChild(ed);
        this._editor = { el: ed, get: function () { return ed.value; }, set: function (v) { ed.value = v; } };
      } else {
        var ta = document.createElement('textarea');
        ta.className = 'yaml-textarea'; ta.spellcheck = false;
        ta.addEventListener('keydown', function (e) {
          if (e.key === 'Tab') { e.preventDefault(); var s = ta.selectionStart, end = ta.selectionEnd; ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(end); ta.selectionStart = ta.selectionEnd = s + 2; self._onEditorChange(ta.value); }
        });
        ta.addEventListener('input', function () { self._onEditorChange(ta.value); });
        w.appendChild(ta);
        this._editor = { el: ta, get: function () { return ta.value; }, set: function (v) { ta.value = v; } };
      }
    }

    _setupEntityPicker() {
      var w = this.shadowRoot.getElementById('entity-picker-wrapper'), self = this;
      if (customElements.get('ha-entity-picker')) {
        var p = document.createElement('ha-entity-picker');
        p.hass = this._hass; p.allowCustomEntity = true;
        p.addEventListener('value-changed', function (e) { self._selectedEntity = e.detail.value || ''; self._updatePreview(); });
        w.appendChild(p);
      } else {
        var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'entity-input'; inp.placeholder = 'light.living_room';
        inp.addEventListener('input', function () { self._selectedEntity = inp.value; self._updatePreview(); });
        w.appendChild(inp);
      }
    }

    // ---- Events ----
    _attachEvents() {
      var self = this;
      this.shadowRoot.getElementById('sel-dash').addEventListener('change', function (e) { self._onDashboardChange(e.target.value); });
      this.shadowRoot.getElementById('sel-tpl').addEventListener('change', function (e) { self._onTemplateChange(e.target.value); });
      this.shadowRoot.getElementById('btn-new').addEventListener('click', function () { self._createTemplate(); });
      this.shadowRoot.getElementById('btn-del').addEventListener('click', function () { self._deleteTemplate(); });
      this.shadowRoot.getElementById('btn-save').addEventListener('click', function () { self._save(); });
      this.shadowRoot.getElementById('btn-copy').addEventListener('click', function () { self._copy(); });
      // ---- Splitter drag ----
      var splitter = this.shadowRoot.getElementById('splitter');
      var editorPane = this.shadowRoot.querySelector('.editor-pane');
      var mainEl = this.shadowRoot.querySelector('.main');
      splitter.addEventListener('mousedown', function (e) {
        e.preventDefault();
        splitter.classList.add('active');
        var startX = e.clientX;
        var startW = editorPane.offsetWidth;
        var onMove = function (ev) {
          var newW = startW + (ev.clientX - startX);
          var maxW = mainEl.offsetWidth - 206; // 200 min + 6 splitter
          editorPane.style.width = Math.max(200, Math.min(newW, maxW)) + 'px';
        };
        var onUp = function () {
          splitter.classList.remove('active');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      // Touch support for mobile
      splitter.addEventListener('touchstart', function (e) {
        e.preventDefault();
        splitter.classList.add('active');
        var startX = e.touches[0].clientX;
        var startW = editorPane.offsetWidth;
        var onMove = function (ev) {
          var newW = startW + (ev.touches[0].clientX - startX);
          var maxW = mainEl.offsetWidth - 206;
          editorPane.style.width = Math.max(200, Math.min(newW, maxW)) + 'px';
        };
        var onEnd = function () {
          splitter.classList.remove('active');
          document.removeEventListener('touchmove', onMove);
          document.removeEventListener('touchend', onEnd);
        };
        document.addEventListener('touchmove', onMove);
        document.addEventListener('touchend', onEnd);
      });

      this.shadowRoot.getElementById('btn-add-attr').addEventListener('click', function () { self._addAttributeRow('', ''); });
      this.shadowRoot.getElementById('btn-add-entity').addEventListener('click', function () { self._addExtraEntity(); });
      this.shadowRoot.getElementById('state-buttons').addEventListener('click', function (e) {
        if (!e.target.classList.contains('state-btn')) return;
        self.shadowRoot.querySelectorAll('.state-btn').forEach(function (b) { b.classList.remove('active'); });
        e.target.classList.add('active');
        self._stateOverride = e.target.getAttribute('data-state');
        self.shadowRoot.getElementById('custom-state').value = '';
        self._updatePreview();
      });
      this.shadowRoot.getElementById('custom-state').addEventListener('input', function (e) {
        if (e.target.value) {
          self.shadowRoot.querySelectorAll('.state-btn').forEach(function (b) { b.classList.remove('active'); });
          self._stateOverride = e.target.value; self._updatePreview();
        }
      });
    }

    // ---- Load Dashboards ----
    _loadDashboards() {
      var self = this;
      this._dashboardsLoaded = true;
      var sel = this.shadowRoot.getElementById('sel-dash');
      sel.innerHTML = '<option value="">Default (lovelace)</option>';
      if (!this._hass) return;
      this._hass.callWS({ type: 'lovelace/dashboards/list' }).then(function (list) {
        list.forEach(function (d) {
          var o = document.createElement('option');
          o.value = d.url_path; o.textContent = d.title || d.url_path;
          sel.appendChild(o);
        });
        // Auto-load default dashboard
        self._onDashboardChange('');
      }).catch(function () { self._onDashboardChange(''); });
    }

    // ---- Dashboard Changed ----
    _onDashboardChange(urlPath) {
      var self = this;
      this._selectedDashboard = urlPath || null;
      var params = { type: 'lovelace/config' };
      if (this._selectedDashboard) params.url_path = this._selectedDashboard;

      this._hass.callWS(params).then(function (config) {
        self._allTemplates = config.button_card_templates ? deepClone(config.button_card_templates) : {};
        self._populateTemplateDropdown();
        self._hideError();
      }).catch(function (err) {
        self._allTemplates = {};
        self._populateTemplateDropdown();
        self._showError('Failed to load: ' + err.message);
      });
    }

    // ---- Populate Template Dropdown ----
    _populateTemplateDropdown() {
      var sel = this.shadowRoot.getElementById('sel-tpl');
      var names = Object.keys(this._allTemplates);
      var current = this._selectedTemplate;
      sel.innerHTML = '';
      if (names.length === 0) {
        sel.innerHTML = '<option value="">-- No templates --</option>';
        this._selectedTemplate = '';
        this._loadTemplateIntoEditor('');
        return;
      }
      names.forEach(function (n) {
        var o = document.createElement('option');
        o.value = n; o.textContent = n;
        if (n === current) o.selected = true;
        sel.appendChild(o);
      });
      // Keep current if still exists, otherwise first
      if (!current || names.indexOf(current) === -1) {
        this._selectedTemplate = names[0];
        sel.value = names[0];
      }
      this._loadTemplateIntoEditor(this._selectedTemplate);
    }

    // ---- Template Changed ----
    _onTemplateChange(name) {
      this._commitCurrentEdits(); // save current work
      this._selectedTemplate = name;
      this._variableOverrides = {};
      this._loadTemplateIntoEditor(name);
    }

    // ---- Load single template YAML into editor ----
    _loadTemplateIntoEditor(name) {
      var title = this.shadowRoot.getElementById('editor-title');
      if (!name || !this._allTemplates[name]) {
        title.textContent = 'Template';
        this._skipNextCommit = true;
        this._editor.set('# Select or create a template');
        this._updatePreview();
        this._updateVariablesEditor();
        return;
      }
      title.textContent = 'Template: ' + name;
      var yaml = this._jsyaml.dump(this._allTemplates[name], { indent: 2, lineWidth: -1, noRefs: true });
      this._skipNextCommit = true;
      this._editor.set(yaml);
      this._updatePreview();
      this._updateVariablesEditor();
    }

    // ---- Commit editor content back to _allTemplates ----
    _commitCurrentEdits() {
      if (!this._selectedTemplate || !this._jsyaml) return;
      try {
        var parsed = this._jsyaml.load(this._editor.get());
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          this._allTemplates[this._selectedTemplate] = parsed;
        }
      } catch (e) { /* ignore parse errors during commit */ }
    }

    // ---- Editor content changed (debounced) ----
    _onEditorChange(val) {
      if (this._skipNextCommit) { this._skipNextCommit = false; return; }
      var self = this;
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(function () {
        self._commitCurrentEdits();
        self._hideError();
        self._updatePreview();
        self._updateVariablesEditor();
      }, 400);
    }

    // ---- Create new template ----
    _createTemplate() {
      var self = this;
      var overlay = document.createElement('div'); overlay.className = 'modal-overlay';
      var modal = document.createElement('div'); modal.className = 'modal';
      modal.innerHTML =
        '<h3>New Template</h3>' +
        '<input type="text" id="new-tpl-name" placeholder="template_name" autofocus>' +
        '<div class="modal-buttons"><button class="tb" id="new-cancel">Cancel</button><button class="tb primary" id="new-ok">Create</button></div>';
      overlay.appendChild(modal);
      this.shadowRoot.appendChild(overlay);

      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
      modal.querySelector('#new-cancel').addEventListener('click', function () { overlay.remove(); });
      var doCreate = function () {
        var name = modal.querySelector('#new-tpl-name').value.trim().replace(/\s+/g, '_');
        overlay.remove();
        if (!name) return;
        if (self._allTemplates[name]) { self._showError("Template '" + name + "' already exists"); return; }
        self._commitCurrentEdits();
        self._allTemplates[name] = { show_name: true, show_icon: true };
        self._selectedTemplate = name;
        self._populateTemplateDropdown();
      };
      modal.querySelector('#new-ok').addEventListener('click', doCreate);
      modal.querySelector('#new-tpl-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') doCreate(); });
    }

    // ---- Delete current template ----
    _deleteTemplate() {
      if (!this._selectedTemplate) return;
      if (!confirm('Delete template "' + this._selectedTemplate + '"?')) return;
      delete this._allTemplates[this._selectedTemplate];
      this._selectedTemplate = '';
      this._populateTemplateDropdown();
    }

    // ---- Save to dashboard ----
    _save() {
      var self = this;
      if (!this._hass) { this._showError('No HA connection'); return; }
      this._commitCurrentEdits();

      var readParams = { type: 'lovelace/config' };
      if (this._selectedDashboard) readParams.url_path = this._selectedDashboard;

      this._hass.callWS(readParams).then(function (config) {
        var updated = Object.assign({}, config, { button_card_templates: self._allTemplates });
        var saveParams = { type: 'lovelace/config/save', config: updated };
        if (self._selectedDashboard) saveParams.url_path = self._selectedDashboard;
        return self._hass.callWS(saveParams);
      }).then(function () {
        var btn = self.shadowRoot.getElementById('btn-save');
        btn.textContent = 'Saved!'; btn.style.background = 'var(--success-color,#43a047)';
        setTimeout(function () { btn.textContent = 'Save'; btn.style.background = ''; }, 2000);
        self._hideError();
      }).catch(function (err) {
        self._showError('Save failed: ' + err.message);
      });
    }

    // ---- Copy to clipboard ----
    _copy() {
      var self = this, yaml = this._editor.get();
      if (!yaml) return;
      navigator.clipboard.writeText(yaml).then(function () {
        var btn = self.shadowRoot.getElementById('btn-copy');
        btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
      }).catch(function () {});
    }

    // ---- Variables Editor ----
    _updateVariablesEditor() {
      var section = this.shadowRoot.getElementById('variables-section');
      var editor = this.shadowRoot.getElementById('variables-editor');
      var self = this;
      if (!this._selectedTemplate || !this._allTemplates[this._selectedTemplate]) { section.style.display = 'none'; return; }
      var resolved;
      try { resolved = resolveTemplate(this._selectedTemplate, this._allTemplates); } catch (e) { section.style.display = 'none'; return; }
      var vars = resolved.variables;
      if (!vars || Object.keys(vars).length === 0) { section.style.display = 'none'; return; }

      section.style.display = 'block';
      editor.innerHTML = '';
      Object.keys(vars).forEach(function (key) {
        var orig = vars[key];
        var disp = typeof orig === 'object' ? JSON.stringify(orig) : String(orig || '');
        var row = document.createElement('div'); row.className = 'var-row';
        var k = document.createElement('span'); k.className = 'var-key'; k.textContent = key;
        var v = document.createElement('input'); v.className = 'var-value';
        v.value = self._variableOverrides[key] !== undefined ? self._variableOverrides[key] : disp;
        v.placeholder = disp;
        v.addEventListener('input', function () {
          if (v.value === '' || v.value === disp) delete self._variableOverrides[key]; else self._variableOverrides[key] = v.value;
          self._updatePreview();
        });
        row.appendChild(k); row.appendChild(v); editor.appendChild(row);
      });
    }

    // ---- Attribute Editor ----
    _addAttributeRow(key, val) {
      var self = this;
      var container = this.shadowRoot.getElementById('attr-editor');
      var row = document.createElement('div'); row.className = 'attr-row';
      var kInp = document.createElement('input'); kInp.placeholder = 'key (e.g. brightness)'; kInp.value = key;
      var vInp = document.createElement('input'); vInp.placeholder = 'value (e.g. 255)'; vInp.value = val;
      var rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '\u00d7';
      rm.addEventListener('click', function () { row.remove(); self._syncAttributes(); self._updatePreview(); });
      kInp.addEventListener('input', function () { self._syncAttributes(); self._updatePreview(); });
      vInp.addEventListener('input', function () { self._syncAttributes(); self._updatePreview(); });
      row.appendChild(kInp); row.appendChild(vInp); row.appendChild(rm);
      container.appendChild(row);
    }

    _syncAttributes() {
      var attrs = {};
      this.shadowRoot.querySelectorAll('#attr-editor .attr-row').forEach(function (row) {
        var inputs = row.querySelectorAll('input');
        var k = inputs[0].value.trim(), v = inputs[1].value.trim();
        if (k) {
          // Try to parse as JSON (for arrays, numbers, booleans)
          try { attrs[k] = JSON.parse(v); } catch (e) { attrs[k] = v; }
        }
      });
      this._attributeOverrides = attrs;
    }

    // ---- Extra Entities (for states[...] mocks) ----
    _addExtraEntity(entityId, state, attrs) {
      var self = this;
      var container = this.shadowRoot.getElementById('extra-entities');
      var wrapper = document.createElement('div'); wrapper.className = 'extra-entity';

      var header = document.createElement('div'); header.className = 'extra-entity-header';
      var eidInp = document.createElement('input'); eidInp.placeholder = 'entity_id (e.g. sensor.temp)'; eidInp.value = entityId || ''; eidInp.style.flex = '2';
      var stInp = document.createElement('input'); stInp.placeholder = 'state'; stInp.value = state || 'on';
      var rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '\u00d7';
      rm.addEventListener('click', function () { wrapper.remove(); self._syncExtraEntities(); self._updatePreview(); });

      header.appendChild(eidInp); header.appendChild(stInp); header.appendChild(rm);
      wrapper.appendChild(header);

      // Attributes for this extra entity
      var attrContainer = document.createElement('div'); attrContainer.className = 'extra-attrs';
      wrapper.appendChild(attrContainer);

      var addAttrBtn = document.createElement('button'); addAttrBtn.className = 'add-btn';
      addAttrBtn.textContent = '+ attribute'; addAttrBtn.style.fontSize = '10px'; addAttrBtn.style.padding = '2px 6px';
      addAttrBtn.addEventListener('click', function () {
        self._addExtraEntityAttrRow(attrContainer, '', '');
      });
      wrapper.appendChild(addAttrBtn);

      container.appendChild(wrapper);

      // Pre-populate attributes if provided
      if (attrs && typeof attrs === 'object') {
        Object.keys(attrs).forEach(function (k) {
          self._addExtraEntityAttrRow(attrContainer, k, typeof attrs[k] === 'object' ? JSON.stringify(attrs[k]) : String(attrs[k]));
        });
      }

      eidInp.addEventListener('input', function () { self._syncExtraEntities(); self._updatePreview(); });
      stInp.addEventListener('input', function () { self._syncExtraEntities(); self._updatePreview(); });
    }

    _addExtraEntityAttrRow(container, key, val) {
      var self = this;
      var row = document.createElement('div'); row.className = 'attr-row';
      var kInp = document.createElement('input'); kInp.placeholder = 'attr key'; kInp.value = key; kInp.style.flex = '1';
      var vInp = document.createElement('input'); vInp.placeholder = 'value'; vInp.value = val; vInp.style.flex = '1';
      var rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '\u00d7';
      rm.addEventListener('click', function () { row.remove(); self._syncExtraEntities(); self._updatePreview(); });
      kInp.addEventListener('input', function () { self._syncExtraEntities(); self._updatePreview(); });
      vInp.addEventListener('input', function () { self._syncExtraEntities(); self._updatePreview(); });
      row.appendChild(kInp); row.appendChild(vInp); row.appendChild(rm);
      container.appendChild(row);
    }

    _syncExtraEntities() {
      var entities = [];
      this.shadowRoot.querySelectorAll('#extra-entities .extra-entity').forEach(function (wrapper) {
        var headerInputs = wrapper.querySelectorAll('.extra-entity-header input');
        var eid = headerInputs[0].value.trim();
        var st = headerInputs[1].value.trim() || 'on';
        if (!eid) return;
        var attrs = {};
        wrapper.querySelectorAll('.extra-attrs .attr-row').forEach(function (row) {
          var inputs = row.querySelectorAll('input');
          var k = inputs[0].value.trim(), v = inputs[1].value.trim();
          if (k) { try { attrs[k] = JSON.parse(v); } catch (e) { attrs[k] = v; } }
        });
        entities.push({ entity_id: eid, state: st, attributes: attrs });
      });
      this._extraEntities = entities;
    }

    // ---- Build mock hass ----
    _buildPreviewHass() {
      if (!this._hass) return null;
      var eid = this._selectedEntity || 'light.mock_entity';
      var real = this._hass.states[eid];
      var now = new Date().toISOString();
      var ctx = { id: 'mock', parent_id: null, user_id: null };

      // Main entity: merge real attributes + overrides
      var baseAttrs = Object.assign(
        { friendly_name: eid.split('.').pop().replace(/_/g, ' '), icon: 'mdi:lightbulb' },
        real ? real.attributes : {},
        this._attributeOverrides
      );
      var mainMock = {
        entity_id: eid,
        state: this._stateOverride || (real ? real.state : 'on'),
        attributes: baseAttrs,
        last_changed: now, last_updated: now, context: ctx
      };

      var states = Object.assign({}, this._hass.states);
      states[eid] = mainMock;

      // Extra entities: add/override in states
      this._extraEntities.forEach(function (ex) {
        if (!ex.entity_id) return;
        var existing = states[ex.entity_id];
        states[ex.entity_id] = {
          entity_id: ex.entity_id,
          state: ex.state,
          attributes: Object.assign(
            { friendly_name: ex.entity_id.split('.').pop().replace(/_/g, ' ') },
            existing ? existing.attributes : {},
            ex.attributes
          ),
          last_changed: now, last_updated: now, context: ctx
        };
      });

      return Object.assign({}, this._hass, { states: states });
    }

    // ---- Update Preview ----
    _updatePreview() {
      var container = this.shadowRoot.getElementById('preview-container');
      var resolvedEl = this.shadowRoot.getElementById('resolved-config');
      if (!this._selectedTemplate || !this._allTemplates[this._selectedTemplate]) {
        container.innerHTML = '<div class="preview-placeholder">Select a template to preview</div>';
        resolvedEl.textContent = ''; return;
      }
      var resolved;
      try { resolved = resolveTemplate(this._selectedTemplate, this._allTemplates); } catch (e) {
        container.innerHTML = '<div class="preview-placeholder" style="color:var(--bct-error)">' + e.message + '</div>';
        resolvedEl.textContent = 'Error: ' + e.message; return;
      }
      if (resolved.variables && Object.keys(this._variableOverrides).length > 0) {
        resolved.variables = Object.assign({}, resolved.variables, this._variableOverrides);
      }
      resolved.entity = this._selectedEntity || 'light.mock_entity';
      if (!resolved.type) resolved.type = 'custom:button-card';

      try { resolvedEl.textContent = this._jsyaml.dump(resolved, { indent: 2, lineWidth: -1, noRefs: true }); }
      catch (e) { resolvedEl.textContent = JSON.stringify(resolved, null, 2); }

      if (!customElements.get('button-card')) {
        container.innerHTML = '<div class="preview-warning">button-card not loaded. Visit a dashboard with button-cards first.</div>';
        return;
      }
      try {
        if (!this._cardEl) { this._cardEl = document.createElement('button-card'); this._cardEl.preview = true; }
        this._cardEl.setConfig(resolved);
        var ph = this._buildPreviewHass();
        if (ph) this._cardEl.hass = ph;
        container.innerHTML = ''; container.appendChild(this._cardEl);
        this._hideError();
      } catch (e) {
        container.innerHTML = '<div class="preview-placeholder" style="color:var(--bct-error)">Preview error: ' + e.message + '</div>';
        this._cardEl = null;
      }
    }

    _showError(msg) { var b = this.shadowRoot.getElementById('error-bar'); if (b) { b.textContent = msg; b.style.display = 'block'; } }
    _hideError() { var b = this.shadowRoot.getElementById('error-bar'); if (b) b.style.display = 'none'; }
  }

  customElements.define('button-card-templater-panel', ButtonCardTemplaterPanel);
})();
