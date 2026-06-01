// ─────────────────────────────
// SMARTPOT FINAL ESP32 CODE
// ─────────────────────────────

#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <NimBLEDevice.h>
#include <DHT.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

AsyncWebServer asyncServer(81);
AsyncWebSocket ws("/ws");
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
#define DHTPIN 4
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);
#define SOIL_PIN 34
#define PUMP_PIN 26

// ─────────────────────────────
// WIFI
// ─────────────────────────────
String ssid = "";
String password = "";
const char* mqtt_server =
"56c32aa0c6ec4531a7e02845ec31d64c.s1.eu.hivemq.cloud";

const int mqtt_port = 8883;

const char* mqtt_user = "doctorplant";

const char* mqtt_password = "Doctorplant1";

// ─────────────────────────────
// WEB SERVER
// ─────────────────────────────
WebServer server(80);


// ─────────────────────────────
// BLE UUIDS
// ─────────────────────────────
#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab"
#define CHARACTERISTIC_UUID "abcdefab-1234-5678-1234-abcdefabcdef"


// ─────────────────────────────
// BLE CHARACTERISTIC
// ─────────────────────────────
NimBLECharacteristic* pCharacteristic;


// ─────────────────────────────
// VARIABLES
// ─────────────────────────────
bool serverStarted = false;

float temperature = 25.0;
float humidity = 60.0;

int moisture = 2400;
int co2 = 600;
int oxygen = 21;

String pumpStatus = "OFF";
String modeStatus = "AUTO";

// AUTO MODE THRESHOLDS (analog values 0-4095)
// Moisture sensors typically: HIGH ADC = DRY, LOW ADC = WET
const int DRY_THRESHOLD = 3500;      // Pump ON when moisture > this (dry soil)
const int WET_THRESHOLD = 2500;      // Pump OFF when moisture < this (wet soil)
unsigned long lastAutoCheckTime = 0;
const unsigned long AUTO_CHECK_INTERVAL = 5000; // Check every 5 seconds


// ─────────────────────────────
// SERVER CALLBACKS
// ─────────────────────────────
class ServerCallbacks :
  public NimBLEServerCallbacks {

    void onConnect(
  NimBLEServer* pServer,
  NimBLEConnInfo& connInfo
) override
{
  Serial.println("=== CONNECT CALLBACK FIRED ===");
  Serial.println("BLE CLIENT CONNECTED");

  if(pCharacteristic){
    pCharacteristic->notify();
  }
}

  void onDisconnect(
  NimBLEServer* pServer,
  NimBLEConnInfo& connInfo,
  int reason
) override
{
  Serial.println("BLE CLIENT DISCONNECTED");

  NimBLEDevice::startAdvertising();

  Serial.println("BLE ADVERTISING RESTARTED");
}
};


// ─────────────────────────────
// START WEB SERVER
// ─────────────────────────────
void startServer(){

Serial.println("=== STARTSERVER CALLED ===");
Serial.println("=== STARTSERVER CALLED ===");
  if(serverStarted)
    return;
    server.enableCORS(true);

  // SENSOR DATA

  server.on(
    "/data",
    [](){

     temperature = dht.readTemperature();
humidity = dht.readHumidity();

if (isnan(temperature))
  temperature = 0;

if (isnan(humidity))
  humidity = 0;
Serial.print("TEMP: ");
Serial.println(temperature);

Serial.print("HUM: ");
Serial.println(humidity);
moisture =
  analogRead(SOIL_PIN);

      co2 =
        random(500, 1500);

      oxygen =
        random(18, 22);

      String json = "{";

      json +=
        "\"temperature\":"
        + String(temperature)
        + ",";

      json +=
        "\"humidity\":"
        + String(humidity)
        + ",";

      json +=
        "\"moisture\":"
        + String(moisture)
        + ",";

      json +=
        "\"co2\":"
        + String(co2)
        + ",";

      json +=
        "\"oxygen\":"
        + String(oxygen)
        + ",";

      json +=
        "\"pump\":\""
        + pumpStatus
        + "\",";

      json +=
        "\"mode\":\""
        + modeStatus
        + "\"";

      json += "}";
      ws.textAll(json);
      server.send(
        200,
        "application/json",
        json
      );
    }
  );

  // PUMP ON

  server.on(
    "/pump/on",
    [](){

      pumpStatus = "ON";
      digitalWrite(PUMP_PIN, LOW);  // LOW = ON
      lastAutoCheckTime = millis();

      Serial.println("[HTTP] PUMP ON");

      String json = "{\"status\":\"OK\",\"pump\":\"ON\",\"message\":\"Pump activated\"}";
      server.send(200, "application/json", json);
    }
  );

  // PUMP OFF

  server.on(
    "/pump/off",
    [](){

      pumpStatus = "OFF";
      digitalWrite(PUMP_PIN, HIGH);  // HIGH = OFF
      lastAutoCheckTime = millis();

      Serial.println("[HTTP] PUMP OFF");

      String json = "{\"status\":\"OK\",\"pump\":\"OFF\",\"message\":\"Pump deactivated\"}";
      server.send(200, "application/json", json);
    }
  );

  // AUTO MODE

  server.on(
    "/mode/auto",
    [](){

      modeStatus = "AUTO";
      lastAutoCheckTime = millis();

      Serial.println("[HTTP] MODE: AUTO");

      String json = "{\"status\":\"OK\",\"mode\":\"AUTO\",\"message\":\"Switched to AUTO mode\"}";
      server.send(200, "application/json", json);
    }
  );

  // MANUAL MODE

  server.on(
    "/mode/manual",
    [](){

      modeStatus = "MANUAL";

      Serial.println("[HTTP] MODE: MANUAL");

      String json = "{\"status\":\"OK\",\"mode\":\"MANUAL\",\"message\":\"Switched to MANUAL mode\"}";
      server.send(200, "application/json", json);
    }
  );
  ws.onEvent(onWsEvent);

asyncServer.addHandler(&ws);

asyncServer.begin();

Serial.println("WEBSOCKET READY");
  server.begin();

  serverStarted = true;

  Serial.println(
    "HTTP SERVER READY"
  );
}


