#include <Arduino.h> 
#include <map>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
WebServer webServer(80);
WebSocketsServer webSocket = WebSocketsServer(81);
#include "homePage.h"
#include "fingerPage.h"
#include "userPage.h"
#include "loginPage.h"
#include "wifiPage.h"
#include <Adafruit_Fingerprint.h>
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&Serial2);
int nextFingerID; //ID tiếp theo để lưu trữ vân tay
bool exitState = 0;
#define buzzer 13
#define btnSetup 0
#define btnMakeSheet 15
bool btnMakeSheetState=HIGH;
int runMode = 0;
unsigned long timePressBtn = millis();
unsigned long timeDelay = millis();
String ssid = ""; // Cấu hình Wi-Fi qua trang thiết lập của ESP32.
String pass = "";
String maHocSinh;
String activeClassId = "DEFAULT";
int rosterVersion = 0;
String activeSessionId;
String cloudSessionsJson="{}";
String deviceMode="LOP";
String activePeriod;
String activeLateAfter;
const String DEVICE_ID = "ESP01"; // Phải trùng mã thiết bị đã cấp trên dashboard.
const String DEVICE_KEY = "THAY_BANG_KHOA_THIET_BI"; // Khóa chỉ hiện một lần khi cấp trên dashboard.
String attendanceStatus;
bool attendanceBusy = false;
String activeCommandId;
String lastCommandId;
bool enrollmentStored = false;
String localSessionToken;
bool webStarted = false;
bool setupApStarted = false;
unsigned long wifiStartedAt = 0;
unsigned long restartAt = 0;
std::vector<int> fingerIDTemp;
bool getUserList=0;
String Web_App_URL = "https://script.google.com/macros/s/THAY_BANG_DEPLOYMENT_ID/exec";
const unsigned long GOOGLE_SYNC_INTERVAL = 60000; // Tự đồng bộ mỗi 60 giây.
const unsigned long GOOGLE_RETRY_INTERVAL = 15000;
const unsigned long CONTROL_POLL_INTERVAL = 10000;
unsigned long lastControlPoll = 0;
unsigned long lastGoogleSync = 0;
unsigned long lastGoogleSyncAttempt = 0;
bool readClassRoster(bool showStatus);
bool fetchSession();
bool pollCloudControl();
bool apiPost(DynamicJsonDocument &request, DynamicJsonDocument &response);
bool sendCommandStatus(const String &id, const String &status, const String &message);
bool deleteFingerprintForCode(const String &key);
bool requireLocalLogin();
String studentKey(String code);
struct student{
  char code[9];
  char name[30];
};

#include <LCDI2C_Multilingual.h>
LCDI2C_Vietnamese lcd(0x27, 16, 2);

void setup() {
  Serial.begin(115200);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(1,0);
  lcd.print("Đang thiết lập");
  lcd.setCursor(3,1);
  lcd.print("hệ thống!");

  pinMode(buzzer,OUTPUT);
  pinMode(btnSetup,INPUT_PULLUP);
  pinMode(btnMakeSheet,INPUT_PULLUP);
  attachInterrupt(btnSetup,handleBtnSetup,FALLING);
  Serial2.begin(57600, SERIAL_8N1, 16, 17);
  finger.begin(57600);
  if (finger.verifyPassword()) {
    Serial.println("Found fingerprint sensor!");
    finger.getParameters();
    if (finger.getTemplateCount() == FINGERPRINT_OK) {
      Serial.print("Number of stored fingerprints: ");
      Serial.print(finger.templateCount);
      Serial.println("/"+String(finger.capacity));
    } else {
      Serial.println("Error reading template count.");
    }
    readFingerID();
  } else {
    Serial.println("Did not find fingerprint sensor :(");
    while (1) { delay(1); }
  }

  // Khởi tạo LittleFS
  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS Mount Failed");
    return;
  }
  // Tạo tệp JSON nếu chưa tồn tại
  if (!LittleFS.exists("/login.json")) {
    File file = LittleFS.open("/login.json", "w");
    if (!file) {
      Serial.println("Failed to create file");
      return;
    }
    String initialPassword = String(esp_random(), HEX) + String(esp_random(), HEX)
                           + String(esp_random(), HEX) + String(esp_random(), HEX);
    DynamicJsonDocument initialLogin(256);
    initialLogin["admin"] = initialPassword;
    serializeJson(initialLogin, file);
    file.close();
    Serial.println("Tai khoan cuc bo: admin");
    Serial.println("Mat khau lan dau: " + initialPassword);
  }
  // Tạo tệp JSON nếu chưa tồn tại
  if (!LittleFS.exists("/userlist.json")) {
    File file = LittleFS.open("/userlist.json", "w");
    if (!file) {
      Serial.println("Failed to create file");
      return;
    }
    file.print("{}"); // Tạo một mảng JSON rỗng
    file.close();
  }
  if (LittleFS.exists("/config.json")) {
    DynamicJsonDocument cfg(512);
    if (!deserializeJson(cfg, readFile("/config.json"))) {
      String saved = cfg["activeClassId"] | "DEFAULT";
      if (saved.length()) activeClassId = saved;
      rosterVersion = cfg["rosterVersion"] | 0;
    }
  }
  if (LittleFS.exists("/wifi.json")) {
    DynamicJsonDocument wifiCfg(512);
    if (!deserializeJson(wifiCfg, readFile("/wifi.json"))) {
      String savedSsid = wifiCfg["ssid"] | "";
      String savedPass = wifiCfg["password"] | "";
      if (savedSsid.length()) { ssid = savedSsid; pass = savedPass; }
    }
  }
  // String json = R"json({"HS01":"Nguyễn Văn A","HS02":"Lê Thị B","HS03":"Huỳnh Thị B"})json";
  // writeFile("/userlist.json", json);

  // Tạo tệp JSON nếu chưa tồn tại
  if (!LittleFS.exists("/fingerlist.json")) {
    File file = LittleFS.open("/fingerlist.json", "w");
    if (!file) {
      Serial.println("Failed to create file");
      return;
    }
    file.print("{}"); // Tạo một mảng JSON rỗng
    file.close();
  }
  //json = R"json({"1":"HS01", "2":"HS01", "3":"HS02"})json";
  //writeFile("/fingerlist.json", json);

  // Tạo tệp JSON nếu chưa tồn tại
  if (!LittleFS.exists("/fingeridtemp.json")) {
    File file = LittleFS.open("/fingeridtemp.json", "w");
    if (!file) {
      Serial.println("Failed to create file");
      return;
    }
    file.print("[]"); // Tạo một mảng JSON rỗng
    file.close();
  }
  String json = readFile("/fingeridtemp.json");
  Serial.println("Finger id temp:"+json);
  DynamicJsonDocument doc(8192);
  DeserializationError error = deserializeJson(doc, json);
  if (error) {
    Serial.print(F("deserializeJson() failed: "));
    Serial.println(error.f_str());
    return;
  }
  JsonArray jsonArray = doc.as<JsonArray>();
  for (JsonVariant v : jsonArray) {
    fingerIDTemp.push_back(v.as<int>()); //Nạp các id đã xóa vào vector
  }

  WiFi.disconnect(true, true);
  delay(500);
  WiFi.mode(WIFI_STA);
  WiFi.onEvent(WiFiEvent);
  WiFi.begin(ssid, pass);
  WiFi.setAutoReconnect(true);
  wifiStartedAt=millis();
}

