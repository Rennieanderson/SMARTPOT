# 🌿 SMARTPOT - Complete Project Run Guide

## 🚀 Step-by-Step Setup & Execution

---

## PART 1: Hardware Setup (ESP32)

### 1.1 Install Arduino IDE
```bash
# Download from: https://www.arduino.cc/en/software
# Install on your computer
```

### 1.2 Add ESP32 Board Support
1. Open Arduino IDE
2. File → Preferences
3. Paste in "Additional Boards Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Tools → Board Manager → Search "esp32" → Install by Espressif

### 1.3 Install Required Libraries
In Arduino IDE, go to Sketch → Include Library → Manage Libraries. Install:
- **NimBLEDevice** (by h2zero) - for Bluetooth
- **DHT sensor library** (by Adafruit) - for temperature/humidity
- **Adafruit Unified Sensor** (dependency for DHT)

### 1.4 Upload Firmware
```
1. Connect ESP32 to computer via USB
2. Open SmartPotFinal.ino in Arduino IDE
3. Select Tools → Board → ESP32 Dev Module
4. Select Tools → Port → COM[X] (your port)
5. Click Upload ▶️
6. Wait for "Leaving... Hard resetting via RTS pin" message
7. Firmware uploaded! ✅
```

### 1.5 Verify Upload (Optional)
1. Tools → Serial Monitor
2. Set baud rate to 115200
3. Should see: "SMARTPOT STARTING..."

**⏸️ Leave ESP32 powered on and connected to WiFi (via BLE provisioning)**

---

## PART 2: Frontend Setup (Web Dashboard)

### 2.1 Install Node.js Dependencies
```bash
cd /Users/rennieanderson/Desktop/SMARTPOT
npm install
# Installs: @capacitor/*, express, cors, sqlite3, etc.
```

### 2.2 Serve the Dashboard
```bash
npm run serve
# Frontend runs at: http://localhost:8081
# Browser opens automatically
```

**✅ Dashboard is now running and ready for configuration**

---

## PART 3: BLE Provisioning (Connect ESP32 to WiFi)

### 3.1 Open Dashboard in Browser
- Already opened by `npm run serve`
- If not: `http://localhost:8081`

### 3.2 Connect via Bluetooth
```
1. Click "CONNECT ESP32" button (green)
2. Browser requests permission
3. Select "DoctorPlant_BT" from BLE device list
4. Confirm connection
5. Wait for "CONNECTED ✅"
```

### 3.3 Send WiFi Credentials
```
1. In "WiFi Credentials" section:
   - Enter WiFi SSID (network name)
   - Enter WiFi Password
2. Click "CONNECT WIFI"
3. Wait for confirmation (may take 10-15 seconds)
4. Status should show "CONNECTED ✅"
```

**✅ ESP32 is now connected to WiFi**

---

## PART 4: Configure ESP32 IP Address

### 4.1 Find ESP32 IP Address
```
1. Open your WiFi router admin page (usually 192.168.1.1)
2. Look for "Connected Devices" or "DHCP Clients"
3. Find device named "ESP32" or "DoctorPlant"
4. Note the IP address (usually 192.168.x.x)

Example: 192.168.1.105
```

### 4.2 Set IP in Dashboard
```
1. In dashboard, find "ESP32 Network Config" section (orange box)
2. Enter the ESP32 IP address
3. Click "SET ESP32 IP"
4. Check browser console (F12) for "✅ ESP32 IP configured"
5. Sensor data should start updating
```

**✅ Dashboard is now communicating with ESP32**

---

## PART 5: ML Prediction Server (Optional but Recommended)

### 5.1 Install Python Dependencies
```bash
cd /Users/rennieanderson/Desktop/SMARTPOT
pip install -r requirements.txt
# Installs: flask, tensorflow, scikit-learn, pandas, etc.
```

### 5.2 Start ML Server
```bash
python3 lstm_model.py
# Server runs at: http://localhost:8000
# Should see: "Running on http://0.0.0.0:8000"
```

**✅ ML predictions are now enabled**

---

## PART 6: Run Complete System

### All Components Running:
```bash
# Terminal 1: Frontend Dashboard
cd /Users/rennieanderson/Desktop/SMARTPOT
npm run serve
# → http://localhost:8081

# Terminal 2: ML Server  
cd /Users/rennieanderson/Desktop/SMARTPOT
python3 lstm_model.py
# → http://localhost:8000

# Terminal 3: Node.js Backend (Optional)
npm run start
# → http://localhost:3000
```

### Verify All Systems:
| Component | URL | Status |
|-----------|-----|--------|
| Dashboard | http://localhost:8081 | ✅ |
| ML Server | http://localhost:8000 | ✅ |
| Node Backend | http://localhost:3000 | ⚠️ Optional |
| ESP32 | http://[esp32-ip]/data | ✅ |

---

## 🎮 Using the Dashboard

### Real-Time Monitoring
- Sensor data updates every 5 seconds
- Shows: Moisture, Temperature, Humidity, CO2, O2
- Plant health status displayed

### Manual Control
```
• START WATER PUMP → Turns pump on immediately
• STOP WATER PUMP → Turns pump off immediately
• Status shows ON/OFF
```

### Auto Mode (Recommended)
```
1. Click "AUTO MODE"
2. System automatically waters based on soil moisture:
   • Moisture < 30% → Pump turns ON
   • Moisture > 70% → Pump turns OFF
   • No manual intervention needed
```

### Weather Integration
```
1. Select State from dropdown
2. Select City from dropdown  
3. Click "GET WEATHER"
4. Shows live weather for that city
```

### ML Predictions
```
• Updates every 5 seconds
• Shows predicted moisture level
• Predicts: "Water Soon 🚰" or "Healthy 🌿"
```

