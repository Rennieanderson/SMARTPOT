SMARTPOT (Doctor Plant)

Quick start — local development

1) Frontend (static)
- Serve the UI from public/:
  - npm: npx http-server public -p 8080
  - or: npx serve public
- Optional: create public/config.js (see public/config.example.js) and set window.PREDICTION_URL to your ML server URL before loading app.js.

2) Python ML server (LSTM prediction)
- Create a venv and install deps:
  - python3 -m venv .venv && source .venv/bin/activate
  - pip install -r requirements.txt
- Configure (optional): copy .env.example to .env and export variables, or set env vars inline.
- Run:
  - DB must be at plant.db and contain sensor_data(timestamp, moisture)
  - python3 lstm_model.py
- Endpoints:
  - GET /predict — returns predicted_moisture and prediction
  - POST /retrain — retrain and persist model/scaler

3) ESP32 firmware
- Source: esp32/SmartPotFinal/SmartPotFinal.ino
- Use Arduino IDE or PlatformIO to build and flash. BLE UUIDs must match public/app.js SERVICE_UUID and CHARACTERISTIC_UUID.

Configuration notes
- public/config.example.js shows how to set PREDICTION_URL in-browser.
- The frontend stores a native BLE device id in localStorage key: SMARTPOT_BLE_DEVICE_ID
- OpenWeather API key is embedded in public/app.js; consider replacing with your own key or externalizing.

Files added/edited for developer convenience
- requirements.txt — python dependencies
- .env.example — environment variables for ML server
- public/config.example.js — example client config (set and copy to public/config.js)

If you want, next: add a README run script for PlatformIO or create CI workflow for tests/deploy.

Retrain watcher

- A simple watcher script is available at `scripts/retrain_watcher.py` which polls `plant.db` mtime and POSTs to the ML server `/retrain` endpoint when data changes.
- Run once:
  - python3 scripts/retrain_watcher.py --once
- Run continuously (background):
  - nohup python3 scripts/retrain_watcher.py --interval 30 > /tmp/retrain-watcher.log 2>&1 &

This script is dependency-free and useful for development environments where sensor data is appended to `plant.db` and the ML model should be retrained automatically.