void loop() {
  if(restartAt && millis()>=restartAt) ESP.restart();
  if(WiFi.status()==WL_CONNECTED && setupApStarted) {
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    setupApStarted=false;
  }
  if(WiFi.status()!=WL_CONNECTED && !setupApStarted && millis()-wifiStartedAt>20000) {
    char setupPassword[9];
    snprintf(setupPassword,sizeof(setupPassword),"%08X",esp_random());
    WiFi.mode(WIFI_AP_STA);
    setupApStarted=WiFi.softAP("DiemDanh-Setup",setupPassword);
    if(setupApStarted) {
      Serial.print("Setup Wi-Fi AP: DiemDanh-Setup, password: "); Serial.println(setupPassword);
      lcd.clear(); lcd.setCursor(0,0); lcd.print("DiemDanh-Setup");
      lcd.setCursor(0,1); lcd.print(setupPassword);
    }
  }
  if(!webStarted && (WiFi.status()==WL_CONNECTED || setupApStarted)) {
    setupWebserver();
    webStarted=true;
  }
  if(digitalRead(btnMakeSheet)==LOW){
    if(btnMakeSheetState==HIGH){
      // The physical button starts a session for the active class.
      DynamicJsonDocument req(512), res(1024);
      fetchSession(); // Quyền mở/đóng buổi thuộc dashboard giáo viên.
      delay(200);
      btnMakeSheetState=LOW;
    }
  }else{
    btnMakeSheetState=HIGH;
  }

  if(WiFi.status() == WL_CONNECTED){
    unsigned long now = millis();
    if(lastControlPoll==0 || now-lastControlPoll>=CONTROL_POLL_INTERVAL){
      lastControlPoll=now;
      pollCloudControl();
    }
    if(getUserList==0 && (lastGoogleSyncAttempt==0 || now-lastGoogleSyncAttempt>=GOOGLE_RETRY_INTERVAL)){
      lastGoogleSyncAttempt=now;
      lcd.clear();
      lcd.setCursor(0,0);
      lcd.print("IP kết nối web:");
      lcd.setCursor(0,1);
      lcd.print(WiFi.localIP().toString());
      delay(3000);
      if(readClassRoster(true)){
        getUserList=1;
        lastGoogleSync=millis();
        fetchSession();
      }
    }else if(getUserList==1 && runMode==0 && now-lastGoogleSync>=GOOGLE_SYNC_INTERVAL){
      lastGoogleSyncAttempt=now;
      if(readClassRoster(false)){
        lastGoogleSync=millis();
      }
    }
  }
  webServer.handleClient();
  webSocket.loop();

  if(digitalRead(btnSetup)==LOW){
    Serial.println("Push 5 second for clear finger!");
    delay(1000);
    if(millis()-timePressBtn>5000){
      beep(5,80);
      finger.emptyDatabase();
      Serial.println("Delete fingerprint success!");
      writeFile("/fingeridtemp.json","[]");
      writeFile("/fingerlist.json","{}");
      ESP.restart();
    }
  }else{
    if(runMode==1){
      enrollmentStored=false;
      getFingerprintEnroll();
      if(activeCommandId.length()) {
        sendCommandStatus(activeCommandId,enrollmentStored ? "DONE" : "FAILED",enrollmentStored ? "Đã lưu vân tay" : "Đăng ký thất bại hoặc đã hủy");
        activeCommandId="";
      }
      // Mỗi yêu cầu chỉ thử đăng ký một lần. Nếu thất bại hoặc vân tay
      // đã tồn tại thì quay về chế độ điểm danh, tránh lặp vô hạn.
      runMode=0;
      maHocSinh="";
    }else if(runMode==0){
      getFingerprintID();
    }
  }
}
//==========================================
//------------Chương trình con--------------
String studentKey(String code) {
  if(code.indexOf('|') >= 0) return code;
  return activeClassId + "|" + code;
}

