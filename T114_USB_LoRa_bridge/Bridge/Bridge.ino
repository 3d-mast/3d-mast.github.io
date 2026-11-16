// СТРЕЛА v1.3: Heltec Mesh Node T114 (HT-n5262), nRF52840, SX1262
// Тестовый USB CDC -> LoRa P2P мост, без шифрования, GPS и ретрансляции.
// Кнопка USER (PIN_BUTTON1): новый опрос сети с нулевым счётчиком.
// СЧЁТЧИК УЗЛОВ = уникальные ID, ответившие на текущий тестовый пакет.
// Статус ОНЛАЙН на отправителе означает получение обратного подтверждения.
// USB: текст UTF-8 + \n, ответные строки RX/DELIVERED/FAILED.
// Кодирование экрана UTF-8 с кириллическим шрифтом U8g2.
#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <U8g2_for_Adafruit_GFX.h>
#include "heltec_nrf_lorawan.h"
#include <string.h>

static constexpr uint32_t RF_HZ=868100000UL;
static constexpr int8_t TX_DBM=5;
static constexpr uint8_t TEXT_MAX=64, FRAME_HEADER=15;
static constexpr uint8_t DATA=1, ACK=2, PROBE=3, PROBE_ACK=4;
static constexpr uint8_t MAX_ATTEMPTS=3, MAX_NODES=32;
static constexpr uint32_t USB_GAP_MS=16000UL;
static constexpr uint32_t PROBE_GAP_MS=10000UL;
static constexpr uint32_t PROBE_WINDOW_MS=7000UL;
static constexpr uint32_t ACK_WAIT_MS=3000UL;
static constexpr uint32_t LED_BLINK_MS=200UL;
static RadioEvents_t events={};
static Adafruit_ST7789 tft(&SPI1,PIN_TFT_CS,PIN_TFT_DC,PIN_TFT_RST);
static U8G2_FOR_ADAFRUIT_GFX font;
static uint32_t myId=1;
static uint16_t sequence=0;
static uint8_t txFrame[FRAME_HEADER+TEXT_MAX];
static uint8_t serialBuffer[TEXT_MAX],serialLength=0;
static bool serialOverflow=false;
static uint8_t queuedText[TEXT_MAX],queuedLength=0;
static bool textPending=false,textAwaitAck=false;
static uint16_t textSeq=0;
static uint8_t textAttempts=0;
static uint32_t textAckDeadline=0, lastDataTx=0;
static bool haveDataTx=false;

static bool radioBusy=false;
static uint8_t currentTxType=0;
static bool replyQueued=false;
static uint32_t replyTo=0,replyAt=0;
static uint16_t replySeq=0;
static uint8_t replyType=0;

static bool testPending=false,testScanning=false,testInFlight=false;
static uint16_t testSeq=0;
static uint32_t testDeadline=0,lastTestTx=0;
static bool haveTestTx=false;
static uint32_t responders[MAX_NODES]={};
static uint8_t responderCount=0;
static uint32_t peerTestAt=0;
static uint32_t txPackets=0,rxPackets=0,acks=0;
static int16_t lastRssi=0;
static int8_t lastSnr=0;
static bool signalSeen=false;
static const char *statusText="СТАРТ";
static bool screenDirty=true;
static uint32_t lastDraw=0,lastUptime=0;
static bool lastUsbState=false;
static bool screenInitialised=false;
static bool lastOnlineDrawn=false;
static bool lastButtonDrawn=true;
static bool lastButtonBDrawn=true;
static uint32_t lastPressDrawn=UINT32_MAX;
static uint32_t nextHeartbeat=0;
static bool ledLit=false;
static uint32_t ledOffAt=0;
static bool keyLastRaw[2]={true,true};
static bool keyStable[2]={true,true};
static uint32_t keyChangedAt[2]={0,0};
static bool safeMode=true; // Start UI + button diagnostics with radio entirely disabled
static bool radioReady=false;
static bool radioStartRequested=false;
static uint32_t buttonPressCount=0;
static const uint8_t keyPins[2]={PIN_BUTTON1,PIN_BUTTON2}; // A=42, B=11
static bool lastDataValid=false;
static uint32_t lastDataFrom=0;
static uint16_t lastDataSeq=0;

