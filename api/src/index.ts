import { PROTOCOL_VERSION } from "@noidea/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ApiError } from "./lib/errors.js";
import { device } from "./routes/device.js";
import { refills } from "./routes/refills.js";
import { tanks } from "./routes/tanks.js";
import { withdrawals } from "./routes/withdrawals.js";

/**
 * API de NoIdea en Vercel (Hono, zero-config: Vercel detecta este export por defecto).
 * - App (JWT de Supabase Auth): /api/tanks, /api/withdrawals, /api/refills
 * - ESP32 (firma HMAC):         /api/device/*
 * Lecturas y tiempo real de la app van directo a Supabase con RLS.
 */
const app = new Hono().basePath("/api");

app.use("*", cors());

app.get("/health", (c) =>
  c.json({ ok: true, serverTime: new Date().toISOString(), deviceProtocol: PROTOCOL_VERSION }),
);

app.route("/tanks", tanks);
app.route("/withdrawals", withdrawals);
app.route("/refills", refills);
app.route("/device", device);

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada." } }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message } }, err.status);
  console.error(err);
  return c.json({ error: { code: "INTERNAL", message: "Error interno." } }, 500);
});

export default app;
