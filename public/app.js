// ═════════════════════════════════════════════════════════════════
// SMARTPOT (Doctor Plant) - Frontend Application
// BLE Provisioning + HTTP Polling + ML Predictions + Weather
// ═════════════════════════════════════════════════════════════════
let ws = null;

// ─────────────────────────────────────────────────────────────────
// CONFIGURATION & CONSTANTS
// ─────────────────────────────────────────────────────────────────

const SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
const CHARACTERISTIC_UUID = 'abcdefab-1234-5678-1234-abcdefabcdef';

const STORAGE_KEYS = {
  DEVICE_ID: 'SMARTPOT_BLE_DEVICE_ID',
  ESP32_IP: 'SMARTPOT_ESP32_IP',
  WEATHER_API_KEY: 'SMARTPOT_WEATHER_API_KEY'
};

const WEATHER_API_KEY = '407464acd92e16f460d3839e37822767'; // Replace with actual key
const POLLING_INTERVAL = 5000; // 5 seconds

// Default ML server (can override in config.js)
let ML_PREDICTION_URL = window.PREDICTION_URL || 'http://localhost:8000/predict';

// ─────────────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────────────

let bluetoothDevice = null;
let characteristic = null;
let pollingInterval = null;
let esp32IP = localStorage.getItem(STORAGE_KEYS.ESP32_IP) || '';
let connectedBluetooth = false;

// ═════════════════════════════════════════════════════════════════
// BLE FUNCTIONS
// ═════════════════════════════════════════════════════════════════

async function connectBluetooth() {
  try {
    console.log('Scanning for BLE device...');

    bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID]
    });

    console.log('Device selected:', bluetoothDevice.name);

    const server = await bluetoothDevice.gatt.connect();

    console.log('Connected to GATT');

    const service = await server.getPrimaryService(SERVICE_UUID);

    console.log('Service found');

    characteristic = await service.getCharacteristic(
      CHARACTERISTIC_UUID
    );

    console.log('Characteristic found');

    connectedBluetooth = true;

    updateBTStatus('CONNECTED ✅', 'esp-status');

    console.log('BLE connected successfully');

  } catch (error) {
    console.error('BLE connection failed:', error);
    updateBTStatus('CONNECTION FAILED ❌', 'esp-status');
  }
}

async function sendWiFiCredentials() {
  if (!characteristic) {
    alert('ESP32 not connected via Bluetooth. Connect first.');
    return;
  }

  const ssid = document.getElementById('wifi-ssid').value.trim();
  const password = document.getElementById('wifi-password').value.trim();

  if (!ssid || !password) {
    alert('Please enter both WiFi SSID and password');
    return;
  }

  try {
    updateWiFiStatus('Sending credentials...', 'wifi-status');
    
    const message = `${ssid},${password}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    await characteristic.writeValue(data);
    
    console.log('WiFi credentials sent to ESP32');
    updateWiFiStatus('Waiting for connection...', 'wifi-status');

    // Wait 10 seconds for ESP32 to connect
    setTimeout(checkWiFiStatus, 10000);

  } catch (error) {
    console.error('Failed to send WiFi credentials:', error);
    updateWiFiStatus('FAILED TO SEND ❌', 'wifi-status');
  }
}

async function checkWiFiStatus() {
  try {
    const response = await fetch(`http://${esp32IP}/data`, { timeout: 3000 });
    if (response.ok) {
      updateWiFiStatus('CONNECTED ✅', 'wifi-status');
      startPolling();
    } else {
      updateWiFiStatus('Connection timeout', 'wifi-status');
    }
  } catch (error) {
    updateWiFiStatus('Cannot reach ESP32', 'wifi-status');
    console.error('WiFi check failed:', error);
  }
}

// ═════════════════════════════════════════════════════════════════
// ESP32 HTTP ENDPOINTS
// ═════════════════════════════════════════════════════════════════

