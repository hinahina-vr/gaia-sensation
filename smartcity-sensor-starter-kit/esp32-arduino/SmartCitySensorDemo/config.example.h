#pragma once

// Production same-origin Pages Functions API. Keep HTTPS enabled.
#define API_BASE_URL "https://gaia-senseware.pages.dev/api/v1"

#define USE_MOCK_SENSOR true
#define TELEMETRY_INTERVAL_MS 300000UL
#define HTTP_TIMEOUT_MS 12000UL
#define RETRY_ATTEMPTS 3

// Hold this active-low button to erase local provisioning and reopen Setup AP.
// GPIO 0 is the BOOT button on common ESP32 development boards; change if needed.
#define REPROVISION_BUTTON_PIN 0
#define REPROVISION_HOLD_MS 5000UL
#define WIFI_RECONNECT_LIMIT 3