bool apiPost(DynamicJsonDocument &request, DynamicJsonDocument &response) {
  if(WiFi.status()!=WL_CONNECTED || attendanceBusy) return false;
  attendanceBusy=true;
  request["deviceId"]=DEVICE_ID;
  request["deviceKey"]=DEVICE_KEY;
  String body;
  serializeJson(request,body);
  HTTPClient http;
  http.begin(Web_App_URL);
  http.setConnectTimeout(10000);
  http.setTimeout(20000);
  const char* redirectHeaders[] = {"Location"};
  http.collectHeaders(redirectHeaders,1);
  http.addHeader("Content-Type","application/json");
  int status=http.POST(body);
  String redirect=(status==302 || status==303) ? http.header("Location") : "";
  String payload=status==200 ? http.getString() : "";
  http.end();
  if(redirect.startsWith("https://script.googleusercontent.com/")) {
    HTTPClient result;
    result.begin(redirect);
    result.setConnectTimeout(10000);
    result.setTimeout(20000);
    status=result.GET();
    payload=status==200 ? result.getString() : "";
    result.end();
  }
  attendanceBusy=false;
  if(status!=200 || deserializeJson(response,payload) || !response["ok"].as<bool>()) {
    attendanceStatus=response["error"] | "Lỗi kết nối Google";
    Serial.println(attendanceStatus);
    return false;
  }
  attendanceStatus="OK";
  return true;
}

bool sendCommandStatus(const String &id, const String &status, const String &message) {
  DynamicJsonDocument req(512), res(512);
  req["action"]="commandUpdate";
  req["commandId"]=id;
  req["status"]=status;
  req["message"]=message;
  return apiPost(req,res);
}

bool fetchSession() {
  DynamicJsonDocument req(512),doc(16384);
  req["action"]="session";req["classId"]=activeClassId;
  if(!apiPost(req,doc))return false;
  activeSessionId=doc["session"]["sessionId"] | "";
  activePeriod=doc["session"]["period"] | "";
  activeLateAfter=doc["session"]["lateAfter"] | "";
  cloudSessionsJson="";serializeJson(doc["sessions"],cloudSessionsJson);
  return true;
}

bool pollCloudControl() {
  if(WiFi.status()!=WL_CONNECTED || attendanceBusy || runMode==1) return false;
  DynamicJsonDocument req(16384);
  req["action"]="control";req["currentClass"]=activeClassId;
  req["currentVersion"]=rosterVersion;
  // Chỉ đồng bộ số ngón theo học sinh; mẫu vân tay vẫn nằm trong cảm biến.
  DynamicJsonDocument fingerMap(32768);
  if(!deserializeJson(fingerMap,readFile("/fingerlist.json"))) {
    JsonObject counts=req.createNestedObject("fingerprints");
    for(JsonPair kv:fingerMap.as<JsonObject>()) {
      String key=kv.value().as<String>();if(key.indexOf('|')<0)key="DEFAULT|"+key;
      counts[key]=(counts[key] | 0)+1;
    }
    if(req.overflowed() || counts.size()>200)req.remove("fingerprints");
  }
  req["message"]=attendanceStatus.length()?attendanceStatus:"Đã kết nối";
  DynamicJsonDocument doc(16384);
  if(!apiPost(req,doc))return false;
  String desired=doc["classId"] | "";
  deviceMode=doc["mode"] | "LOP";
  int desiredVersion=doc["rosterVersion"] | 0;
  if(!desired.length() || desired.length()>32 || desired.indexOf('|')>=0) return false;
  if(desired!=activeClassId || desiredVersion!=rosterVersion) {
    String previous=activeClassId;
    activeClassId=desired;
    if(!readClassRoster(false)) { activeClassId=previous; return false; }
    DynamicJsonDocument cfg(512);
    cfg["activeClassId"]=activeClassId;
    cfg["rosterVersion"]=rosterVersion;
    String config; serializeJson(cfg,config);
    writeFile("/config.json",config);
    getUserList=1;
  }
  activeSessionId=doc["session"]["sessionId"] | "";
  activePeriod=doc["session"]["period"] | "";
  activeLateAfter=doc["session"]["lateAfter"] | "";
  cloudSessionsJson="";serializeJson(doc["sessions"],cloudSessionsJson);
  JsonVariant command=doc["command"];
  String commandId=command["id"] | "";
  if(commandId.length() && commandId!=lastCommandId && runMode!=1) {
    lastCommandId=commandId;
    String code=command["code"] | "";
    String action=command["action"] | "";
    String commandClass=command["classId"] | activeClassId;
    String key=commandClass+"|"+code;
    if(action=="ENROLL" && getName(key).length()) {
      maHocSinh=key;
      activeCommandId=commandId;
      runMode=1;
      sendCommandStatus(commandId,"RUNNING","Đang chờ quét hai lần trên cảm biến");
    } else if(action=="DELETE") {
      bool deleted=deleteFingerprintForCode(key);
      sendCommandStatus(commandId,deleted ? "DONE" : "FAILED",deleted ? "Đã xóa vân tay" : "Không tìm thấy hoặc không xóa được vân tay");
    } else sendCommandStatus(commandId,"FAILED","Học sinh hoặc lệnh không hợp lệ");
  }
  return true;
}