// Pump control thresholds (configurable)
const PUMP_THRESHOLDS = {
  DRY_THRESHOLD: 30,      // Moisture % below this = needs water
  WET_THRESHOLD: 70,      // Moisture % above this = stop watering
  RESPONSE_TIME: 1000     // Min time between pump commands (ms)
};

let lastPumpCommandTime = 0;
let currentPumpState = 'OFF';
let currentMode = 'AUTO';

async function setESP32IP() {
  const inputField = document.getElementById('esp32-ip');
  let inputIP = inputField ? inputField.value.trim() : '';
  
  if (!inputIP) {
    inputIP = prompt('Enter ESP32 IP Address (e.g., 192.168.1.5):', esp32IP);
    if (inputIP === null) return;
  }

  if (!inputIP.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    alert('Invalid IP address format. Use: xxx.xxx.xxx.xxx');
    return;
  }

  esp32IP = inputIP;
  localStorage.setItem(STORAGE_KEYS.ESP32_IP, esp32IP);
  
  if (inputField) {
    inputField.value = esp32IP;
  }
  
  console.log(`✅ ESP32 IP configured: ${esp32IP}`);
  
  // Try to fetch data immediately
  await fetchSensorData();
  
  // Start polling if not already running
  if (!pollingInterval) {
    startPolling();
  }
}

async function fetchSensorData() {

  try {
    const response = await fetch(`http://${esp32IP}/data`, {
      method: 'GET',
      mode: 'cors',
      timeout: 5000
    });

    if (!response.ok) {
      console.error('Failed to fetch sensor data:', response.status);
      return;
    }

    const data = await response.json();
    updateSensorUI(data);
    
    // Auto-control pump in AUTO mode
    if (currentMode === 'AUTO') {
      handleAutoModeLogic(data);
    }

  } catch (error) {
    console.error('Error fetching sensor data:', error);
  }
}

function handleAutoModeLogic(data) {
  if (!data.moisture) return;

  const now = Date.now();
  const canSendCommand = now - lastPumpCommandTime > PUMP_THRESHOLDS.RESPONSE_TIME;

  // Hysteresis: avoid rapid on/off switching
  if (canSendCommand) {
    if (data.moisture < PUMP_THRESHOLDS.DRY_THRESHOLD && currentPumpState === 'OFF') {
      pumpOn();
      currentPumpState = 'ON';
      lastPumpCommandTime = now;
    } else if (data.moisture > PUMP_THRESHOLDS.WET_THRESHOLD && currentPumpState === 'ON') {
      pumpOff();
      currentPumpState = 'OFF';
      lastPumpCommandTime = now;
    }
  }
}

async function pumpOn() {


  try {
    const response = await fetch(`http://${esp32IP}/pump/on`, {
      method: 'GET',
      mode: 'cors',
      timeout: 5000
    });

    if (response.ok) {
      currentPumpState = 'ON';
      document.getElementById('pump-status').textContent = 'ON';
      console.log('✅ Pump turned ON');
    }
  } catch (error) {
    console.error('Failed to turn pump on:', error);
  }
}

async function pumpOff() {
  

  try {
    const response = await fetch(`http://${esp32IP}/pump/off`, {
      method: 'GET',
      mode: 'cors',
      timeout: 5000
    });

    if (response.ok) {
      currentPumpState = 'OFF';
      document.getElementById('pump-status').textContent = 'OFF';
      console.log('✅ Pump turned OFF');
    }
  } catch (error) {
    console.error('Failed to turn pump off:', error);
  }
}

async function autoMode() {
  

  try {
    const response = await fetch(`http://${esp32IP}/mode/auto`, {
      method: 'GET',
      mode: 'cors',
      timeout: 5000
    });

    if (response.ok) {
      currentMode = 'AUTO';
      document.getElementById('mode-status').textContent = 'AUTO';
      console.log('✅ Mode set to AUTO');
    }
  } catch (error) {
    console.error('Failed to set AUTO mode:', error);
  }
}