static uint32_t load32(const uint8_t *p) {
  return uint32_t(p[0])|(uint32_t(p[1])<<8)|(uint32_t(p[2])<<16)|(uint32_t(p[3])<<24);
}
static uint16_t load16(const uint8_t *p) {
  return uint16_t(p[0])|(uint16_t(p[1])<<8);
}
static void store32(uint8_t *p,uint32_t v) {
  for(uint8_t i=0;i<4;i++)p[i]=uint8_t(v>>(i*8));
}
static void store16(uint8_t *p,uint16_t v) {
  p[0]=uint8_t(v);p[1]=uint8_t(v>>8);
}
static void setStatus(const char *text) {
  if(strcmp(statusText,text)==0)return;
  statusText=text;
  screenDirty=true;
}
static void markLed() {
  digitalWrite(PIN_LED1,LED_STATE_ON);
  ledLit=true;
  ledOffAt=millis()+LED_BLINK_MS;
}
static bool online() {
  const uint32_t now=millis();
  return responderCount>0 || (peerTestAt!=0 && uint32_t(now-peerTestAt)<30000UL);
}
static void startScreen() {
  pinMode(PIN_TFT_VDD_CTL,OUTPUT);
  pinMode(PIN_TFT_LEDA_CTL,OUTPUT);
  digitalWrite(PIN_TFT_LEDA_CTL,!TFT_LEDA_ENABLE);
  digitalWrite(PIN_TFT_VDD_CTL,TFT_VDD_ENABLE);
  delay(1000); // same supply delay as working screen test v0.5
  tft.init(135,240);
  tft.setRotation(3);
  tft.setSPISpeed(8000000);
  tft.setTextWrap(false);
  tft.fillScreen(ST77XX_BLUE);
  font.begin(tft);
  font.setFontMode(1);
  font.setFont(u8g2_font_10x20_t_cyrillic);
  font.setForegroundColor(ST77XX_WHITE);
  font.setCursor(12,45);
  font.print("СТРЕЛА");
  font.setFont(u8g2_font_7x13_t_cyrillic);
  font.setCursor(12,82);
  font.print("ЗАГРУЗКА v1.3");
  digitalWrite(PIN_TFT_LEDA_CTL,TFT_LEDA_ENABLE);
  delay(400);
}
static void lineAt(int16_t x,int16_t baseline,const char *text,uint16_t color=ST77XX_WHITE) {
  font.setForegroundColor(color);
  font.setCursor(x,baseline);
  font.print(text);
}
static void drawScreen(bool force=false) {
  const uint32_t now=millis(),sec=now/1000;
  const bool usb=bool(Serial);
  const bool isOnline=online();
  const bool buttonReleased=(digitalRead(PIN_BUTTON1)!=LOW);
  const bool buttonBReleased=(digitalRead(PIN_BUTTON2)!=LOW);

  if(force || !screenInitialised) {
    tft.fillScreen(ST77XX_BLACK);
    font.setFont(u8g2_font_7x13_t_cyrillic);
    lineAt(5,13,"СТРЕЛА",ST77XX_CYAN);
    lineAt(175,13,"v1.3",ST77XX_WHITE);
    tft.drawFastHLine(0,18,240,ST77XX_BLUE);
    screenInitialised=true;
    screenDirty=true;
  }
  if(!force && uint32_t(now-lastDraw)<100)return;
  lastDraw=now;

  // Only redraw the upper data region when status really changes.
  // No more fillScreen() for every uptime second.
  const bool detailChanged=screenDirty || usb!=lastUsbState || isOnline!=lastOnlineDrawn;
  if(detailChanged) {
    screenDirty=false;
    lastUsbState=usb;
    lastOnlineDrawn=isOnline;
    tft.fillRect(0,20,240,91,ST77XX_BLACK);
    font.setFont(u8g2_font_10x20_t_cyrillic);
    const char *big=safeMode ? "ДИАГНОСТИКА" :
      (isOnline ? "ОНЛАЙН" :
      (testPending ? "ОЖИДАНИЕ" : (testScanning ? "ПОИСК" : "ГОТОВО")));
    lineAt(5,42,big,isOnline?ST77XX_GREEN:ST77XX_YELLOW);
    font.setFont(u8g2_font_7x13_t_cyrillic);
    font.setForegroundColor(ST77XX_WHITE);
    font.setCursor(5,61);font.print("УЗЛОВ: ");font.print(responderCount);
    font.setCursor(115,61);font.print("TX:");font.print(txPackets);
    font.print(" RX:");font.print(rxPackets);
    lineAt(5,77,radioReady?"ЧАСТОТА: 868.100 МГц":"ПРОВЕРКА КНОПОК A И B",ST77XX_YELLOW);
    lineAt(5,93,statusText,ST77XX_WHITE);
    font.setForegroundColor(ST77XX_CYAN);
    font.setCursor(5,108);font.print("USB:");font.print(usb?"ДА":"НЕТ");
    if(signalSeen) {
      font.setCursor(92,108);font.print("RSSI:");font.print(lastRssi);
    }
  }

  // Two small rectangles only: uptime and raw button status.
  if(force || detailChanged || sec!=lastUptime) {
    lastUptime=sec;
    tft.fillRect(0,113,133,22,ST77XX_BLACK);
    font.setFont(u8g2_font_7x13_t_cyrillic);
    font.setForegroundColor(ST77XX_WHITE);
    font.setCursor(5,128);font.print("ВРЕМЯ: ");font.print(sec);font.print("с");
  }
  if(force || detailChanged || buttonReleased!=lastButtonDrawn ||
     buttonBReleased!=lastButtonBDrawn || buttonPressCount!=lastPressDrawn) {
    lastButtonDrawn=buttonReleased;
    lastButtonBDrawn=buttonBReleased;
    lastPressDrawn=buttonPressCount;
    tft.fillRect(133,113,107,22,ST77XX_BLACK);
    font.setFont(u8g2_font_7x13_t_cyrillic);
    font.setForegroundColor(ST77XX_CYAN);
    font.setCursor(135,128);
    font.print("A");font.print(buttonReleased?"1":"0");
    font.print(" B");font.print(buttonBReleased?"1":"0");
    font.print(" #");font.print(buttonPressCount);
  }
}

