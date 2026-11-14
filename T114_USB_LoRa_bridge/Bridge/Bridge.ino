// Minimal two-node USB CDC <-> SX1262 LoRa P2P bridge for Heltec T114.
// Board: Heltec Mesh Node T114 (HT-n5262), nRF52840 S140 6.1.1.
// Same firmware on both units. TEST DATA ONLY: no encryption.
// USB CDC protocol: send UTF-8 text + newline; read RX/TX/DELIVERED/FAILED events.
#include <Arduino.h>
#include "heltec_nrf_lorawan.h"
#include <string.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

static constexpr uint32_t RF_HZ=868100000UL;
static constexpr int8_t TX_DBM=5;
static constexpr uint8_t MAX_TEXT=64, HEADER=15;
static constexpr uint8_t TYPE_DATA=1, TYPE_ACK=2, MAX_RETRIES=3;
static constexpr uint32_t DATA_GAP_MS=16000UL;
static constexpr uint32_t ACK_DELAY_MS=250UL;
static constexpr uint32_t ACK_WAIT_MS=3000UL;
static constexpr uint32_t LED_FLASH_MS=250UL;

static RadioEvents_t radioEvents={};
static uint32_t nodeId;
static uint16_t nextSeq=0;
static uint8_t serialLine[MAX_TEXT],serialLen=0;
static bool lineTooLong=false;
static uint8_t outText[MAX_TEXT],outLen=0;
static bool queued=false, waitingAck=false;
static uint16_t outSeq=0;
static uint8_t sentCount=0;
static uint32_t ackDeadline=0;
static bool sending=false;
static uint8_t sendingType=0;
static uint32_t lastDataAt=0;
static bool haveSentData=false;
static bool ackQueued=false;
static uint16_t ackSeq=0;
static uint32_t ackDestination=0;
static uint32_t ackSendAfter=0;
static bool lastRxValid=false;
static uint32_t lastRxFrom=0;
static uint16_t lastRxSeq=0;
static uint8_t packet[HEADER+MAX_TEXT]={};
static bool ledActive=false;
static uint32_t ledOffAt=0;