bool readClassRoster(bool showStatus) {
  if(WiFi.status()!=WL_CONNECTED) return false;
  DynamicJsonDocument req(512);req["action"]="read";req["classId"]=activeClassId;
  DynamicJsonDocument response(65536);
  if(!apiPost(req,response) || !response["students"].is<JsonArray>()) {
    attendanceStatus=response["error"] | "Không đọc được lớp";
    return false;
  }
  DynamicJsonDocument roster(32768);
  DynamicJsonDocument ids(16384);
  for(JsonObject s : response["students"].as<JsonArray>()) {
    String code=s["code"] | "";
    String name=s["name"] | "";
    String id=s["studentId"] | "";
    String studentClass=s["classId"] | activeClassId;
    if(code.length() && name.length() && id.length()) {
      String key=studentClass+"|"+code;
      roster[key]=name;
      ids[key]=id;
    }
  }
  if(roster.overflowed() || ids.overflowed()) { attendanceStatus="Danh sách vượt bộ nhớ"; return false; }
  String json, idJson;
  serializeJson(roster,json);
  serializeJson(ids,idJson);
  if(!writeFile("/userlist.json",json)) return false;
  if(!writeFile("/studentids.json",idJson)) return false;
  rosterVersion=response["version"] | 0;
  if(showStatus) {
    lcd.clear(); lcd.setCursor(0,0); lcd.print(deviceMode=="CONG" ? "Cổng chung" : "Đã tải lớp:");
    lcd.setCursor(0,1); lcd.print(deviceMode=="CONG" ? String(roster.size())+" học sinh" : activeClassId);
  }
  return true;
}

String urlencode(String str) {
  String encodedString = "";
  char c;
  char code0;
  char code1;
  char code2;
  for (int i = 0; i < str.length(); i++) {
    c = str.charAt(i);
    if (c == ' ') {
      encodedString += '+';
    } else if (isalnum(c)) {
      encodedString += c;
    } else {
      code1 = (c & 0xf) + '0';
      if ((c & 0xf) > 9) {
        code1 = (c & 0xf) - 10 + 'A';
      }
      c = (c >> 4) & 0xf;
      code0 = c + '0';
      if (c > 9) {
        code0 = c - 10 + 'A';
      }
      code2 = '\0';
      encodedString += '%';
      encodedString += code0;
      encodedString += code1;
    }
    yield();
  }
  return encodedString;
}

void saveFingerIDTemp(){
  DynamicJsonDocument doc(8192);
  JsonArray jsonArray = doc.to<JsonArray>();
  for (int key : fingerIDTemp) {
    jsonArray.add(key);
  }
  String json="";
  serializeJson(doc, json);
  writeFile("/fingeridtemp.json",json);
  Serial.println(json);
}
String readFile(String path){
  // Đọc dữ liệu từ tệp
  String data="";
  File file = LittleFS.open(path, "r");
  if (!file) {
    Serial.println("Failed to open file for reading");
    return "";
  }
  while (file.available()) {
    data += char(file.read());
  }
  file.close();
  //Serial.println("Data:"+data);
  return data;
}

bool writeFile(String path, String str){
  File file = LittleFS.open(path, "w");
  if (!file) {
    Serial.println("Failed to open file for writing");
    return false;
  }
  file.println(str);
  file.close();
  return true;
}

void WiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("Connected To The WiFi Network");
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.print("Local ESP32 IP: ");
      Serial.println(WiFi.localIP());
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("Disconnected From WiFi Network");
      Serial.println("WiFi disconnect reason: " + String(info.wifi_sta_disconnected.reason));
      break;
    default:
      break;
  }
}

