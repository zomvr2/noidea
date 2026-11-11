# Roadmap

Cada hito termina en algo demostrable. Marcar `[x]` al completar.

## Hito 0 — Estructura
- [x] Monorepo, AGENTS.md y documentación
- [x] Rediseño a ESP32 + Vercel + Supabase (sin PC ni USB en el flujo)

## Hito 1 — Nube base
- [x] Esquema Supabase: tablas, RLS, funciones de saldo, Realtime, seed (`supabase/`)
- [x] API Hono para Vercel: ubicar estanque, retiros, telemetría y eventos del dispositivo
- [x] Simulador del ESP32 con el mismo protocolo
- [x] Crear proyecto Supabase y aplicar migraciones + seed
- [x] Crear proyecto Vercel (Root Directory `api`) y variables de entorno; primer despliegue
      (`https://noidea-api.vercel.app`)
- [x] Usuarios de prueba (`npm run users:create -w api`)
- [x] Prueba punta a punta con el simulador (estanque `FFFFFFFF`, dispositivo `simulated = true`)

## Hito 2 — Mapa y ubicación
- [x] Login con Supabase Auth
- [x] Mapa MapLibre + OpenFreeMap con nivel en vivo por estanque
- [x] Ubicar estanque: NFC + GPS (admin)
- [ ] Development build Android (`npx expo run:android`) y prueba con la tarjeta del kit

## Hito 3 — ESP32 en banco
- [ ] Compilar y cargar firmware; confirmar dirección I2C de la LCD
- [ ] Montar HC-SR04 (con divisor), sensor resistivo y LCD; calibrar
- [ ] Ver el nivel real en el mapa

## Hito 4 — Válvula con servo
- [ ] Confirmar modelo de servo, acople con la llave, ángulos
- [ ] Calibrar caudal a 3 alturas y documentar el error
- [ ] Probar cierres: STOP, cortar Wi-Fi (LINK_LOST), respaldo seco, tope 60 s

## Hito 5 — Familias y retiros en la app
- [ ] Registro de familia y validación por admin; asignación de cuotas
- [ ] Pantalla de retiro: NFC → litros → progreso en vivo → comprobante "≈ X L (estimado)"
- [ ] Historial y saldo

## Hito 6 — Alertas, recargas y municipio
- [ ] Vista de alertas, solicitud y seguimiento de recarga por camión aljibe

## Hito 7 — Demo integrada
- [ ] Guion, checklist de seguridad y lista de limitaciones

## Pendiente por hardware no disponible
- Caudalímetro → `measurementMethod: "flowmeter"` (GPIO 27 reservado)
- Electroválvula → control con relé (GPIO 26 reservado)
- TLS con certificados fijados en el ESP32
