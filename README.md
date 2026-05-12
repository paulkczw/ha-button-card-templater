# Button Card Templater

[![HACS][hacs-badge]][hacs-url]
[![GitHub Release][release-badge]][release-url]
[![License][license-badge]][license-url]

A Home Assistant custom integration that adds a dedicated **editor panel** for [button-card](https://github.com/custom-cards/button-card) templates. Edit, test, and preview your templates with live rendering -- directly inside Home Assistant.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.][hacs-install-badge]][hacs-install-url]

---

## Why?

If you use [custom:button-card](https://github.com/custom-cards/button-card), you probably have a growing collection of templates at the top of your dashboard YAML. The problem:

- Templates are tied to a specific dashboard
- Editing means switching to YAML mode, scrolling through hundreds of lines
- You can't see what a template looks like without saving and refreshing
- Testing different entity states requires manually changing real devices
- Template inheritance (`template: parent`) makes it hard to know what the final config looks like

**Button Card Templater** solves all of this with a dedicated sidebar panel.

---

## Features

| Feature | Description |
|---------|-------------|
| **YAML Editor** | Full code editor (`ha-code-editor` with syntax highlighting) for your `button_card_templates` block |
| **Template Selector** | Dropdown to pick any template from your YAML |
| **Live Preview** | Real `button-card` rendering -- exactly how it will look on your dashboard |
| **Template Inheritance** | Resolves `template: parent` chains using the same merge logic as button-card (`mergeDeep` + `mergeStatesById`) |
| **State Simulator** | Toggle entity states (on / off / unavailable / custom) and instantly see how your template reacts |
| **Entity Picker** | Pick any real entity from your HA instance, or use a mock entity |
| **Variables Editor** | Auto-generated input fields for all `variables` defined in the template -- tweak values and see live results |
| **Import from Dashboard** | Load existing `button_card_templates` from any of your dashboards with one click |
| **Save to Dashboard** | Write your edited templates directly back into a dashboard (only replaces `button_card_templates`, views stay untouched) |
| **Export / Copy** | Download as `.yaml` file or copy to clipboard |
| **Resolved Config** | Collapsible view showing the fully resolved config after inheritance + merge |
| **HA Theme Support** | Automatically follows your Home Assistant light/dark theme |

---

## Prerequisites

- **Home Assistant** 2026.5 or newer
- **[button-card](https://github.com/custom-cards/button-card)** installed (via HACS) -- needed for the live preview

---

## Installation

### HACS (Recommended)

1. Make sure [HACS](https://hacs.xyz/) is installed
2. Click the button below to add this repository:

   [![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.][hacs-install-badge]][hacs-install-url]

   Or manually: HACS > Integrations > 3-dot menu > Custom repositories > Add `https://github.com/paulkczw/ha-button-card-templater` as **Integration**

3. Search for **Button Card Templater** in HACS and install it
4. Restart Home Assistant
5. Go to **Settings > Devices & Services > Add Integration** and search for **Button Card Templater**
6. Click through the setup -- done. **Card Templater** appears in your sidebar.

### Manual

1. Copy the `custom_components/button_card_templater/` folder into your Home Assistant `config/custom_components/` directory
2. Restart Home Assistant
3. Go to **Settings > Devices & Services > Add Integration** and search for **Button Card Templater**

---

## How it works

### Architecture

```
Home Assistant
  |
  |-- custom_components/button_card_templater/
  |     |-- __init__.py         # Registers the sidebar panel
  |     |-- config_flow.py      # One-click setup via UI
  |     |-- panel.js            # The entire frontend (runs in HA context)
  |     |-- manifest.json
  |     ...
  |
  |-- Sidebar: "Card Templater"
        |
        |-- [YAML Editor]  <-->  [Live Preview]
        |-- [Controls: Entity, State, Variables]
```

The integration registers a **custom panel** in Home Assistant's sidebar. The panel runs directly inside HA's frontend (not an iframe), which means it has full access to:

- **`this.hass`** -- all entity states, services, WebSocket API
- **HA components** -- `<ha-code-editor>`, `<ha-entity-picker>` are used when available
- **`<button-card>`** -- the actual button-card custom element is used for rendering, so the preview is 100% accurate

### Template Resolution

Templates are resolved using the **exact same algorithm** as button-card internally:

1. If a template has `template: parent_name`, the parent is resolved first (recursively)
2. Multiple parents are supported: `template: [base, override]`
3. **Objects** are deep-merged (nested keys are merged, not replaced)
4. **Arrays** are concatenated (matching button-card's `mergeDeep` behavior)
5. **States** with the same `id` are merged via `mergeStatesById`
6. Circular references are detected and reported

### Workflow

```
 Import                    Edit                     Save
+-------------------+    +-------------------+    +-------------------+
| Pick a dashboard  | -> | Edit YAML         | -> | Save back to      |
| Templates loaded  |    | Pick template     |    | the same dashboard|
| into editor       |    | See live preview  |    | (or a different   |
|                   |    | Test states       |    |  one)             |
|                   |    | Tweak variables   |    |                   |
+-------------------+    +-------------------+    +-------------------+
```

1. **Import**: Click "Import", select a dashboard. All `button_card_templates` are loaded into the editor.
2. **Edit**: Modify templates in the YAML editor. Select a template from the dropdown to preview it. Use the entity picker and state buttons to test different scenarios.
3. **Save**: Click "Save to [dashboard]". A confirmation dialog shows how many templates will be written. Only the `button_card_templates` key is replaced -- all views, themes, and other config remain untouched.

---

## Example

Paste this into the editor to see it in action:

```yaml
button_card_templates:
  base:
    styles:
      card:
        - border-radius: 16px
        - padding: 12px
        - box-shadow: none
      name:
        - font-size: 13px
      icon:
        - width: 24px

  my_switch:
    template: base
    variables:
      color_on: var(--primary-color)
      color_off: var(--disabled-color)
    show_state: true
    show_name: true
    tap_action:
      action: toggle
    state:
      - value: "on"
        icon: mdi:lightbulb
        styles:
          card:
            - background-color: "[[[ return variables.color_on ]]]"
          icon:
            - color: white
      - value: "off"
        icon: mdi:lightbulb-outline
        styles:
          card:
            - background-color: "[[[ return variables.color_off ]]]"
```

1. Select **my_switch** from the dropdown
2. Pick a `light.*` entity (or leave empty for mock)
3. Toggle between **on** and **off** states
4. Change `color_on` in the Variables section
5. See the preview update instantly

---

## Notes

- The **live preview requires button-card to be loaded**. If you see a warning instead of a preview, visit any dashboard that contains a button-card first, then return to the templater. (Button-card registers its custom element on first use.)
- The editor falls back to a styled textarea if `ha-code-editor` is not loaded yet. This works fine but without syntax highlighting.
- **Save to Dashboard** reads the full dashboard config, replaces only `button_card_templates`, and writes it back. No other config is touched. A confirmation dialog is shown before saving.

---

## License

MIT

---

[hacs-badge]: https://img.shields.io/badge/HACS-Custom-41BDF5.svg
[hacs-url]: https://hacs.xyz/
[release-badge]: https://img.shields.io/github/v/release/paulkczw/ha-button-card-templater
[release-url]: https://github.com/paulkczw/ha-button-card-templater/releases
[license-badge]: https://img.shields.io/github/license/paulkczw/ha-button-card-templater
[license-url]: https://github.com/paulkczw/ha-button-card-templater/blob/main/LICENSE
[hacs-install-badge]: https://my.home-assistant.io/badges/hacs_repository.svg
[hacs-install-url]: https://my.home-assistant.io/redirect/hacs_repository/?owner=paulkczw&repository=ha-button-card-templater&category=integration