void setupWebserver(){
  const char *headers[]={"Cookie"};
  webServer.collectHeaders(headers,1);
  webServer.on("/",[]{
    if(!requireLocalLogin()) return;
    runMode=0; //Chế độ quét vân tay
    webServer.send(200, "text/html", homePage);
  });
  webServer.on("/wifi",HTTP_GET,[]{ if(!requireLocalLogin()) return; webServer.send(200,"text/html",wifiPage); });
  webServer.on("/wifi",HTTP_POST,[]{
    if(!requireLocalLogin()) return;
    String newSsid=webServer.arg("ssid"),newPass=webServer.arg("password");
    newSsid.trim();
    if(newSsid.length()==0 || newSsid.length()>32 || newPass.length()>63) { webServer.send(400,"text/plain","Thông tin Wi-Fi không hợp lệ"); return; }
    DynamicJsonDocument cfg(512);
    cfg["ssid"]=newSsid; cfg["password"]=newPass;
    String json; serializeJson(cfg,json);
    if(!writeFile("/wifi.json",json)) { webServer.send(500,"text/plain","Không lưu được cấu hình"); return; }
    webServer.send(200,"text/plain","Đã lưu. Thiết bị sẽ khởi động lại và kết nối Wi-Fi mới.");
    restartAt=millis()+1000;
  });
  webServer.on("/makeLog",HTTP_POST,[]{ webServer.send(403,"text/plain","Thao tác này do giáo viên thực hiện trên dashboard"); });
  webServer.on("/getStatus",[]{
    if(!requireLocalLogin()) return;
    DynamicJsonDocument doc(512);
    doc["classId"]=activeClassId;
    doc["sessionId"]=activeSessionId;
    doc["period"]=activePeriod;doc["lateAfter"]=activeLateAfter;doc["deviceId"]=DEVICE_ID;
    doc["mode"]=deviceMode;
    DynamicJsonDocument sessions(16384);deserializeJson(sessions,cloudSessionsJson);
    doc["openClasses"]=sessions.size();
    doc["sync"]=attendanceStatus;
    String json; serializeJson(doc,json);
    webServer.send(200,"application/json",json);
  });
  webServer.on("/getClasses",[]{
    if(!requireLocalLogin())return;
    DynamicJsonDocument doc(512);JsonArray classes=doc.createNestedArray("classes");JsonObject cl=classes.createNestedObject();cl["id"]=activeClassId;cl["name"]=activeClassId;
    String json;serializeJson(doc,json);webServer.send(200,"application/json",json);
  });
  webServer.on("/setClass",HTTP_POST,[]{ webServer.send(403,"text/plain","Thao tác này do giáo viên thực hiện trên dashboard"); });
  webServer.on("/closeSession",HTTP_POST,[]{ webServer.send(403,"text/plain","Thao tác này do giáo viên thực hiện trên dashboard"); });
  webServer.on("/fingerlist",[]{
    if(!requireLocalLogin()) return;
    lcd.clear();
    lcd.setCursor(2,0);
    lcd.print("Cài đặt dấu");
    lcd.setCursor(4,1);
    lcd.print("vân tay!");
    runMode=2; //Chế độ cài đặt vân tay
    webServer.send(200, "text/html", fingerPage);
  });
  webServer.on("/login",[]{
    webServer.send(200, "text/html", loginPage);
  });
  webServer.on("/logout",HTTP_POST,[]{
    if(!requireLocalLogin()) return;
    localSessionToken="";
    webServer.sendHeader("Set-Cookie","session=; Max-Age=0; HttpOnly; SameSite=Strict");
    webServer.send(200,"text/plain","OK");
  });
  webServer.on("/checkLogin",HTTP_POST,[]{
    String username = webServer.arg("username");
     String password = webServer.arg("password");
    String str="";
    DynamicJsonDocument doc(8192);
    String json = readFile("/login.json");
    DeserializationError error = deserializeJson(doc, json);
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.f_str());
      webServer.send(500,"text/plain","Lỗi dữ liệu đăng nhập");
      return;
    }
    JsonObject obj = doc.as<JsonObject>();
    bool hasTime = obj.containsKey(username);
    if(hasTime){
      str = doc[username].as<String>();
      if(str==password){
        str = "OK";
        localSessionToken=String(esp_random(),HEX)+String(esp_random(),HEX);
        webServer.sendHeader("Set-Cookie","session="+localSessionToken+"; Path=/; HttpOnly; SameSite=Strict");
      }else{
        str = "Tên đăng nhập hoặc mật khẩu không đúng!";
      }
    }else{
      str = "Tên đăng nhập hoặc mật khẩu không đúng!";
    }
    webServer.send(200, "text/plain", str);
  });
  webServer.on("/getLogin",[]{
    if(!requireLocalLogin()) return;
    DynamicJsonDocument doc(8192),names(8192);
    if(deserializeJson(doc,readFile("/login.json"))) { webServer.send(500,"text/plain","Lỗi dữ liệu đăng nhập"); return; }
    for(JsonPair kv:doc.as<JsonObject>()) names[kv.key()]=true;
    String json; serializeJson(names,json);
    webServer.send(200,"application/json",json);
  });
  webServer.on("/addLogin",HTTP_POST,[]{
    if(!requireLocalLogin()) return;
    String username = webServer.arg("username");
    String password = webServer.arg("password");
    if(username.length()==0 || username.length()>32 || password.length()<8 || password.length()>64) {
      webServer.send(400,"text/plain","Tên đăng nhập hoặc mật khẩu không hợp lệ (mật khẩu tối thiểu 8 ký tự)"); return;
    }
    DynamicJsonDocument doc(8192);
    String json = readFile("/login.json");
    DeserializationError error = deserializeJson(doc, json);
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.f_str());
      webServer.send(500,"text/plain","Lỗi dữ liệu đăng nhập");
      return;
    }
    doc[username] = password;
    json = "";
    serializeJson(doc, json);
    writeFile("/login.json",json);

    String str = "Đã thêm thành công!";
    webServer.send(200, "text/plain", str);
  });
  webServer.on("/deleteLogin",HTTP_POST,[]{
    if(!requireLocalLogin()) return;
    String username = webServer.arg("username");
    if(username=="admin") { webServer.send(400,"text/plain","Không thể xóa tài khoản admin"); return; }
    DynamicJsonDocument doc(8192);
    String json = readFile("/login.json");
    DeserializationError error = deserializeJson(doc, json);
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.f_str());
      webServer.send(500,"text/plain","Lỗi dữ liệu đăng nhập");
      return;
    }
    JsonObject obj = doc.as<JsonObject>();
    obj.remove(username);
    json = "";
    serializeJson(doc, json);
    writeFile("/login.json",json);
    String str = "Đã xóa dữ liệu!";
    webServer.send(200, "text/plain", str);
  });
  webServer.on("/userlist",[]{
    if(!requireLocalLogin()) return;
    runMode=2; //Chế độ cài đặt vân tay
    webServer.send(200, "text/html", userPage);
  });
  webServer.on("/getUserList",[]{
    if(!requireLocalLogin()) return;
    String str = readFile("/userlist.json");
    webServer.send(200, "application/json", str);
  });
  webServer.on("/getFingerList",[]{
    if(!requireLocalLogin()) return;
    Serial.println("Read finger list...!");
    String str = readFile("/fingerlist.json");
    Serial.println("Finger list:"+str);
    DynamicJsonDocument doc(32768);
    DeserializationError error = deserializeJson(doc, str);
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.f_str());
      return;
    }
    // Tạo một map để lưu số lần xuất hiện của mỗi giá trị
    std::map<String, int> valueCount;
    // Duyệt qua các phần tử và đếm số lần xuất hiện của mỗi giá trị
    for (JsonPair kv : doc.as<JsonObject>()) {
      String value = kv.value().as<String>();
      if(value.indexOf('|')<0) value="DEFAULT|"+value;
      if(!value.startsWith(activeClassId+"|")) continue;
      if (valueCount.find(value) == valueCount.end()) {
        valueCount[value] = 1;
      } else {
        valueCount[value]++;
      }
    }
    DynamicJsonDocument resultDoc(8192);
    DynamicJsonDocument users(16384);
    deserializeJson(users,readFile("/userlist.json"));
    for (auto const& pair : valueCount) {
      String name = users[pair.first] | "";
      JsonArray array = resultDoc.createNestedArray(pair.first);
      array.add(name);
      array.add(pair.second);
    }
    // In chuỗi JSON ra Serial
    String resultJson;
    serializeJson(resultDoc, resultJson);
    Serial.println(resultJson);
    webServer.send(200, "application/json", resultJson);
  });
  webServer.on("/addFinger",HTTP_POST,[]{
    if(!requireLocalLogin()) return;
    maHocSinh= studentKey(webServer.arg("mahs"));
    if(maHocSinh.length()==0 || getName(maHocSinh).length()==0){
      runMode=0;
      maHocSinh="";
      webServer.send(400, "text/plain", "Mã học sinh không hợp lệ!");
      return;
    }
    runMode = 1;
    String str = "Vui lòng quét vân tay!";
    webServer.send(200, "text/plain", str);
  });
  webServer.on("/deleteFinger",HTTP_POST,[]{
    if(!requireLocalLogin()) return;
    String mahs = studentKey(webServer.arg("mahs"));
    if(deleteFingerprintForCode(mahs)) webServer.send(200,"text/plain","Đã xóa vân tay!");
    else webServer.send(404,"text/plain","Không tìm thấy hoặc không xóa được vân tay");
  });
  webServer.on("/checkUser",[]{
    if(!requireLocalLogin()) return;
    String mahs = studentKey(webServer.arg("mahs"));
    String str="";
    DynamicJsonDocument doc(8192);
    String json = readFile("/userlist.json");
    DeserializationError error = deserializeJson(doc, json);
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.f_str());
      return;
    }
    JsonObject obj = doc.as<JsonObject>();
    bool hasTime = obj.containsKey(mahs);
    if(hasTime){
      str = doc[mahs].as<String>();
    }
    webServer.send(200, "text/plain", str);
  });
  webServer.onNotFound([]{
    webServer.send(404,"text/plain","Not found");
  });
  webServer.begin();
  webSocket.begin();
  Serial.println("Webserver initialized");
}