// ─────────────────────────────
// BLE CALLBACKS
// ─────────────────────────────
class MyCallbacks :
  public NimBLECharacteristicCallbacks {

    void onWrite(
  NimBLECharacteristic* pCharacteristic,
  NimBLEConnInfo& connInfo
) override
{
  Serial.println("=== WRITE CALLBACK FIRED ===");

  std::string value =
    pCharacteristic->getValue();

  String wifiData = String(value.c_str());

  Serial.print("ONWRITE len: ");
  Serial.println(value.length());

  String echo = "RECV:" + wifiData;
  pCharacteristic->setValue(echo.c_str());
  pCharacteristic->notify();

  Serial.println("Echoed RECV");

        int commaIndex =
          wifiData.indexOf(',');

        if(commaIndex > 0){

          String ssid_local =
            wifiData.substring(
              0,
              commaIndex
            );

          String password_local =
            wifiData.substring(
              commaIndex + 1
            );

          // Launch a FreeRTOS task to perform WiFi connection so we don't block the BLE callback
          struct WifiParams {
            String ssid;
            String password;
            NimBLECharacteristic* ch;
          };

          WifiParams* params = new WifiParams{ssid_local, password_local, pCharacteristic};

          xTaskCreate(
            [](void* pv) {
              WifiParams* wp = (WifiParams*)pv;
              Serial.println("CONNECT TASK START");

              WiFi.begin(wp->ssid.c_str(), wp->password.c_str());

              int timeout = 0;
              while(WiFi.status() != WL_CONNECTED && timeout < 20){
                delay(1000);
                Serial.print('.');
                timeout++;
              }

              if(WiFi.status() == WL_CONNECTED){

    Serial.println("");
    Serial.println("WIFI CONNECTED");

    String ip = WiFi.localIP().toString();
    Serial.println(ip);

    if(MDNS.begin("doctorplant")){
        Serial.println("mDNS Started");
        Serial.println("http://doctorplant.local");
    }

    startServer();

//connectMQTT();

    String response = "IP:" + ip;
    //wp->ch->setValue(response.c_str());
    //wp->ch->notify();

    Serial.println("Notified client with IP");
}else {
                Serial.println("");
                Serial.println("WIFI FAILED");
               // wp->ch->setValue("FAILED");
                //wp->ch->notify();
                Serial.println("Notified client with FAILED");
              }

              delete wp;
              vTaskDelete(NULL);
            },
            "wifiConnect",
            4096,
            params,
            1,
            NULL
          );

        }
                else{
          Serial.println("Received write but comma not found — ignoring");
        }
      }
};
void onWsEvent(
  AsyncWebSocket *server,
  AsyncWebSocketClient *client,
  AwsEventType type,
  void *arg,
  uint8_t *data,
  size_t len
){

  if(type == WS_EVT_CONNECT){

    Serial.print("WS CONNECTED: ");
    Serial.println(client->id());

  }

  if(type == WS_EVT_DISCONNECT){

    Serial.print("WS DISCONNECTED: ");
    Serial.println(client->id());

  }
}
void mqttCallback(
  char* topic,
  byte* payload,
  unsigned int length
)
{

  String message = "";

  for(int i=0;i<length;i++){
    message += (char)payload[i];
  }

  Serial.print("MQTT [");
  Serial.print(topic);
  Serial.print("] ");
  Serial.println(message);

}
void connectMQTT(){

  espClient.setInsecure();

  mqttClient.setServer(
    mqtt_server,
    mqtt_port
  );

  mqttClient.setCallback(
    mqttCallback
  );

  while(!mqttClient.connected()){

    Serial.println(
      "Connecting MQTT..."
    );

    if(
      mqttClient.connect(
        "DoctorPlantESP32",
        mqtt_user,
        mqtt_password
      )
    ){

      Serial.println(
        "MQTT CONNECTED"
      );

      mqttClient.subscribe(
        "doctorplant/pump"
      );

      mqttClient.subscribe(
        "doctorplant/mode"
      );

    }else{

      Serial.print(
        "MQTT FAILED rc="
      );

      Serial.println(
        mqttClient.state()
      );

      delay(5000);
    }
  }
}