static void enterRx() {
  Radio.Rx(0);
}
static void sendFrame(uint8_t type,uint32_t to,uint16_t seq,const uint8_t *data,uint8_t len) {
  txFrame[0]='S';txFrame[1]='T';txFrame[2]=1;txFrame[3]=type;
  store32(txFrame+4,myId);
  store32(txFrame+8,to);
  store16(txFrame+12,seq);
  txFrame[14]=len;
  if(len && data)memcpy(txFrame+FRAME_HEADER,data,len);
  radioBusy=true;currentTxType=type;
  ++txPackets;screenDirty=true;
  markLed();
  Radio.Send(txFrame,FRAME_HEADER+len);
}
static void onTxDone() {
  radioBusy=false;
  const uint32_t now=millis();
  if(currentTxType==DATA && textPending && textAwaitAck)textAckDeadline=now+ACK_WAIT_MS;
  if(currentTxType==PROBE) {
    testInFlight=false;
    testScanning=true;
    testDeadline=now+PROBE_WINDOW_MS;
    setStatus("ЖДЁМ ПОДТВЕРЖДЕНИЯ");
  }
  enterRx();
}
static void onTxTimeout() {
  radioBusy=false;
  if(currentTxType==DATA && textPending && textAwaitAck)textAckDeadline=millis();
  if(currentTxType==PROBE) {
    testInFlight=false;testScanning=false;
    setStatus("ОШИБКА ПЕРЕДАЧИ");
  }
  enterRx();
}
static void onRxError() {enterRx();}
static void onRxTimeout() {enterRx();}

