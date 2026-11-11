// Sensores de nivel: HC-SR04 (continuo) + sensor resistivo de respaldo (fondo seco).

void setupSensors() {
  pinMode(PIN_US_TRIG, OUTPUT);
  digitalWrite(PIN_US_TRIG, LOW);
  pinMode(PIN_US_ECHO, INPUT);  // con divisor 1k/2k desde el ECHO de 5 V
  pinMode(PIN_BACKUP_POWER, OUTPUT);
  digitalWrite(PIN_BACKUP_POWER, LOW);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_BACKUP_SIGNAL, ADC_11db);  // rango ~0-3,1 V
}

// Se energiza solo durante la lectura para reducir la corrosión de las pistas.
int readBackupRaw() {
  digitalWrite(PIN_BACKUP_POWER, HIGH);
  delay(10);
  int v = analogRead(PIN_BACKUP_SIGNAL);
  digitalWrite(PIN_BACKUP_POWER, LOW);
  return v;
}

bool readBackupLow() {
  return readBackupRaw() < BACKUP_DRY_THRESHOLD;
}

// Distancia en mm (mediana de US_SAMPLES pulsos). 0 = sin lectura válida.
uint16_t readDistanceMm() {
  uint16_t s[US_SAMPLES];
  uint8_t n = 0;
  for (uint8_t i = 0; i < US_SAMPLES; i++) {
    digitalWrite(PIN_US_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_US_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_US_TRIG, LOW);
    unsigned long us = pulseIn(PIN_US_ECHO, HIGH, US_TIMEOUT_US);
    uint32_t mm = (us * 343UL) / 2000UL;  // ~343 m/s, ida y vuelta
    if (us > 0 && mm >= US_MIN_MM && mm <= US_MAX_MM) s[n++] = mm;
    delay(US_SAMPLE_GAP_MS);
  }
  if (n == 0) return 0;
  for (uint8_t i = 1; i < n; i++) {
    uint16_t k = s[i];
    int8_t j = i - 1;
    while (j >= 0 && s[j] > k) { s[j + 1] = s[j]; j--; }
    s[j + 1] = k;
  }
  return s[n / 2];
}
