// Copiar a secrets.h (ignorado por git) y completar. NUNCA subir secrets.h al repositorio.
#pragma once

#define WIFI_SSID "mi-red"
#define WIFI_PASSWORD "mi-clave"

// API en Vercel (solo el host, sin https://)
#define API_HOST "noidea.vercel.app"

// Proyecto Supabase (solo el host) y clave PÚBLICA (sb_publishable_...). Nunca la clave secreta.
#define SUPABASE_HOST "xxxxxxxxxxxxxxxxxxxx.supabase.co"
#define SUPABASE_PUBLISHABLE_KEY "sb_publishable_..."

// Identidad del dispositivo: select id, secret from public.devices where tank_id = <id>;
#define DEVICE_ID "00000000-0000-0000-0000-000000000000"
#define DEVICE_SECRET_HEX "64 caracteres hex"
