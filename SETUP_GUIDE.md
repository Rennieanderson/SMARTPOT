# SMARTPOT (Doctor Plant) - Complete Setup & Configuration Guide

## 📋 Project Overview
SMARTPOT is a smart indoor plant monitoring and irrigation system using ESP32, DHT sensors, LSTM ML predictions, and a responsive web dashboard.

---

## 🎯 Recently Fixed Issues

### ✅ 1. **Pump Control Lag & Threshold Issues**
- **Problem**: Rapid on/off switching causing pump flutter
- **Solution**: Added hysteresis logic with DRY_THRESHOLD (3500) and WET_THRESHOLD (2500)
- **Benefit**: 5-second check interval prevents flickering, ensures stable pump control

### ✅ 2. **Auto Mode Response Time**
- **Problem**: Auto mode only checked every 50ms with inverted logic
- **Solution**: Implemented proper hysteresis checking every 5 seconds
- **Benefit**: Faster response to soil moisture changes while preventing rapid switching

### ✅ 3. **Manual Mode Lag**
- **Problem**: Mode switches didn't update pump state immediately
- **Solution**: Added `lastAutoCheckTime` reset on mode/pump commands
- **Benefit**: Immediate response to manual commands, smooth mode transitions

### ✅ 4. **Flexible IP Configuration**
- **Problem**: ESP32 IP was hardcoded, didn't work on different networks
- **Solution**: Added UI input field + localStorage persistence
- **Benefit**: Works on any network without code changes

### ✅ 5. **Poor Response Handling**
- **Problem**: Pump endpoints returned plain text instead of JSON
- **Solution**: All endpoints now return JSON with status confirmation
- **Benefit**: Better error handling and debugging in browser console

---

## 🔧 Installation & Setup

### Prerequisites
- Node.js and npm
- Python 3.8+
- Arduino IDE or PlatformIO (for ESP32)
- ESP32 development board
- DHT11 humidity/temperature sensor
- Soil moisture sensor
- Water pump + relay module
- WiFi network

### 1. Frontend Setup (Web Dashboard)

```bash
# Install Node dependencies
npm install

# Serve the frontend locally
npm run serve
# Or: npx http-server public -p 8081
```

Access at: `http://localhost:8081`

### 2. ESP32 Firmware Upload

**Arduino IDE:**
1. Install ESP32 Board Package
2. Install libraries:
   - `WiFi.h` (built-in)
   - `WebServer.h` (built-in)
   - `NimBLEDevice.h` (via Library Manager)
   - `DHT.h` (Adafruit DHT library)
3. Open `/esp32/SmartPotFinal/SmartPotFinal.ino`
4. Select Board: ESP32 Dev Module
5. Upload

**PlatformIO:**
```bash
cd esp32/SmartPotFinal
pio run --target upload
```

### 3. ML Prediction Server Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the LSTM server
python3 lstm_model.py
# Server runs on http://localhost:8000
```

### 4. Node.js Backend (Optional - for data storage)

```bash
# Start the Node.js server
npm run start
# Server runs on http://localhost:3000
```

---

## ⚙️ Configuration Guide

### ESP32 Configuration
**File**: `/esp32/SmartPotFinal/SmartPotFinal.ino`

```cpp
// Pin Configuration
#define DHTPIN 4           // DHT11 data pin
#define SOIL_PIN 34        // Analog soil moisture pin
#define PUMP_PIN 26        // Pump relay control pin

// Auto Mode Thresholds
const int DRY_THRESHOLD = 3500;    // When moisture ADC > this, pump ON
const int WET_THRESHOLD = 2500;    // When moisture ADC < this, pump OFF
const unsigned long AUTO_CHECK_INTERVAL = 5000; // Check every 5 seconds
```

**BLE UUIDs** (must match frontend):
```cpp
#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab"
#define CHARACTERISTIC_UUID "abcdefab-1234-5678-1234-abcdefabcdef"
```

### Frontend Configuration
**File**: `/public/app.js`

```javascript
// Pump Control Thresholds (in percentage 0-100)
const PUMP_THRESHOLDS = {
  DRY_THRESHOLD: 30,      // Pump ON when moisture < this %
  WET_THRESHOLD: 70,      // Pump OFF when moisture > this %
  RESPONSE_TIME: 1000     // Min delay between pump commands (ms)
};

