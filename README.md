# Button Card Templater

[![HACS][hacs-badge]][hacs-url]
[![GitHub Release][release-badge]][release-url]
[![License][license-badge]][license-url]

A Home Assistant custom integration that adds a dedicated **editor panel** for [button-card](https://github.com/custom-cards/button-card) templates. Edit, test, and preview your templates with live rendering -- directly inside Home Assistant.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.][hacs-install-badge]][hacs-install-url]

---

> **WARNING -- EARLY DEVELOPMENT**
>
> This integration is in early development. Bugs and unexpected behavior may occur, especially when saving templates back to a dashboard. **Before using this tool, manually back up your dashboard YAML** (Raw Configuration Editor > Select All > Copy > Save to a text file). This ensures you can always restore your templates if something goes wrong.

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
| **Dashboard Selector** | Pick any dashboard -- templates are loaded automatically |
| **Template Selector** | Dropdown with all templates from the selected dashboard |
| **YAML Editor** | Edit a single template at a time with syntax highlighting (`ha-code-editor`) |
| **Live Preview** | Real `button-card` rendering -- exactly how it will look on your dashboard |
| **Template Inheritance** | Resolves `template: parent` chains using the same merge logic as button-card |
| **State Simulator** | Toggle entity states (on / off / unavailable / any custom value) |
| **Entity Picker** | Pick any real entity from your HA instance, or use a mock entity |
| **Entity Attributes** | Override attributes like `brightness`, `rgb_color`, `current_temperature`, etc. |
| **Extra Entities** | Mock additional entities for templates that use `states[...]` to access other entities |
| **Variables Editor** | Auto-generated input fields for all `variables` defined in the template |
| **Save to Dashboard** | One click -- writes templates directly back into the dashboard |
| **New / Delete** | Create new templates or delete existing ones |
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

## How to use

### Workflow

1. **Select a dashboard** from the dropdown in the toolbar. All `button_card_templates` are loaded automatically.
2. **Select a template** from the second dropdown. Its YAML is shown in the editor, and the preview updates.
3. **Edit** the template YAML. Changes are reflected in the preview in real-time.
4. **Test different states** using the state buttons (on / off / unavailable) or type any custom state value.
5. **Pick an entity** to preview with real entity data, or leave empty for a mock.
6. **Save** -- one click writes all templates back to the selected dashboard. Only `button_card_templates` is replaced; views and other config are untouched.

### Mocking entities and attributes

Many button-card templates access other entities via `states[...]` or depend on specific entity attributes. The templater lets you mock all of this:

**Entity Attributes** -- Override or add attributes for the main entity:

| Key | Value | Use case |
|-----|-------|----------|
| `brightness` | `255` | Light brightness |
| `rgb_color` | `[255,100,0]` | Light color (use JSON array) |
| `current_temperature` | `21.5` | Climate sensor |
| `volume_level` | `0.65` | Media player |
| `icon` | `mdi:lightbulb` | Custom icon |
| `members` | `["media_player.kitchen"]` | Group members (JSON array) |

Values are automatically parsed as JSON when possible (numbers, arrays, booleans), otherwise treated as strings.

**Extra Entities** -- Add mock entities that your template accesses via `states[...]`:

For example, if your template does `states['binary_sensor.window_open']?.state`, add an extra entity:

| entity_id | state |
|-----------|-------|
| `binary_sensor.window_open` | `on` |
| `sensor.living_room_temperature` | `22.3` |
| `input_text.alarm_current_day_tab` | `Mo` |

Each extra entity can also have its own attributes (click `+ attribute`).

If the entity already exists in your HA instance, the mock values override the real ones. If it doesn't exist, a new mock entity is created.

### Template inheritance

Templates are resolved using the **exact same algorithm** as button-card internally:

- `template: parent_name` -- parent is resolved first (recursively)
- `template: [base, override]` -- multiple parents supported
- Objects are deep-merged, arrays are concatenated
- States with the same `id` are merged via `mergeStatesById`
- Circular references are detected and reported

The **Resolved Config** section (collapsible at the bottom of the preview pane) shows the fully merged result.

---

## Notes

- The **live preview requires button-card to be loaded**. If you see a warning instead of a preview, visit any dashboard that contains a button-card first, then return to the templater.
- The editor falls back to a styled textarea if `ha-code-editor` is not available. This works fine but without syntax highlighting.
- **Save** reads the full dashboard config, replaces only `button_card_templates`, and writes it back. No other config is touched.

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