// Built-in ST7789 TFT on Mesh Node T114 (HT-n5262), 240x135 landscape.
static Adafruit_ST7789 display(&SPI1, PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
static const char *lastEvent = "READY / LISTEN";
static uint32_t txCounter = 0, rxCounter = 0, deliveryCounter = 0;
static int16_t lastRssi = 0;
static int8_t lastSnr = 0;
static bool haveSignal = false;
static bool displayDirty = true;
static uint32_t displayAt = 0;
static uint32_t lastShownSecond = UINT32_MAX;
static bool lastUsbConnected = false;

static void setEvent(const char *event) {
  lastEvent = event;
  displayDirty = true;
}
static void initDisplay() {
  pinMode(PIN_TFT_VDD_CTL, OUTPUT);
  pinMode(PIN_TFT_LEDA_CTL, OUTPUT);
  digitalWrite(PIN_TFT_LEDA_CTL, !TFT_LEDA_ENABLE);
  digitalWrite(PIN_TFT_VDD_CTL, TFT_VDD_ENABLE);
  delay(1000); // Let LCD supply stabilise, same wait as official Heltec example
  display.init(135, 240);
  display.setRotation(3);
  display.setSPISpeed(8000000); // Start at a conservative clock for LCD reliability
  display.setTextWrap(false);
  display.fillScreen(ST77XX_BLUE);
  display.setTextColor(ST77XX_WHITE);
  display.setTextSize(3);
  display.setCursor(12, 18); display.print("STRELA");
  display.setTextSize(2);
  display.setCursor(12, 66); display.print("DISPLAY TEST");
  display.setCursor(12, 95); display.print("v0.4");
  digitalWrite(PIN_TFT_LEDA_CTL, TFT_LEDA_ENABLE);
  delay(1200);
  displayAt = millis() - 250;
}
static void drawDisplay() {
  const uint32_t seconds = millis() / 1000;
  const bool usb = bool(Serial);
  if(!displayDirty && seconds == lastShownSecond && usb == lastUsbConnected) return;
  // Do not block radio processing with unnecessary redraws.
  if(uint32_t(millis() - displayAt) < 250) return;
  displayAt = millis();
  lastShownSecond = seconds;
  lastUsbConnected = usb;
  displayDirty = false;

  display.fillScreen(ST77XX_BLACK);
  display.setTextColor(ST77XX_CYAN);
  display.setTextSize(2);
  display.setCursor(5, 4); display.print("STRELA");
  display.setTextSize(1);
  display.setTextColor(ST77XX_WHITE);
  display.setCursor(129, 11); display.print("T114  v0.4");
  display.drawFastHLine(0, 27, 240, ST77XX_BLUE);

  display.setCursor(5, 35);
  display.setTextColor(ST77XX_YELLOW);
  display.print("868.100 MHz   P2P   5 dBm");

  display.setTextColor(ST77XX_WHITE);
  display.setCursor(5, 52);
  display.print("TX:"); display.print(txCounter);
  display.print("  RX:"); display.print(rxCounter);
  display.print("  ACK:"); display.print(deliveryCounter);

  display.setCursor(5, 69);
  display.setTextColor(ST77XX_GREEN);
  display.print("STATUS: "); display.print(lastEvent);

  display.setCursor(5, 87);
  display.setTextColor(ST77XX_WHITE);
  if(haveSignal) {
    display.print("RSSI "); display.print(lastRssi);
    display.print(" dBm   SNR "); display.print(int(lastSnr));
  } else {
    display.print("RSSI --   (waiting for RX)");
  }

  display.setCursor(5, 105);
  display.setTextColor(ST77XX_CYAN);
  display.print("USB: "); display.print(usb ? "CONNECTED" : "WAITING");
  display.print("  ID:"); display.print(nodeId & 0xFFFFUL, HEX);

  display.setCursor(5, 123);
  display.setTextColor(ST77XX_WHITE);
  display.print("UPTIME: "); display.print(seconds); display.print("s");
}

static uint32_t u32(const uint8_t*p) {
  return uint32_t(p[0])|(uint32_t(p[1])<<8)|(uint32_t(p[2])<<16)|(uint32_t(p[3])<<24);
}
static uint16_t u16(const uint8_t*p){return uint16_t(p[0])|(uint16_t(p[1])<<8);}
static void put32(uint8_t*p,uint32_t v){for(unsigned i=0;i<4;i++)p[i]=uint8_t(v>>(8*i));}
static void put16(uint8_t*p,uint16_t v){p[0]=uint8_t(v);p[1]=uint8_t(v>>8);}
static void flashLed(){
  digitalWrite(PIN_LED1,LED_STATE_ON);
  ledActive=true; ledOffAt=millis()+LED_FLASH_MS;
}
static void startRx(){Radio.Rx(0);}
static void sendFrame(uint8_t type,uint32_t target,uint16_t seq,const uint8_t*data,uint8_t len){
  packet[0]='S';packet[1]='T';packet[2]=1;packet[3]=type;
  put32(packet+4,nodeId);put32(packet+8,target);put16(packet+12,seq);
  packet[14]=len;
  if(len && data)memcpy(packet+HEADER,data,len);
  sending=true; sendingType=type; flashLed();
  Radio.Send(packet,HEADER+len);
}
static void onTxDone(){
  sending=false;
  if(sendingType==TYPE_DATA) setEvent("WAIT ACK");
  else setEvent("ACK SENT");
  if(sendingType==TYPE_DATA && queued && waitingAck)
    ackDeadline=millis()+ACK_WAIT_MS;
  startRx();
}
static void onTxTimeout(){
  sending=false;
  setEvent("TX TIMEOUT");
  if(sendingType==TYPE_DATA && queued && waitingAck)
    ackDeadline=millis();
  startRx();
}
static void onRxError(){startRx();}
static void onRxTimeout(){startRx();}
static void onRxDone(uint8_t*buf,uint16_t size,int16_t rssi,int8_t snr){
  if(size<HEADER || size>HEADER+MAX_TEXT || buf[0]!='S' || buf[1]!='T' ||
     buf[2]!=1 || buf[14]!=(size-HEADER)){
    startRx();return;
  }
  const uint8_t type=buf[3],len=buf[14];
  const uint32_t from=u32(buf+4),to=u32(buf+8);
  const uint16_t seq=u16(buf+12);
  if(from==nodeId || (to!=0 && to!=nodeId)){startRx();return;}
  if(type==TYPE_ACK && len==0 && queued && waitingAck &&
     to==nodeId && seq==outSeq){
    queued=false; waitingAck=false; sentCount=0;
    Serial.print("DELIVERED #");Serial.println(seq);flashLed();
    ++deliveryCounter; setEvent("DELIVERED");
  } else if(type==TYPE_DATA && len!=0){
    if(!lastRxValid || from!=lastRxFrom || seq!=lastRxSeq){
      lastRxValid=true; lastRxFrom=from; lastRxSeq=seq;
      Serial.print("RX #");Serial.print(seq);
      Serial.print(" RSSI=");Serial.print(rssi);
      Serial.print(" SNR=");Serial.print(int(snr));
      Serial.print(" : ");
      Serial.write(buf+HEADER,len);Serial.println();flashLed();
      ++rxCounter; lastRssi=rssi; lastSnr=snr;
      haveSignal=true; setEvent("RECEIVED");
    }
    ackDestination=from;ackSeq=seq;ackQueued=true;
    ackSendAfter=millis()+ACK_DELAY_MS;
  }
  startRx();
}
static void submitLine(){
  if(!lineTooLong && serialLen==1 && serialLine[0]=='?'){
    Serial.print("STRELA v0.4 READY 868100000 Hz NODE=");
    Serial.println(nodeId, HEX);
    setEvent("USB STATUS OK");
  }
  else if(lineTooLong){
    Serial.println("ERR line too long (max 64 UTF-8 bytes)");
    setEvent("USB TOO LONG");
  }
  else if(serialLen>0){
    if(queued){
      Serial.println("BUSY: previous message pending");
      setEvent("USB BUSY");
    }
    else{
      memcpy(outText,serialLine,serialLen);outLen=serialLen;
      outSeq=++nextSeq; queued=true;waitingAck=false;sentCount=0;
      Serial.print("QUEUED #");Serial.println(outSeq);
      setEvent("USB QUEUED");
    }
  }
  serialLen=0;lineTooLong=false;
}
static void pollSerial(){
  while(Serial.available()){
    int c=Serial.read();if(c<0)break;
    if(c=='\n')submitLine();
    else if(c!='\r'){
      if(serialLen<MAX_TEXT && !lineTooLong)serialLine[serialLen++]=uint8_t(c);
      else lineTooLong=true;
    }
  }
}
void setup(){
  boardInit(false,0,115200);
  Serial.begin(115200);
  Serial.println("BOOT 1/4: MCU");
  pinMode(PIN_LED1,OUTPUT);digitalWrite(PIN_LED1,LED_STATE_ON);
  initDisplay();
  Serial.println("BOOT 2/4: LCD INITIALISED");
  digitalWrite(PIN_LED1,!LED_STATE_ON);
  const uint64_t id=getID();
  nodeId=uint32_t(id) ^ uint32_t(id>>32);
  if(nodeId==0)nodeId=1;
  nextSeq=uint16_t(id>>16);
  setEvent("STARTING RADIO");
  drawDisplay(); // Must appear even if SX1262 initialisation stalls.
  Serial.println("BOOT 3/4: RADIO");
  radioEvents.TxDone=onTxDone;
  radioEvents.TxTimeout=onTxTimeout;
  radioEvents.RxDone=onRxDone;
  radioEvents.RxTimeout=onRxTimeout;
  radioEvents.RxError=onRxError;
  Radio.Init(&radioEvents);
  Radio.SetChannel(RF_HZ);
  // 125 kHz, SF7, coding rate 4/5, preamble 8, CRC enabled.
  Radio.SetTxConfig(MODEM_LORA,TX_DBM,0,0,7,1,8,false,true,0,0,false,3000);
  Radio.SetRxConfig(MODEM_LORA,0,7,1,0,8,0,false,0,true,0,0,false,true);
  startRx();
  Serial.println("BOOT 4/4: READY");
  Serial.println("T114 USB-LORA v0.4 READY 868.100 MHz P2P");
  setEvent("LISTENING");
  drawDisplay();
}
void loop(){
  Radio.IrqProcess();
  pollSerial();
  drawDisplay();
  if(ledActive && int32_t(millis()-ledOffAt)>=0){
    digitalWrite(PIN_LED1,!LED_STATE_ON);ledActive=false;
  }
  if(sending)return;

  // ACK goes out quickly, independently of normal data pacing.
  if(ackQueued && int32_t(millis()-ackSendAfter)>=0){
    const uint32_t dest=ackDestination;
    const uint16_t seq=ackSeq;
    ackQueued=false;
    sendFrame(TYPE_ACK,dest,seq,nullptr,0);
    return;
  }
  if(!queued)return;
  if(waitingAck && int32_t(millis()-ackDeadline)<0)return;
  if(waitingAck && sentCount>=MAX_RETRIES){
    Serial.print("FAILED #");Serial.println(outSeq);
    setEvent("FAILED / NO ACK");
    queued=false;waitingAck=false;sentCount=0;
    return;
  }
  if(haveSentData && uint32_t(millis()-lastDataAt)<DATA_GAP_MS)return;
  waitingAck=true;
  ++sentCount;
  lastDataAt=millis();haveSentData=true;
  ++txCounter; setEvent(sentCount==1 ? "TRANSMITTING" : "RETRY TX");
  Serial.print("TX #");Serial.print(outSeq);
  Serial.print(" attempt ");Serial.println(sentCount);
  sendFrame(TYPE_DATA,0,outSeq,outText,outLen);
}