async function manualMode() {
  

  try {
   const response = await fetch(`http://${esp32IP}/mode/manual`, {
      method: 'GET',
      mode: 'cors',
      timeout: 5000
    });

    if (response.ok) {
      currentMode = 'MANUAL';
      document.getElementById('mode-status').textContent = 'MANUAL';
      console.log('✅ Mode set to MANUAL');
    }
  } catch (error) {
    console.error('Failed to set MANUAL mode:', error);
  }
}

// ═════════════════════════════════════════════════════════════════
// SENSOR DATA UI UPDATES
// ═════════════════════════════════════════════════════════════════

function updateSensorUI(data) {
  // Moisture
  if (data.moisture !== undefined) {
    const moisturePercent = Math.min(100, data.moisture);
    document.getElementById('moisture').textContent = `${data.moisture}%`;
    document.getElementById('progress-bar').style.width = `${moisturePercent}%`;

    if (data.moisture < 30) {
      document.getElementById('soil-status').textContent = 'Dry - Water Needed 💧';
    } else if (data.moisture < 60) {
      document.getElementById('soil-status').textContent = 'Moist - Good 🌱';
    } else {
      document.getElementById('soil-status').textContent = 'Wet - Monitor 💦';
    }
  }

  // Temperature
  if (data.temperature !== undefined) {
    document.getElementById('temperature').textContent = `${data.temperature}°C`;
  }

  // Humidity
  if (data.humidity !== undefined) {
    document.getElementById('humidity').textContent = `${data.humidity}%`;
  }

  // CO2
  if (data.co2 !== undefined) {
    document.getElementById('co2').textContent = `${data.co2} ppm`;
  }

  // Oxygen
  if (data.oxygen !== undefined) {
    document.getElementById('oxygen').textContent = `${data.oxygen}%`;
  }

  // Pump Status
  if (data.pump !== undefined) {
    document.getElementById('pump-status').textContent = data.pump ? 'ON' : 'OFF';
  }

  // Mode
  if (data.mode !== undefined) {
    document.getElementById('mode-status').textContent = data.mode.toUpperCase();
  }

  // Plant Health
  updatePlantHealth(data);

  // Carbon Credits
  updateCarbonScore(data);
}

function updatePlantHealth(data) {
  const moisture = data.moisture || 50;
  const temperature = data.temperature || 20;
  const humidity = data.humidity || 50;

  let healthStatus = 'HEALTHY 🌿';
  if (moisture < 20 || moisture > 80) healthStatus = 'NEEDS ATTENTION ⚠️';
  if (temperature < 10 || temperature > 35) healthStatus = 'TEMPERATURE ALERT 🔥';

  document.getElementById('health').textContent = healthStatus;
}

function updateCarbonScore(data) {
  const oxygen = data.oxygen || 0;
  const co2Reduction = Math.min(100, (data.co2 || 400) / 400 * 100);
  const carbonScore = Math.round((oxygen + co2Reduction) / 2);

  document.getElementById('carbon-score').textContent = `${carbonScore}%`;
}

// ═════════════════════════════════════════════════════════════════
// ML PREDICTIONS
// ═════════════════════════════════════════════════════════════════

async function getPrediction() {
  try {
    const response = await fetch(ML_PREDICTION_URL);
    if (!response.ok) {
      console.error('Prediction error:', response.status);
      return;
    }

    const data = await response.json();
    
    if (data.error) {
      document.getElementById('prediction-status').textContent = 'Error: ' + data.error;
      return;
    }

    document.getElementById('prediction-status').textContent = data.prediction || 'Analyzing...';
    document.getElementById('prediction-moisture').textContent = 
      `${data.predicted_moisture}%` || '---';

    console.log('Prediction:', data);

  } catch (error) {
    console.error('Failed to get prediction:', error);
    document.getElementById('prediction-status').textContent = 'Offline 🔴';
  }
}

// ═════════════════════════════════════════════════════════════════
// WEATHER API
// ═════════════════════════════════════════════════════════════════

let statesData = {};
let citiesData = {};