static bool addResponder(uint32_t from) {
  for(uint8_t i=0;i<responderCount;i++)if(responders[i]==from)return false;
  if(responderCount>=MAX_NODES)return false;
  responders[responderCount++]=from;
  screenDirty=true;
  return true;
}
static void onRxDone(uint8_t *p,uint16_t size,int16_t rssi,int8_t snr) {
  if(size<FRAME_HEADER||size>FRAME_HEADER+TEXT_MAX||p[0]!='S'||p[1]!='T'||
     p[2]!=1||p[14]!=size-FRAME_HEADER) {
    enterRx();return;
  }
  const uint8_t type=p[3],len=p[14];
  const uint32_t from=load32(p+4),to=load32(p+8);
  const uint16_t seq=load16(p+12);
  if(from==myId||(to!=0&&to!=myId)) {enterRx();return;}
  lastRssi=rssi;lastSnr=snr;signalSeen=true;screenDirty=true;markLed();
  const uint32_t now=millis();

  if(type==PROBE && len==0) {
    ++rxPackets;
    peerTestAt=now;
    setStatus("ТЕСТ ПОЛУЧЕН");
    // Each node replies after a stable ID-dependent slot to limit collisions.
    replyQueued=true;replyTo=from;replySeq=seq;replyType=PROBE_ACK;
    replyAt=now+350UL+((from^myId^uint32_t(seq)*131UL)%1300UL);
    Serial.print("TEST RX FROM ");Serial.println(from,HEX);
  } else if(type==PROBE_ACK && len==0) {
    if(testScanning && seq==testSeq && to==myId) {
      if(addResponder(from)) {
        setStatus("ПОДТВЕРЖДЕНО");
        Serial.print("NODE ONLINE ");Serial.print(from,HEX);
        Serial.print(" TOTAL ");Serial.println(responderCount);
      }
    }
  } else if(type==ACK && len==0) {
    if(textPending && textAwaitAck && seq==textSeq && to==myId) {
      textPending=false;textAwaitAck=false;textAttempts=0;
      ++acks;
      peerTestAt=now;
      setStatus("ДОСТАВЛЕНО");
      Serial.print("DELIVERED #");Serial.println(seq);
    }
  } else if(type==DATA && len>0) {
    if(!lastDataValid||lastDataFrom!=from||lastDataSeq!=seq) {
      lastDataValid=true;lastDataFrom=from;lastDataSeq=seq;
      ++rxPackets;
      peerTestAt=now;
      setStatus("СООБЩЕНИЕ ПОЛУЧЕНО");
      Serial.print("RX #");Serial.print(seq);
      Serial.print(" RSSI=");Serial.print(rssi);Serial.print(": ");
      Serial.write(p+FRAME_HEADER,len);Serial.println();
    }
    replyQueued=true;replyTo=from;replySeq=seq;replyType=ACK;
    replyAt=now+250UL;
  }
  enterRx();
}
static void beginTest() {
  ++sequence;testSeq=sequence;
  responderCount=0;
  memset(responders,0,sizeof responders);
  peerTestAt=0;
  testPending=true;testScanning=false;testInFlight=false;
  screenDirty=true;
  setStatus("НОВЫЙ ТЕСТ");
  Serial.print("TEST START #");Serial.println(testSeq);
}
static void pollButton() {
  // Pure polling on BOTH official T114 buttons (A=42, B=11).
  // No GPIO IRQ handlers. Never launch radio merely by holding a key.
  const uint32_t now=millis();
  for(uint8_t i=0;i<2;i++) {
    const bool released=(digitalRead(keyPins[i])!=LOW);
    if(released!=keyLastRaw[i]) {
      keyLastRaw[i]=released;
      keyChangedAt[i]=now;
      screenDirty=true;
      Serial.print("RAW KEY ");
      Serial.print(i==0?"A":"B");
      Serial.println(released?" RELEASED":" PRESSED");
    }
    if(released!=keyStable[i] && uint32_t(now-keyChangedAt[i])>=35) {
      keyStable[i]=released;
      if(!released) {
        ++buttonPressCount;
        screenDirty=true;
        if(i==0)setStatus("КНОПКА A РАБОТАЕТ");
        else setStatus("КНОПКА B РАБОТАЕТ");
        Serial.print("BUTTON ");
        Serial.print(i==0?"A":"B");
        Serial.print(" #");Serial.println(buttonPressCount);
        if(radioReady)beginTest();
      }
    }
  }
}
static void finishSerialLine() {
  if(serialOverflow) {
    Serial.println("ERR too long (64 bytes max)");
    setStatus("СЛИШКОМ ДЛИННО");
  } else if(serialLength) {
    if(serialLength==1&&serialBuffer[0]=='R') {
      if(!radioReady) {
        radioStartRequested=true;
        setStatus("ВКЛЮЧАЕМ РАДИО");
        Serial.println("USB RADIO START");
      } else Serial.println("RADIO ALREADY ON");
    } else if(serialLength==1&&serialBuffer[0]=='!') {
      if(radioReady)beginTest();
      else {
        ++buttonPressCount;
        screenDirty=true;
        setStatus("КНОПКА РАБОТАЕТ");
        Serial.println("BUTTON SIMULATED; RADIO OFF");
      }
    } else if(serialLength==1&&serialBuffer[0]=='?') {
      Serial.print("STRELA v1.3 NODE=");Serial.print(myId,HEX);
      Serial.print(" NODES=");Serial.println(responderCount);
    } else if(textPending) {
      Serial.println("BUSY");
    } else {
      memcpy(queuedText,serialBuffer,serialLength);queuedLength=serialLength;
      textSeq=++sequence;
      textPending=true;textAwaitAck=false;textAttempts=0;
      Serial.print("QUEUED #");Serial.println(textSeq);
    }
  }
  serialLength=0;serialOverflow=false;
}
static void pollUsb() {
  while(Serial.available()) {
    int c=Serial.read();
    if(c<0)break;
    if(c=='\n')finishSerialLine();
    else if(c!='\r') {
      if(serialLength<TEXT_MAX&&!serialOverflow)serialBuffer[serialLength++]=uint8_t(c);
      else serialOverflow=true;
    }
  }
}
static void bootStep(uint8_t number, const char *step) {
  // Last completed stage remains on screen if a radio API blocks execution.
  tft.fillScreen(ST77XX_BLUE);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(2);
  tft.setCursor(7,5); tft.print("STRELA v1.3");
  tft.setTextSize(2);
  tft.setCursor(7,39); tft.print("RADIO STEP:");
  tft.setTextSize(3);
  tft.setCursor(7,70); tft.print(number);
  tft.setTextSize(1);
  tft.setCursor(7,112); tft.print(step);
  Serial.print("RADIO STEP ");Serial.print(number);
  Serial.print(" ");Serial.println(step);
}

