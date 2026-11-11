import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envFile = resolve(import.meta.dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const schema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().default("./data/noidea.db"),
  HARDWARE_MODE: z.enum(["serial", "simulator"]).default("simulator"),
  SERIAL_PORT: z.string().default(""),
  /** Estanque al que está conectado el Arduino (prototipo: uno solo). */
  DEVICE_TANK_ID: z.coerce.number().int().positive().default(1),

  TANK_NAME: z.string().default("Estanque prototipo"),
  TANK_NFC_UID: z.string().default("00000000"),
  TANK_CAPACITY_L: z.coerce.number().positive().default(8),
  TANK_EMPTY_DISTANCE_MM: z.coerce.number().int().positive().default(250),
  TANK_FULL_DISTANCE_MM: z.coerce.number().int().positive().default(60),
  TANK_CRITICAL_PERCENT: z.coerce.number().min(0).max(100).default(20),
  VALVE_FLOW_LPS: z.coerce.number().positive().default(0.05),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configuración inválida en server/.env:", z.prettifyError(parsed.error));
  process.exit(1);
}

export const config = {
  ...parsed.data,
  /** Ruta absoluta de la base de datos (relativa a server/). */
  dbFile: resolve(import.meta.dirname, "..", parsed.data.DB_PATH),
};

export type Config = typeof config;