// ML Server URL
let ML_PREDICTION_URL = 'http://localhost:8000/predict';
```

**File**: `/public/config.js`

```javascript
// Override ML prediction URL if needed
window.PREDICTION_URL = 'http://localhost:8000/predict';
```

### Weather API
**File**: `/public/app.js`

```javascript
const WEATHER_API_KEY = 'YOUR_OPENWEATHER_API_KEY';
// Get free key from: https://openweathermap.org/api
```

---

## 📡 API Endpoints

### ESP32 HTTP Endpoints

#### Get Sensor Data
```
GET http://<esp32-ip>/data
Response: {
  "temperature": 25.5,
  "humidity": 60,
  "moisture": 2800,
  "co2": 850,
  "oxygen": 21,
  "pump": "ON",
  "mode": "AUTO"
}
```

#### Pump Control
```
GET http://<esp32-ip>/pump/on     → Pump ON
GET http://<esp32-ip>/pump/off    → Pump OFF
Response: {"status":"OK","pump":"ON","message":"..."}
```

#### Mode Control
```
GET http://<esp32-ip>/mode/auto    → AUTO mode
GET http://<esp32-ip>/mode/manual  → MANUAL mode
Response: {"status":"OK","mode":"AUTO","message":"..."}
```

### ML Server Endpoints

#### Get Moisture Prediction
```
GET http://localhost:8000/predict
Response: {
  "predicted_moisture": 2700,
  "prediction": "Water Needed Soon 🚰"
}
```

#### Force Model Retrain
```
POST http://localhost:8000/retrain
Response: {"status": "retrained"}
```

### Node.js Server Endpoints (Optional)

```
GET  /api/health              → Server status
GET  /api/sensor-data         → All sensor readings
GET  /api/sensor-data/latest  → Latest reading
POST /api/sensor-data         → Save new reading
GET  /api/config              → Get device config
POST /api/config              → Update device config
GET  /api/stats               → Statistics
GET  /api/predict             → Simple trend prediction
```

---

## 🌐 Workflow: How It All Works Together

```
┌─────────────────────────────────────────────────────────────────┐
│                     SMARTPOT SYSTEM FLOW                        │
└─────────────────────────────────────────────────────────────────┘

1. WIFI PROVISIONING (First Time)
   ┌──────────────────┐
   │  Web Dashboard   │  1. User enters WiFi SSID + password
   │  (Browser)       │  2. Sends via BLE to ESP32
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────┐
   │     ESP32        │  3. Connects to WiFi
   │  (with BLE)      │  4. Starts HTTP server
   └──────────────────┘

2. CONTINUOUS OPERATION
   ┌──────────────────┐
   │  Web Dashboard   │
   │  (Polling every  │←──────┐
   │   5 seconds)     │       │
   └────────┬─────────┘       │
            │                 │
            ↓                 │
   ┌──────────────────┐       │
   │  ESP32 HTTP      │───────┘
   │  Server (/data)  │
   │  • Temperature   │
   │  • Humidity      │
   │  • Moisture      │
   │  • CO2/O2        │
   │  • Pump Status   │
   │  • Mode Status   │
   └──────────────────┘

3. AUTO MODE LOGIC (On ESP32 every 5 seconds)
   ┌──────────────────┐
   │  Read Soil ADC   │
   │  (SOIL_PIN=34)   │
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────────────────────────┐
   │  Hysteresis Check:                   │
   │  • If ADC > 3500 AND pump OFF → ON   │
   │  • If ADC < 2500 AND pump ON → OFF   │
   └──────────────────────────────────────┘

4. MANUAL MODE
   ┌──────────────────┐
   │  User clicks:    │
   │  • START PUMP    │
   │  • STOP PUMP     │
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────┐
   │  HTTP GET        │
   │  /pump/on or     │
   │  /pump/off       │
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────┐
   │  ESP32 responds  │
   │  with JSON,      │
   │  controls PUMP   │
   └──────────────────┘