static void startRadio() {
  // At boot no vendor radio routines run. We deliberately enable them only
  // after a long press or the 'R' command so freezing can be localised.
  safeMode=false;
  setStatus("НАСТРОЙКА РАДИО");
  bootStep(1,"boardInit skipped");
  pinMode(PIN_TFT_VDD_CTL,OUTPUT);
  digitalWrite(PIN_TFT_VDD_CTL,TFT_VDD_ENABLE);
  pinMode(PIN_TFT_LEDA_CTL,OUTPUT);
  digitalWrite(PIN_TFT_LEDA_CTL,TFT_LEDA_ENABLE);
  bootStep(2,"Before rtc_timer_init");
  rtc_timer_init();
  bootStep(3,"RTC initialised");
  myId=NRF_FICR->DEVICEID[0]^NRF_FICR->DEVICEID[1];
  if(myId==0)myId=1;
  sequence=uint16_t(myId>>16);

  events.TxDone=onTxDone;
  events.TxTimeout=onTxTimeout;
  events.RxDone=onRxDone;
  events.RxTimeout=onRxTimeout;
  events.RxError=onRxError;
  bootStep(4,"Before Radio.Init");
  Radio.Init(&events);
  bootStep(5,"Before SetChannel");
  Radio.SetChannel(RF_HZ);
  bootStep(6,"Before SetTxConfig");
  Radio.SetTxConfig(MODEM_LORA,TX_DBM,0,0,7,1,8,false,true,0,0,false,3000);
  bootStep(7,"Before SetRxConfig");
  Radio.SetRxConfig(MODEM_LORA,0,7,1,0,8,0,false,0,true,0,0,false,true);
  bootStep(8,"Before Radio.Rx");
  enterRx();
  bootStep(9,"Radio setup finished");
  radioReady=true;
  setStatus("РАДИО ГОТОВО");
  screenInitialised=false; // Restore original UI after boot-step screen
  drawScreen(true);
  Serial.println("STRELA v1.3 RADIO READY");
}

