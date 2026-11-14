// СТРЕЛА v0.7: Heltec Mesh Node T114 (HT-n5262), nRF52840, SX1262
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
static uint32_t nextHeartbeat=0;
static bool ledLit=false;
static uint32_t ledOffAt=0;
static bool buttonLastRaw=true,buttonStable=true;
static uint32_t buttonChangedAt=0;
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
  font.print("ЗАГРУЗКА v0.7");
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
  bool usb=bool(Serial);
  if(!force && !screenDirty && sec==lastUptime && usb==lastUsbState)return;
  if(!force && uint32_t(now-lastDraw)<250)return;
  lastDraw=now;lastUptime=sec;lastUsbState=usb;screenDirty=false;
  tft.fillScreen(ST77XX_BLACK);
  font.setFont(u8g2_font_7x13_t_cyrillic);
  lineAt(5,13,"СТРЕЛА",ST77XX_CYAN);
  lineAt(175,13,"v0.7",ST77XX_WHITE);
  tft.drawFastHLine(0,18,240,ST77XX_BLUE);

  font.setFont(u8g2_font_10x20_t_cyrillic);
  const char *big=online() ? "ОНЛАЙН" : (testPending ? "ОЖИДАНИЕ" : (testScanning ? "ПОИСК" : "ГОТОВО"));
  lineAt(5,42,big,online()?ST77XX_GREEN:ST77XX_YELLOW);

  font.setFont(u8g2_font_7x13_t_cyrillic);
  font.setForegroundColor(ST77XX_WHITE);
  font.setCursor(5,61);font.print("УЗЛОВ: ");font.print(responderCount);
  font.setCursor(115,61);font.print("TX:");font.print(txPackets);
  font.print(" RX:");font.print(rxPackets);

  lineAt(5,77,"ЧАСТОТА: 868.100 МГц",ST77XX_YELLOW);
  lineAt(5,93,statusText,ST77XX_WHITE);

  font.setForegroundColor(ST77XX_CYAN);
  font.setCursor(5,108);font.print("USB:");font.print(usb?"ДА":"НЕТ");
  if(signalSeen){
    font.setCursor(92,108);font.print("RSSI:");font.print(lastRssi);
  }
  font.setForegroundColor(ST77XX_WHITE);
  font.setCursor(5,122);font.print("ВРЕМЯ: ");font.print(sec);font.print(" с");
  lineAt(144,133,"КНОПКА: ТЕСТ",ST77XX_GREEN);
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
  bool raw=digitalRead(PIN_BUTTON1)!=LOW;
  const uint32_t now=millis();
  if(raw!=buttonLastRaw) {
    buttonLastRaw=raw;buttonChangedAt=now;
  }
  if(raw!=buttonStable && uint32_t(now-buttonChangedAt)>45) {
    buttonStable=raw;
    if(!buttonStable)beginTest();
  }
}
static void finishSerialLine() {
  if(serialOverflow) {
    Serial.println("ERR too long (64 bytes max)");
    setStatus("СЛИШКОМ ДЛИННО");
  } else if(serialLength) {
    if(serialLength==1&&serialBuffer[0]=='?') {
      Serial.print("STRELA v0.7 NODE=");Serial.print(myId,HEX);
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
void setup() {
  pinMode(PIN_LED1,OUTPUT);digitalWrite(PIN_LED1,LED_STATE_ON);
  pinMode(PIN_BUTTON1,INPUT_PULLUP);
  Serial.begin(115200);
  Serial.println("BOOT 1/4 USB");
  startScreen();
  setStatus("ИНИЦ. ПЛАТЫ");
  drawScreen(true);
  Serial.println("BOOT 2/4 BOARD");
  boardInit(false,0,115200);
  // Reassert TFT power after Heltec board init.
  pinMode(PIN_TFT_VDD_CTL,OUTPUT);digitalWrite(PIN_TFT_VDD_CTL,TFT_VDD_ENABLE);
  pinMode(PIN_TFT_LEDA_CTL,OUTPUT);digitalWrite(PIN_TFT_LEDA_CTL,TFT_LEDA_ENABLE);
  myId=uint32_t(getID())^uint32_t(getID()>>32);
  if(myId==0)myId=1;
  sequence=uint16_t(myId>>16);
  setStatus("ИНИЦ. РАДИО");
  drawScreen(true);
  Serial.println("BOOT 3/4 RADIO");
  events.TxDone=onTxDone;
  events.TxTimeout=onTxTimeout;
  events.RxDone=onRxDone;
  events.RxTimeout=onRxTimeout;
  events.RxError=onRxError;
  Radio.Init(&events);
  Radio.SetChannel(RF_HZ);
  Radio.SetTxConfig(MODEM_LORA,TX_DBM,0,0,7,1,8,false,true,0,0,false,3000);
  Radio.SetRxConfig(MODEM_LORA,0,7,1,0,8,0,false,0,true,0,0,false,true);
  enterRx();
  setStatus("ГОТОВО. НАЖМИ КНОПКУ");
  drawScreen(true);
  Serial.println("BOOT 4/4 READY STRELA v0.7");
  digitalWrite(PIN_LED1,!LED_STATE_ON);
}
void loop() {
  const uint32_t now=millis();
  pollUsb();
  pollButton();
  if(ledLit && int32_t(now-ledOffAt)>=0) {
    digitalWrite(PIN_LED1,!LED_STATE_ON);ledLit=false;
  }
  if(!ledLit && int32_t(now-nextHeartbeat)>=0) {
    nextHeartbeat=now+2000UL;
    markLed();
  }
  if(testScanning && int32_t(now-testDeadline)>=0) {
    testScanning=false;
    if(responderCount) setStatus("ТЕСТ ЗАВЕРШЁН");
    else setStatus("НЕТ ОТВЕТА");
  }
  drawScreen();
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
