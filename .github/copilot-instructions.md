# Copilot instructions — SMARTPOT (Doctor Plant)

This file gives repository-specific guidance for future Copilot CLI sessions and automated agents.

---

## Quick commands (what exists / how to run things)

- npm scripts: `npm test` exists but is a placeholder and exits with error (package.json). No build or lint scripts present.
- Frontend (static): open `public/index.html` in a browser. To serve locally use a static server, e.g.:
  - `npx http-server public -p 8080` or `npx serve public`
- Python ML server (LSTM): run the Flask app with Python3:
  - `python3 lstm_model.py`
  - Required packages: flask, flask-cors, pandas, numpy, scikit-learn, tensorflow (install via pip3)
- ESP32 firmware: firmware source at `esp32/doctor_plant/doctor_plant.ino`. Use Arduino IDE or PlatformIO to compile and upload to the device.

Note: There are no automated tests or linters in this repo; `npm test` is a placeholder.

---

## High-level architecture (big picture)

- Frontend (public/)
  - Single-page static UI in `public/` (HTML, CSS, JS). Uses Web Bluetooth API or Capacitor Bluetooth plugin for BLE provisioning and controls; polls an ESP32 HTTP server for live sensor/pump state. Also requests predictions from the ML service.
  - Key file: `public/app.js` — BLE UUIDs, localStorage key, API endpoints and polling intervals live here.

- ESP32 Firmware (esp32/doctor_plant/doctor_plant.ino)
  - Implements a BLE service (NimBLE) that accepts WiFi credentials over a characteristic. On successful WiFi connection it starts an HTTP server providing endpoints consumed by the frontend:
    - `/data` — returns JSON sensor state
    - `/pump/on`, `/pump/off` — control pump
    - `/mode/auto`, `/mode/manual` — toggle mode
  - BLE UUIDs and characteristic properties are hard-coded and must match the frontend.

- ML Prediction Service (lstm_model.py)
  - Flask app that reads `plant.db` (SQLite) table `sensor_data` (query selects `moisture` ordered by `timestamp`) and trains a small LSTM model on the fly to predict next moisture value. Exposes:
    - `/predict` — returns `predicted_moisture` and a short `prediction` status
    - `/` — basic status
  - Sequence length: 5 timesteps. Model is trained on each request (expensive); consider persisting a trained model for production.

- Data
  - Local DB: `plant.db` (SQLite) — expected to contain a `sensor_data` table with `timestamp` and `moisture` columns (checked by lstm_model.py).

---

## Key conventions and repo-specific patterns

- BLE UUID synchronization: SERVICE_UUID and CHARACTERISTIC_UUID are defined in both `public/app.js` and `esp32/...ino`. Updating one requires updating the other exactly.
- Local storage: frontend saves BLE device ID under key `SMARTPOT_BLE_DEVICE_ID`. Removing this key forces device re-selection.
- Prediction endpoint expectation: `public/app.js` currently calls `http://192.168.1.5:8000/predict`. Change this constant when the ML server IP changes.
- Weather integration: OpenWeather API key is embedded in `public/app.js` (WEATHER_API_KEY). Replace or externalize as needed.
- Frontend fallbacks: app.js attempts to use Capacitor Bluetooth plugin first, then Web Bluetooth in browsers.
- Firmware endpoints: frontend depends on exact HTTP paths (`/data`, `/pump/*`, `/mode/*`) and response JSON fields (temperature, humidity, moisture, co2, oxygen, pump, mode). Keep response shapes stable.
- ML model behavior: `lstm_model.py` expects at least 10 rows; it scales values using MinMaxScaler, uses sequence_length=5 and trains for 20 epochs on each `/predict` call — this is functional but inefficient for production.

---

## Files to inspect first when asked about functionality

- `public/app.js` — frontend logic, BLE + HTTP interactions, polling intervals, constants
- `esp32/doctor_plant/doctor_plant.ino` — BLE provisioning, HTTP endpoints, sensor simulation
- `lstm_model.py` and `plant.db` — ML server and data model
- `public/index.html`, `public/style.css`, and `public/india_cities.json` — UI and static assets
- `capacitor.config.json` — mobile packaging settings (webDir: public)

---

## Other AI assistant / agent configs checked

Checked for common assistant config files and none found: CLAUDE.md, .cursorrules, .cursor/, AGENTS.md, .windsurfrules, CONVENTIONS.md, AIDER_CONVENTIONS.md, .clinerules

---

If something in this file is out of date or you'd like Copilot sessions to favor different entry points (for example, a persisted ML model or a wrapped Node server), say so and this file can be updated.