void setup() {
  pinMode(PIN_LED1,OUTPUT);
  digitalWrite(PIN_LED1,!LED_STATE_ON);
  pinMode(PIN_BUTTON1,INPUT_PULLUP); // T114 button A, P1.10 (pin 42), active LOW
  pinMode(PIN_BUTTON2,INPUT_PULLUP); // T114 button B, P0.11 (pin 11), active LOW
  Serial.begin(115200);
  Serial.println("STRELA v1.3 DIAGNOSTIC BOOT: RADIO OFF");
  startScreen();
  for(uint8_t i=0;i<2;i++) {
    keyLastRaw[i]=(digitalRead(keyPins[i])!=LOW);
    keyStable[i]=keyLastRaw[i];
    keyChangedAt[i]=millis();
  }
  safeMode=true;
  radioReady=false;
  setStatus("НАЖМИ A ИЛИ B");
  drawScreen(true);
  Serial.println("A=GPIO42 B=GPIO11; RADIO OFF UNTIL USB R COMMAND");
}
void loop() {
  const uint32_t now=millis();
  pollUsb();
  pollButton();
  if(ledLit && int32_t(now-ledOffAt)>=0) {
    digitalWrite(PIN_LED1,!LED_STATE_ON);ledLit=false;
  }
  // No periodic LED flash: LED now signals only RF TX/RX.
  if(testScanning && int32_t(now-testDeadline)>=0) {
    testScanning=false;
    if(responderCount) setStatus("ТЕСТ ЗАВЕРШЁН");
    else setStatus("НЕТ ОТВЕТА");
  }
  drawScreen();
  if(radioStartRequested && !radioReady) {
    radioStartRequested=false;
    startRadio();
    return;
  }
  if(!radioReady) return;
  Radio.IrqProcess();
  if(radioBusy)return;

  // Replies take priority so original sender sees confirmation promptly.
  if(replyQueued && int32_t(millis()-replyAt)>=0) {
    const uint8_t kind=replyType;
    const uint32_t addr=replyTo;
    const uint16_t seq=replySeq;
    replyQueued=false;
    sendFrame(kind,addr,seq,nullptr,0);
    return;
  }

  if(testPending) {
    if(!haveTestTx||uint32_t(millis()-lastTestTx)>=PROBE_GAP_MS) {
      testPending=false;testInFlight=true;testScanning=false;
      lastTestTx=millis();haveTestTx=true;
      setStatus("ПЕРЕДАЧА ТЕСТА");
      Serial.print("TEST TX #");Serial.println(testSeq);
      sendFrame(PROBE,0,testSeq,nullptr,0);
    } else setStatus("ОЖИДАНИЕ ЭФИРА");
    return;
  }

  if(!textPending)return;
  if(textAwaitAck && int32_t(millis()-textAckDeadline)<0)return;
  if(textAwaitAck && textAttempts>=MAX_ATTEMPTS) {
    Serial.print("FAILED #");Serial.println(textSeq);
    textPending=false;textAwaitAck=false;textAttempts=0;
    setStatus("НЕТ ПОДТВЕРЖДЕНИЯ");
    return;
  }
  if(haveDataTx&&uint32_t(millis()-lastDataTx)<USB_GAP_MS)return;
  ++textAttempts;
  textAwaitAck=true;
  haveDataTx=true;lastDataTx=millis();
  setStatus("ОТПРАВКА СООБЩЕНИЯ");
  Serial.print("TX #");Serial.println(textSeq);
  sendFrame(DATA,0,textSeq,queuedText,queuedLength);
}