// ─────────────────────────────
// SETUP
// ─────────────────────────────
void setup(){

  Serial.begin(115200);
  dht.begin();

pinMode(PUMP_PIN, OUTPUT);

// Relay OFF initially
digitalWrite(PUMP_PIN, HIGH);

  Serial.println("");
  Serial.println(
    "SMARTPOT STARTING..."
  );
  
  // BLE INIT

  NimBLEDevice::init(
    "DoctorPlant_BT"
  );

  NimBLEDevice::setSecurityAuth(
    false,
    false,
    false
  );

  NimBLEDevice::setPower(
    ESP_PWR_LVL_P9
  );

  // SERVER

  NimBLEServer* pServer =
    NimBLEDevice::createServer();

  pServer->setCallbacks(
    new ServerCallbacks()
  );

  // SERVICE

  NimBLEService* pService =
    pServer->createService(
      SERVICE_UUID
    );

  // CHARACTERISTIC

  pCharacteristic =
    pService->createCharacteristic(

      CHARACTERISTIC_UUID,

      NIMBLE_PROPERTY::READ   |
      NIMBLE_PROPERTY::WRITE  |
      NIMBLE_PROPERTY::WRITE_NR |
      NIMBLE_PROPERTY::NOTIFY
    );

  pCharacteristic->setCallbacks(
    new MyCallbacks()
  );

  pCharacteristic->setValue(
    "READY"
  );
  Serial.println("Characteristic created with READ | WRITE | WRITE_NR | NOTIFY");

  pService->start();

  // ADVERTISING

  // ADVERTISING

NimBLEAdvertising* pAdvertising =
  NimBLEDevice::getAdvertising();

NimBLEAdvertisementData advData;

advData.setName(
  "DoctorPlant_BT"
);

advData.addServiceUUID(
  SERVICE_UUID
);

pAdvertising->setAdvertisementData(
  advData
);

pAdvertising->start();

  Serial.println(
    "BLE READY"
  );
}


// ─────────────────────────────
// LOOP
// ─────────────────────────────
void loop(){

  if(
  WiFi.status() ==
  WL_CONNECTED
){

  //if(
   // !mqttClient.connected()
  //){
    //connectMQTT();
  //}

  //mqttClient.loop();

  server.handleClient();
}
  static unsigned long lastWifiCheck = 0;

if (millis() - lastWifiCheck > 10000) {
    lastWifiCheck = millis();

    Serial.print("WiFi Status: ");
    Serial.println(WiFi.status());

    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
}

  // AUTO MODE with HYSTERESIS
  if(modeStatus.equals("AUTO")){
    
    unsigned long currentTime = millis();
    
    // Check every AUTO_CHECK_INTERVAL to avoid rapid switching
    if(currentTime - lastAutoCheckTime >= AUTO_CHECK_INTERVAL){
      
      moisture = analogRead(SOIL_PIN);
      lastAutoCheckTime = currentTime;

      Serial.print("[AUTO] Soil Moisture: ");
      Serial.print(moisture);
      Serial.print(" | Pump: ");
      Serial.println(pumpStatus);

      // Hysteresis logic: prevents rapid on/off switching
      if(moisture > DRY_THRESHOLD && pumpStatus.equals("OFF")){
        // Soil is DRY - Turn pump ON
        digitalWrite(PUMP_PIN, LOW);
        pumpStatus = "ON";
        Serial.println("[AUTO] Soil DRY -> Pump ON");
      }
      else if(moisture < WET_THRESHOLD && pumpStatus.equals("ON")){
        // Soil is WET - Turn pump OFF
        digitalWrite(PUMP_PIN, HIGH);
        pumpStatus = "OFF";
        Serial.println("[AUTO] Soil WET -> Pump OFF");
      }
    }
  }
static unsigned long lastWsSend = 0;

if (
    WiFi.status() == WL_CONNECTED &&
    millis() - lastWsSend > 5000
) {

    lastWsSend = millis();

    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();

    int moistureValue = analogRead(SOIL_PIN);

    String json = "{";
    json += "\"temperature\":" + String(temp, 1) + ",";
    json += "\"humidity\":" + String(hum, 1) + ",";
    json += "\"moisture\":" + String(moistureValue) + ",";
    json += "\"co2\":1132,";
    json += "\"oxygen\":18,";
    json += "\"pump\":\"" + pumpStatus + "\",";
    json += "\"mode\":\"" + modeStatus + "\"";
    json += "}";

    ws.textAll(json);

    Serial.println("WS SENT");
    Serial.println(json);
}
  delay(100);
}