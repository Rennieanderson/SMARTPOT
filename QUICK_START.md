# SMARTPOT Quick Start Guide 🌿

## ⚡ 5-Minute Setup

### Step 1: Upload ESP32 Firmware
```
1. Open Arduino IDE
2. File → Open → SmartPotFinal.ino
3. Select Board: ESP32 Dev Module
4. Tools → Port → Select COM port
5. Click Upload ▶️
```

### Step 2: Configure WiFi via BLE
```
1. Open public/index.html in browser
2. Click "CONNECT ESP32" button
3. Select your device from BLE list
4. Enter WiFi SSID and Password
5. Click "CONNECT WIFI"
6. Wait for "CONNECTED ✅"
```

### Step 3: Set ESP32 IP Address
```
1. Find ESP32 IP from router's device list (usually 192.168.x.x)
2. In the browser, find "ESP32 Network Config" section
3. Enter IP address in input field
4. Click "SET ESP32 IP"
5. Check browser console for "✅ ESP32 IP configured"
```

### Step 4: Start ML Server (Optional but Recommended)
```bash
pip install -r requirements.txt
python3 lstm_model.py
# Server starts on http://localhost:8000
```

### Step 5: Serve Dashboard
```bash
npm run serve
# Opens at http://localhost:8081
```

---

## 🎮 Basic Controls

### Manual Mode
- **START PUMP**: Click "START WATER PUMP"
- **STOP PUMP**: Click "STOP WATER PUMP"
- **STATUS**: Shows "ON" or "OFF"

### Auto Mode
- **ACTIVATE**: Click "AUTO MODE"
- **CONTROL**: System auto-waters based on soil moisture
- **THRESHOLDS**:
  - Moisture < 30% → Pump turns ON
  - Moisture > 70% → Pump turns OFF

### Real-Time Monitoring
- **Sensor Data**: Updates every 5 seconds
- **Moisture**: Shown as percentage + progress bar
- **Temperature**: From DHT11 sensor
- **Humidity**: From DHT11 sensor
- **Predictions**: LSTM ML model predicts next moisture

---

## 🔧 Adjusting Thresholds

### If pump turns on too easily:
**ESP32 firmware** (`SmartPotFinal.ino`):
```cpp
const int DRY_THRESHOLD = 3500;   // Increase to 3700
const int WET_THRESHOLD = 2500;   // Increase to 2800
```

### If pump doesn't respond to soil changes:
**Check thresholds match your sensor:**
1. Stick sensor in **dry soil** → read ADC value in Serial Monitor
2. Stick sensor in **wet soil** → read ADC value in Serial Monitor
3. Set DRY_THRESHOLD to dry value - 200
4. Set WET_THRESHOLD to wet value + 200

---

## ❌ Troubleshooting

| Problem | Solution |
|---------|----------|
| **Pump doesn't turn on** | Check GPIO 26 relay connection |
| **Pump keeps switching on/off** | Increase gap between thresholds (e.g., 3700 to 2300) |
| **No moisture readings** | Check GPIO 34 analog pin connection |
| **Dashboard shows "Offline 🔴"** | Check ESP32 IP address is correct |
| **BLE won't connect** | Enable Bluetooth on device, restart ESP32 |
| **Weather not loading** | Add OpenWeather API key in app.js |

---

## 📊 Key Metrics to Monitor

| Metric | Healthy Range | Action |
|--------|---------------|--------|
| Moisture | 40-60% | Water if below 30%, stop if above 70% |
| Temperature | 18-28°C | Check heat/cooling if outside range |
| Humidity | 50-70% | Normal range for most plants |
| CO2 | 400-1000 ppm | Indicates plant health |
| Oxygen | 20-22% | Should remain stable |

---

## 🌐 Network Configuration

### If on different WiFi network:
1. Use phone hotspot to provision ESP32
2. Once connected to main WiFi, get IP from router
3. Update IP in dashboard "SET ESP32 IP"
4. Should work immediately ✅

### If ESP32 and phone on different networks:
⚠️ **Not possible** - Must be on same network for HTTP polling
- Solution: Use same WiFi network or setup VPN

---

## 📱 Mobile Testing (Optional)

```bash
# If using Capacitor mobile
npm run build

# Android
cd android
./gradlew assembleDebug

# iOS
cd ios
xcodebuild -scheme SmartPot -configuration Debug -destination 'generic/platform=iOS'
```

---

## 🚨 Safety Features

- ✅ **Hysteresis Control**: Prevents pump flutter with 1000 ADC unit gap
- ✅ **5-Second Check**: AUTO mode checks moisture every 5 seconds
- ✅ **Manual Override**: Always override AUTO mode instantly
- ✅ **Timeout Protection**: HTTP calls have 5-second timeout
- ✅ **Error Logging**: All errors logged to browser console

---

## 💾 Data Persistence

**Saved in Browser LocalStorage:**
- ESP32 IP Address: `SMARTPOT_ESP32_IP`
- BLE Device ID: `SMARTPOT_BLE_DEVICE_ID`

**Persists across page reloads** ✅

---

## 📞 Debug Mode

### Enable Detailed Logging
**In browser console:**
```javascript
// All logs already enabled - check DevTools (F12)
// Look for messages like:
// ✅ Pump turned ON
// 📡 Sensor data updated
// ⚠️  Error: Cannot reach ESP32
```

### ESP32 Serial Monitor
```
[AUTO] Soil Moisture: 3600 | Pump: OFF
[AUTO] Soil DRY -> Pump ON
[HTTP] PUMP ON
```

---

## 🎯 Common Use Cases

### Plant that likes moist soil (Fern)
```cpp
const int DRY_THRESHOLD = 3800;   // Higher = more sensitive
const int WET_THRESHOLD = 2200;   // Lower = keeps moist
```

### Plant that likes dry soil (Cactus)
```cpp
const int DRY_THRESHOLD = 3300;   // Lower = less watering
const int WET_THRESHOLD = 2800;   // Higher = dries out faster
```

### For outdoor use (rain delays watering)
```cpp
// Use MANUAL mode instead - easier to control
// Check daily and water as needed
```

---

## 🔐 Security Notes

⚠️ **Current limitations:**
- No authentication on ESP32
- No HTTPS (uses HTTP)
- WiFi credentials sent plaintext over BLE

**For production:**
- Add basic auth to ESP32 endpoints
- Setup HTTPS with self-signed certificate
- Use encrypted BLE characteristic

---

## 📈 Performance Tips

1. **Faster response**: Decrease AUTO_CHECK_INTERVAL (min 1000ms)
2. **Save power**: Increase AUTO_CHECK_INTERVAL (max 30000ms)
3. **Stable control**: Increase hysteresis gap (DRY - WET)
4. **Faster updates**: Decrease polling interval (min 2000ms)

---

## ✅ Pre-Deployment Checklist

- [ ] ESP32 firmware uploaded successfully
- [ ] BLE provisioning works
- [ ] Dashboard loads and shows "Connected ✅"
- [ ] Sensor data updates every 5 seconds
- [ ] Pump responds to ON/OFF buttons instantly
- [ ] AUTO mode correctly waters based on moisture
- [ ] Pump doesn't flutter (smooth on/off)
- [ ] ML predictions show every 5 seconds
- [ ] Weather loads for selected city
- [ ] IP address saved and persists

---

**Status**: ✅ READY FOR DEPLOYMENT

Need help? Check `/SETUP_GUIDE.md` for detailed configuration.