---

## 🔧 Troubleshooting During Setup

| Issue | Solution |
|-------|----------|
| **"Cannot connect to ESP32 via BLE"** | Restart ESP32, ensure Bluetooth enabled |
| **"Dashboard shows Offline 🔴"** | Check ESP32 IP address is correct |
| **"Pump doesn't respond"** | Check GPIO 26 relay connection |
| **"No sensor readings"** | Check GPIO 34 and soil sensor wiring |
| **"ML server won't start"** | Install TensorFlow: `pip install tensorflow` |
| **"CORS errors"** | Ensure ML server is running on port 8000 |

---

## 🔄 System Architecture

```
┌─────────────────────────────────────────┐
│     Web Browser (Dashboard)             │
│   http://localhost:8081                 │
│  • Real-time sensor display             │
│  • Manual pump control                  │
│  • Auto mode toggle                     │
└──────────────┬──────────────────────────┘
               │ HTTP (every 5s)
               ↓
┌─────────────────────────────────────────┐
│          ESP32 (WiFi)                   │
│      http://[esp32-ip]/data             │
│  • DHT11 sensors (temp, humidity)       │
│  • Soil moisture sensor                 │
│  • Pump relay control                   │
│  • Auto mode logic (5s checks)          │
└──────────────┬──────────────────────────┘
               │ HTTP (separate calls)
               ├────────────────┬─────────────────┐
               ↓                ↓                 ↓
    ML Server         Node Backend      Browser Storage
    (Optional)        (Optional)        (localStorage)
```

---

## 📊 Monitoring & Debugging

### Browser Console (F12)
```
Press F12 → Console tab
Look for messages:
✅ Pump turned ON
📡 Sensor data updated  
⚠️  Error: Cannot reach ESP32
🌿 AUTO mode active
```

### ESP32 Serial Monitor
```
Arduino IDE → Tools → Serial Monitor (115200 baud)
[AUTO] Soil Moisture: 3600 | Pump: OFF
[AUTO] Soil DRY -> Pump ON
[HTTP] PUMP ON
```

### ML Server Logs
```
Terminal running python3 lstm_model.py
Shows: * Running on http://0.0.0.0:8000
Shows: Prediction calls
```

---

## 🚨 Safety & Best Practices

### ✅ DO:
- Keep ESP32 powered at all times during operation
- Monitor moisture readings daily
- Check pump is working (manual test first)
- Use AUTO mode for regular watering
- Keep WiFi stable for reliable communication

### ❌ DON'T:
- Unplug ESP32 without graceful shutdown
- Leave pump on for more than 30 minutes continuously
- Use on outdoor plants in rain (without waterproofing)
- Share network credentials in logs/errors
- Modify thresholds without testing first

---

## 📈 Performance Tips

### For Faster Response:
```cpp
// In SmartPotFinal.ino, decrease this:
const unsigned long AUTO_CHECK_INTERVAL = 2000; // 2 seconds instead of 5
```

### For Lower Power:
```cpp
// In SmartPotFinal.ino, increase this:
const unsigned long AUTO_CHECK_INTERVAL = 10000; // 10 seconds
```

### For Stable Control:
```cpp
// Increase hysteresis gap in SmartPotFinal.ino:
const int DRY_THRESHOLD = 3700;   // (was 3500)
const int WET_THRESHOLD = 2300;   // (was 2500)
```

---

## ✅ Quick Verification Checklist

After setup, verify each step:

- [ ] Arduino IDE has ESP32 board installed
- [ ] SmartPotFinal.ino uploads successfully (no errors)
- [ ] ESP32 shows in Serial Monitor
- [ ] `npm install` completes without errors
- [ ] `npm run serve` opens dashboard at http://localhost:8081
- [ ] BLE connection works (shows "CONNECTED ✅")
- [ ] WiFi provisioning succeeds (ESP32 gets IP)
- [ ] Dashboard shows "SET ESP32 IP" option
- [ ] ESP32 IP is set and stored
- [ ] Sensor data starts updating in dashboard
- [ ] Manual pump control works instantly
- [ ] ML server starts: `python3 lstm_model.py`
- [ ] ML predictions appear every 5 seconds
- [ ] AUTO mode correctly waters based on moisture
- [ ] Pump doesn't flutter (smooth on/off)

---

## 📞 Quick Command Reference

```bash
# Start everything in separate terminals:

# Terminal 1: Dashboard
cd ~/Desktop/SMARTPOT && npm run serve

# Terminal 2: ML Server
cd ~/Desktop/SMARTPOT && python3 lstm_model.py

# Terminal 3: Optional Node Backend
cd ~/Desktop/SMARTPOT && npm run start

# View Serial Output from ESP32:
# Arduino IDE → Tools → Serial Monitor (115200 baud)
```

---

## 🎯 Expected Output Timeline

```
T+0s:   ESP32 starts, shows "SMARTPOT STARTING..."
T+5s:   BLE advertising active
T+10s:  User clicks "CONNECT ESP32"
T+15s:  WiFi credentials received
T+25s:  ESP32 connects to WiFi, HTTP server starts
T+30s:  Dashboard polls first /data
T+35s:  Sensor readings appear in dashboard
T+40s:  ML server running (if started)
T+45s:  Predictions start showing
T+50s:  AUTO mode can be activated
T+55s:  System fully operational ✅
```

---

## 🎉 You're Ready!

**Status**: ✅ PROJECT READY FOR USE

Follow this guide step-by-step, and your SMARTPOT system will be running smoothly!

For detailed configuration, see: `/SETUP_GUIDE.md`
For 5-minute quick start, see: `/QUICK_START.md`

---

**Last Updated**: May 30, 2026
**Project Version**: 2.0
**Documentation Version**: Complete
