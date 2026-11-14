// STRELA T114 BOOT / DISPLAY diagnostic, no radio / no GPS / no Heltec LoRa library.
// For the official "Mesh Node T114(HT-n5262)" board definition.
// Expected: LED blinks, TFT shows colors, USB CDC prints one line per second.
#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

Adafruit_ST7789 tft(&SPI1, PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
static uint32_t lastTick = 0;
static uint32_t seconds = 0;
static bool hasDisplay = false;
static bool ledLit = false;
static uint32_t nextLed = 0;
static uint16_t bg = ST77XX_BLUE;

void setup() {
  pinMode(PIN_LED1, OUTPUT);
  digitalWrite(PIN_LED1, LED_STATE_ON); // immediate visual marker
  Serial.begin(115200);
  Serial.println("STRELA DIAG v0.5 BOOT");

  pinMode(PIN_TFT_VDD_CTL, OUTPUT);
  pinMode(PIN_TFT_LEDA_CTL, OUTPUT);
  digitalWrite(PIN_TFT_LEDA_CTL, !TFT_LEDA_ENABLE);
  digitalWrite(PIN_TFT_VDD_CTL, TFT_VDD_ENABLE);
  delay(1000); // official Heltec demo uses 1000 ms for TFT supply
  digitalWrite(PIN_LED1, !LED_STATE_ON);
  Serial.println("TFT power enabled");

  tft.init(135, 240);
  tft.setRotation(3);
  tft.setSPISpeed(8000000);
  tft.setTextWrap(false);
  hasDisplay = true;

  tft.fillScreen(ST77XX_BLUE);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(3);
  tft.setCursor(16, 10);
  tft.print("STRELA");
  tft.setTextSize(2);
  tft.setCursor(16, 60);
  tft.print("BOOT TEST");
  tft.setCursor(16, 95);
  tft.print("v0.5");
  digitalWrite(PIN_TFT_LEDA_CTL, TFT_LEDA_ENABLE);
  Serial.println("DISPLAY READY");
  delay(2000);
  lastTick = millis();
  nextLed = millis();
}

void loop() {
  const uint32_t now = millis();
  if ((int32_t)(now - nextLed) >= 0) {
    ledLit = !ledLit;
    digitalWrite(PIN_LED1, ledLit ? LED_STATE_ON : !LED_STATE_ON);
    nextLed = now + 500;
  }

  if ((uint32_t)(now - lastTick) >= 1000) {
    lastTick = now;
    seconds++;
    Serial.print("STRELA DIAG RUNNING "); Serial.println(seconds);

    if (hasDisplay) {
      // Alternate BLUE/GREEN to distinguish a live sketch from a single flash.
      bg = (bg == ST77XX_BLUE) ? ST77XX_GREEN : ST77XX_BLUE;
      tft.fillScreen(bg);
      tft.setTextColor(ST77XX_WHITE);
      tft.setTextSize(3);
      tft.setCursor(12, 8);
      tft.print("STRELA");
      tft.setTextSize(2);
      tft.setCursor(12, 57);
      tft.print("T114 TEST");
      tft.setCursor(12, 95);
      tft.print("SEC "); tft.print(seconds);
    }
  }
}