bool requireLocalLogin() {
  String cookie=webServer.header("Cookie");
  String expected="session="+localSessionToken;
  int at=cookie.indexOf(expected);
  if(localSessionToken.length() && at>=0 && (at==0 || cookie[at-1]==' ' || cookie[at-1]==';') &&
     (at+expected.length()==cookie.length() || cookie[at+expected.length()]==';')) return true;
  webServer.send(401,"text/plain","Cần đăng nhập lại tại /login");
  return false;
}

bool deleteFingerprintForCode(const String &key) {
  DynamicJsonDocument doc(32768);
  if(deserializeJson(doc,readFile("/fingerlist.json"))) return false;
  std::vector<String> keys;
  for(JsonPair kv: doc.as<JsonObject>()) {
    String stored=kv.value().as<String>();
    if(stored.indexOf('|')<0) stored="DEFAULT|"+stored;
    if(stored==key) keys.push_back(String(kv.key().c_str()));
  }
  bool deleted=false;
  for(const String &idText:keys) {
    int id=idText.toInt();
    if(id>0 && finger.deleteModel(id)==FINGERPRINT_OK) {
      doc.remove(idText);
      fingerIDTemp.push_back(id);
      deleted=true;
    }
  }
  if(deleted) {
    String json; serializeJson(doc,json);
    writeFile("/fingerlist.json",json);
    saveFingerIDTemp();
    webSocket.broadcastTXT("Danh sách vân tay đã thay đổi");
  }
  return deleted;
}

String getName(String key){
  String json = readFile("/userlist.json");
  DynamicJsonDocument doc(32768);
  DeserializationError error = deserializeJson(doc, json);
  if (error) {
    Serial.print(F("deserializeJson() failed: "));
    Serial.println(error.f_str());
  }
  JsonObject obj = doc.as<JsonObject>();
  if(key.indexOf('|')<0) key=studentKey(key);
  bool hasTime = obj.containsKey(key);
  if(hasTime){
    return doc[key];
  }
  return "";
}