async function loadStatesAndCities() {
  try {
    const statesResponse = await fetch('india_states.json');
    const citiesResponse = await fetch('india_cities.json');

    statesData = await statesResponse.json();
    citiesData = await citiesResponse.json();

    // Populate state dropdown
    const stateSelect = document.getElementById('state-select');
    Object.keys(statesData).forEach(state => {
      const option = document.createElement('option');
      option.value = state;
      option.textContent = state;
      stateSelect.appendChild(option);
    });

  } catch (error) {
    console.error('Failed to load states/cities:', error);
  }
}

function loadCities() {
  const stateSelect = document.getElementById('state-select');
  const citySelect = document.getElementById('city-select');
  const selectedState = stateSelect.value;

  citySelect.innerHTML = '<option value="">Select City</option>';

  if (selectedState && citiesData[selectedState]) {
    citiesData[selectedState].forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      citySelect.appendChild(option);
    });
  }
}

async function loadWeather() {
  const stateSelect = document.getElementById('state-select');
  const citySelect = document.getElementById('city-select');
  const selectedCity = citySelect.value;

  if (!selectedCity) {
    alert('Please select a city');
    return;
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${selectedCity},IN&units=metric&appid=${WEATHER_API_KEY}`
    );

    if (!response.ok) {
      alert('City not found or API error');
      return;
    }

    const weatherData = await response.json();

    document.getElementById('weather-temp').textContent = 
      `${Math.round(weatherData.main.temp)}°C`;
    document.getElementById('weather-condition').textContent = 
      weatherData.weather[0].main;
    document.getElementById('weather-humidity').textContent = 
      `${weatherData.main.humidity}%`;

  } catch (error) {
    console.error('Failed to load weather:', error);
    alert('Failed to fetch weather data');
  }
}

function connectWebSocket() {

  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }

  if (!esp32IP) {
    console.log("ESP32 IP not available");
    return;
  }

  ws = new WebSocket(
    `ws://${esp32IP}:81/ws`
  );

  ws.onopen = () => {
    console.log("WEBSOCKET CONNECTED");
  };

  ws.onmessage = (event) => {

    const data = JSON.parse(event.data);

    console.log("WS DATA:", data);

    updateSensorUI(data);

    if (currentMode === 'AUTO') {
      handleAutoModeLogic(data);
    }
  };

 ws.onclose = () => {

  console.log("WEBSOCKET CLOSED");

  setTimeout(() => {

    console.log("RECONNECTING...");

    connectWebSocket();

  }, 3000);
};

  ws.onerror = (err) => {
    console.log("WEBSOCKET ERROR", err);
  };
}
// ═════════════════════════════════════════════════════════════════
// POLLING & LIFECYCLE
// ═════════════════════════════════════════════════════════════════

function startPolling() {

  connectWebSocket();

  getPrediction();

  pollingInterval = setInterval(() => {

    getPrediction();

  }, POLLING_INTERVAL);

  console.log("WebSocket started");
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  console.log('Polling stopped');
}

// ═════════════════════════════════════════════════════════════════
// UI HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════

function updateBTStatus(message, elementId) {
  const element = document.getElementById(elementId);
  if (element) element.textContent = message;
}

function updateWiFiStatus(message, elementId) {
  const element = document.getElementById(elementId);
  if (element) element.textContent = message;
}

// ═════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  console.log('🌿 SMARTPOT App Initializing...');

  // Populate saved ESP32 IP in input field
  const inputField = document.getElementById('esp32-ip');
  if (inputField && esp32IP) {
    inputField.value = esp32IP;
    console.log(`✅ Loaded ESP32 IP: ${esp32IP}`);
  }

  // Load states and cities for weather
  loadStatesAndCities();

  // Start polling if we have ESP32 IP
  if (esp32IP) {
    console.log('📡 Starting sensor polling...');
    startPolling();
  } else {
    console.log('⚠️  No ESP32 IP configured. Please set IP address first.');
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
  stopPolling();
  if (bluetoothDevice) bluetoothDevice.gatt.disconnect();
});
