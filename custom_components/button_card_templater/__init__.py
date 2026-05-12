"""The Button Card Templater integration."""
from __future__ import annotations

import logging
import os

from homeassistant.config_entries import ConfigEntry
from homeassistant.components.frontend import (
    async_register_built_in_panel,
    async_remove_panel,
)
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

URL_BASE = f"/{DOMAIN}"
PANEL_URL_PATH = "button-card-templater"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Button Card Templater from a config entry."""

    # Path to frontend files
    panel_dir = os.path.join(os.path.dirname(__file__))
    panel_js = os.path.join(panel_dir, "panel.js")

    # Register static paths for frontend files
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                url_path=f"{URL_BASE}/panel.js",
                path=panel_js,
                cache_headers=False,
            ),
        ]
    )

    # Register the panel in the sidebar
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Card Templater",
        sidebar_icon="mdi:card-text-outline",
        frontend_url_path=PANEL_URL_PATH,
        require_admin=False,
        config={
            "_panel_custom": {
                "name": "button-card-templater-panel",
                "js_url": f"{URL_BASE}/panel.js",
                "embed_iframe": False,
                "trust_external": False,
            }
        },
    )

    _LOGGER.info("Button Card Templater panel registered")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    try:
        async_remove_panel(hass, PANEL_URL_PATH)
    except Exception:  # noqa: BLE001
        _LOGGER.warning("Could not remove panel %s", PANEL_URL_PATH)

    return True