5. ML PREDICTIONS (Every 5 seconds)
   ┌──────────────────┐
   │  Web Dashboard   │
   │  Requests        │
   │  /predict        │
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────┐
   │ ML Server        │
   │ (Python/LSTM)    │
   │ • Read moisture  │
   │   history        │
   │ • Train LSTM     │
   │ • Predict next   │
   │   moisture       │
   └────────┬─────────┘
            │
            ↓
   ┌──────────────────┐
   │  Dashboard shows │
   │  "Water Needed   │
   │   Soon 🚰"       │
   └──────────────────┘
```

---

## 🔌 Hardware Wiring (ESP32)

```
ESP32 PIN          Component
─────────────────────────────────
GPIO 4 (D4)   ──  DHT11 Data Pin
GPIO 26 (D26) ──  Pump Relay Signal
GPIO 34 (A6)  ──  Soil Moisture ADC
GND           ──  Common Ground
3.3V          ──  Sensor Power (with level shifter if needed)
5V            ──  Pump Relay Power
```

---

## 🐛 Troubleshooting

### Issue: Pump flutters (rapid on/off)
**Solution**: Increase hysteresis gap between DRY_THRESHOLD and WET_THRESHOLD
```cpp
// Current: 3500 to 2500 (gap of 1000)
// Try: 3600 to 2300 (gap of 1300)
```

### Issue: ESP32 not reachable
**Solution**: 
1. Check WiFi is connected (LED indicator)
2. Verify IP address using router's admin panel
3. Make sure firewall allows HTTP on port 80

### Issue: Pump doesn't respond
**Solution**:
1. Check relay wiring to GPIO 26
2. Verify pump + relay have sufficient power
3. Test relay manually with jumper wire

### Issue: Moisture readings always show same value
**Solution**:
1. Check soil sensor wiring to GPIO 34
2. Calibrate sensor in air (should be ~4095) and water (should be ~1000)
3. Verify ADC conversion is working: Check Serial output

### Issue: ML predictions fail
**Solution**:
1. Ensure `plant.db` has at least 10 rows of sensor_data
2. Check Python server is running: `python3 lstm_model.py`
3. Verify TensorFlow is installed: `pip3 install tensorflow`

---

## 📊 Thresholds Summary

| Parameter | ESP32 Value | Frontend Value | Unit | Notes |
|-----------|------------|---|------|-------|
| DRY Trigger | 3500 | 30% | ADC / % | Pump turns ON |
| WET Trigger | 2500 | 70% | ADC / % | Pump turns OFF |
| Check Interval | 5000 | 5000 | ms | Avoids rapid switching |
| Polling Interval | — | 5000 | ms | Dashboard updates |

---

## 🚀 Quick Start Checklist

- [ ] Install Node.js dependencies: `npm install`
- [ ] Upload ESP32 firmware
- [ ] Set ESP32 WiFi credentials via BLE
- [ ] Set ESP32 IP in frontend UI
- [ ] Start Flask ML server: `python3 lstm_model.py`
- [ ] Open dashboard: `npm run serve`
- [ ] Add OpenWeather API key to config
- [ ] Test pump control (manual mode)
- [ ] Switch to AUTO mode and monitor
- [ ] Check ML predictions update every 5s

---

## 📞 Support & Debugging

**Enable Debug Logging:**

Frontend (Browser Console):
```javascript
// Already enabled - check DevTools for detailed logs
console.log("Auto mode active, checking moisture...")
```

ESP32 (Serial Monitor):
```
[AUTO] Soil Moisture: 3600 | Pump: OFF
[AUTO] Soil DRY -> Pump ON
[HTTP] PUMP ON
```

---

## 📝 Files Modified in This Update

- ✅ `/public/app.js` - Complete rewrite with hysteresis & IP config
- ✅ `/public/index.html` - Added ESP32 IP input field
- ✅ `/public/style.css` - Added orange button/box styling
- ✅ `/esp32/SmartPotFinal/SmartPotFinal.ino` - Fixed thresholds & JSON responses
- ✅ Backup created: `/esp32/SmartPotFinal/SmartPotFinal.ino.backup`

---

**Last Updated**: May 30, 2026
**Version**: 2.0 (Fixed Pump Lag, Auto Mode, Manual Mode Thresholds)
