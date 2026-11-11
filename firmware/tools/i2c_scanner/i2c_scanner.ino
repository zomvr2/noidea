// Escáner I2C: imprime la dirección de la LCD (típicamente 0x27 o 0x3F).
// Cargar, abrir Monitor Serie a 115200 y copiar la dirección a LCD_ADDRESS en config.h.
#include <Wire.h>

void setup() {
  Wire.begin();
  Serial.begin(115200);
  while (!Serial) {}
  Serial.println(F("Buscando dispositivos I2C..."));
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print(F("Encontrado en 0x"));
      if (addr < 16) Serial.print('0');
      Serial.println(addr, HEX);
    }
  }
  Serial.println(F("Listo."));
}

void loop() {}