IRAM_ATTR void handleBtnSetup(){
  exitState=1;
  if(millis()-timeDelay>500){   
    if(runMode==0){
      runMode=1;
    }else{
      runMode=0;
    }
    timePressBtn = millis();
    timeDelay = millis();
  }
}
void beep(int n, int d){
  for(int i=0;i<n;i++){
    digitalWrite(buzzer,HIGH);
    delay(d);
    digitalWrite(buzzer,LOW);
    delay(d);
  }
}
void readFingerID() {
  Serial.println("Reading stored fingerprint IDs...");
  uint16_t id;
  for (id = 1; id <= finger.capacity; id++) {
    if (finger.loadModel(id) == FINGERPRINT_OK) {
      Serial.print("ID used: "); Serial.println(id);
      nextFingerID = id;
    }
  }
  nextFingerID = nextFingerID + 1;
  Serial.println("Next finger ID: "+ String(nextFingerID));
}

uint8_t getFingerprintEnroll() {
  int p = -1;
  unsigned long started=millis();
  Serial.println("Waiting for valid finger to enroll!");
  webSocket.broadcastTXT("Quét vân tay lần 1!");
  lcd.clear();
  lcd.setCursor(2,0);
  lcd.print("Quét vân tay");
  lcd.setCursor(3,1);
  lcd.print("lần 1...!");
  while(p != FINGERPRINT_OK){
    webServer.handleClient(); webSocket.loop();
    if(millis()-started>60000) { webSocket.broadcastTXT("Hết thời gian chờ vân tay"); return 0; }
    if(exitState==1){
      exitState=0;
      return 0;
    }
    p = finger.getImage();
    switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image taken");
      beep(1,200);
      break;
    case FINGERPRINT_NOFINGER:
      Serial.print(".");
      break;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      break;
    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Imaging error");
      break;
    default:
      Serial.println("Unknown error");
      break;
    }
  }

  // OK success!

  p = finger.image2Tz(1);
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image converted");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Image too messy");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Could not find fingerprint features");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Could not find fingerprint features");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }

  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    Serial.println("Found a print match!");
    webSocket.broadcastTXT("Vân tay đã tồn tại!");
    lcd.clear();
    lcd.setCursor(2,0);
    lcd.print("Vân tay đã");
    lcd.setCursor(3,1);
    lcd.print("tồn tại!");
    beep(2,500);
    return p;
  }
  webSocket.broadcastTXT("Quét thành công!");
  Serial.println("Remove finger");
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    webServer.handleClient(); webSocket.loop();
    if(millis()-started>60000) { webSocket.broadcastTXT("Hết thời gian chờ vân tay"); return 0; }
    if(exitState==1){
      exitState=0;
      return 0;
    }
    p = finger.getImage();
  }

  p = -1;
  Serial.println("Place same finger again");
  webSocket.broadcastTXT("Quét vân tay lần 2!");
  lcd.clear();
  lcd.setCursor(2,0);
  lcd.print("Quét vân tay");
  lcd.setCursor(3,1);
  lcd.print("lần 2...!");
  while (p != FINGERPRINT_OK) {
    webServer.handleClient(); webSocket.loop();
    if(millis()-started>60000) { webSocket.broadcastTXT("Hết thời gian chờ vân tay"); return 0; }
    if(exitState==1){
      exitState=0;
      return 0;
    }
    p = finger.getImage();
    switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image taken");
      beep(1,200);
      break;
    case FINGERPRINT_NOFINGER:
      Serial.print(".");
      break;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      break;
    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Imaging error");
      break;
    default:
      Serial.println("Unknown error");
      break;
    }
  }

  // OK success!

  p = finger.image2Tz(2);
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image converted");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Image too messy");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Could not find fingerprint features");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Could not find fingerprint features");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }
  // OK converted!
  Serial.print("Creating model");
  p = finger.createModel();
  if (p == FINGERPRINT_OK) {
    Serial.println("Prints matched!");
  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.println("Communication error");
    return p;
  } else if (p == FINGERPRINT_ENROLLMISMATCH) {
    Serial.println("Fingerprints did not match");
    webSocket.broadcastTXT("Vân tay không khớp!");
    lcd.clear();
    lcd.setCursor(2,0);
    lcd.print("Vân tay quét");
    lcd.setCursor(3,1);
    lcd.print("không khớp!");
    beep(3,500);
    return p;
  } else {
    Serial.println("Unknown error");
    return p;
  }

  int fingerID;
  if(fingerIDTemp.empty()){
    fingerID = nextFingerID;
    nextFingerID++;
    Serial.println("Next ID:"+String(nextFingerID));
  }else{
    fingerID = fingerIDTemp.back();
    fingerIDTemp.pop_back();
    saveFingerIDTemp();
  }
  Serial.print("ID "); Serial.println(fingerID);
  p = finger.storeModel(fingerID);
  if (p == FINGERPRINT_OK) {
    Serial.println("Stored!");
    String json = readFile("/fingerlist.json");
    DynamicJsonDocument doc(32768);
    DeserializationError error = deserializeJson(doc, json);
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.f_str());
      finger.deleteModel(fingerID); // Không ghi đè mất ánh xạ cũ nếu file hỏng/đầy bộ nhớ.
      webSocket.broadcastTXT("Không đọc được ánh xạ vân tay; dữ liệu cũ được giữ lại");
      return 0;
    }
    doc[String(fingerID)] = maHocSinh;
    if(doc.overflowed()) { finger.deleteModel(fingerID); webSocket.broadcastTXT("Ánh xạ vân tay vượt bộ nhớ"); return 0; }
    json = "";
    serializeJson(doc, json);
    Serial.println(json);
    if(!writeFile("/fingerlist.json",json)) return 0;
    enrollmentStored=true;
    webSocket.broadcastTXT("Đã lưu vân tay thành công!");
    runMode=0;
    lcd.clear();
    lcd.setCursor(2,0);
    lcd.print("Đã lưu vân");
    lcd.setCursor(0,1);
    lcd.print("tay thành công!");
    beep(2,200);
  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.println("Communication error");
    return p;
  } else if (p == FINGERPRINT_BADLOCATION) {
    Serial.println("Could not store in that location");
    return p;
  } else if (p == FINGERPRINT_FLASHERR) {
    Serial.println("Error writing to flash");
    return p;
  } else {
    Serial.println("Unknown error");
    return p;
  }

  return true;
}

uint8_t getFingerprintID() {
  uint8_t p = finger.getImage();
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image taken");
      break;
    case FINGERPRINT_NOFINGER:
      //Serial.println("No finger detected");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      return p;
    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Imaging error");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }

  // OK success!

  p = finger.image2Tz();
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image converted");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Image too messy");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Could not find fingerprint features");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Could not find fingerprint features");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }

  // OK converted!
  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    Serial.println("Found a print match!");
    beep(1,100);
  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.println("Communication error");
    return p;
  } else if (p == FINGERPRINT_NOTFOUND) {
    Serial.println("Did not find a match");
    lcd.clear();
    lcd.setCursor(1,0);
    lcd.print("Vân tay không");
    lcd.setCursor(3,1);
    lcd.print("hợp lệ!");
    beep(2,500);
    delay(1000);
    lcd.clear();
    lcd.setCursor(1,0);
    lcd.print("Vui lòng quét");
    lcd.setCursor(4,1);
    lcd.print("vân tay!");
    return p;
  } else {
    Serial.println("Unknown error");
    return p;
  }

  // found a match!
  int id = finger.fingerID;
  Serial.print("Found ID #"); Serial.print(id);
  Serial.print(" with confidence of "); Serial.println(finger.confidence);
  String json = readFile("/fingerlist.json");
  DynamicJsonDocument doc(32768);
  DeserializationError error = deserializeJson(doc, json);
  if (error) {
    Serial.print(F("deserializeJson() failed: "));
    Serial.println(error.f_str());
  }
  JsonObject obj = doc.as<JsonObject>();
  bool hasTime = obj.containsKey(String(id));
  if(hasTime){
    String code = doc[String(id)].as<String>();
    String name = getName(code);
    String scanKey=code.indexOf('|')>=0 ? code : "DEFAULT|"+code;
    String scanClass=scanKey.substring(0,scanKey.indexOf('|'));
    DynamicJsonDocument sessions(16384);
    deserializeJson(sessions,cloudSessionsJson);
    String scanSession=sessions[scanClass]["sessionId"] | "";
    if(!name.length() || !scanSession.length()) {
      lcd.clear(); lcd.setCursor(0,0); lcd.print("Sai lớp hoặc");
      lcd.setCursor(0,1); lcd.print("chưa mở buổi!");
      beep(2,300);
      return finger.fingerID;
    }
    Serial.println("Name: "+name);
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print(name);
    lcd.setCursor(0,1);
    lcd.print("Đang lưu giờ...!");
    DynamicJsonDocument req(512), res(1024);
    req["action"]="checkin";
    req["classId"]=scanClass;
    req["sessionId"]=scanSession;
    DynamicJsonDocument ids(16384);
    String idJson=readFile("/studentids.json");
    if(deserializeJson(ids,idJson)) { attendanceStatus="Thiếu mã định danh"; return finger.fingerID; }
    String lookup=code.indexOf('|')>=0 ? code : "DEFAULT|"+code;
    String studentId=ids[lookup] | "";
    if(!studentId.length()) { attendanceStatus="Không tìm thấy ID học sinh"; return finger.fingerID; }
    req["studentId"]=studentId;
    if(apiPost(req,res)) {
      lcd.clear(); lcd.setCursor(0,0);
      String state=res["status"] | "";
      lcd.print(state=="LATE" ? "Điểm danh trễ" : "Đã điểm danh");
      lcd.setCursor(0,1); lcd.print(scanClass+" "+name);
      beep(2,80);
    } else {
      lcd.clear(); lcd.setCursor(0,0); lcd.print("Chưa lưu được");
      lcd.setCursor(0,1); lcd.print("hãy quét lại!");
      beep(2,500);
    }
  }else{
    Serial.println("Not found name!");
    lcd.clear();
    lcd.setCursor(1,0);
    lcd.print("Vân tay không");
    lcd.setCursor(3,1);
    lcd.print("hợp lệ!");
    delay(2000);
    lcd.clear();
    lcd.setCursor(1,0);
    lcd.print("Vui lòng quét");
    lcd.setCursor(4,1);
    lcd.print("vân tay!");
  }
  return finger.fingerID;
}
