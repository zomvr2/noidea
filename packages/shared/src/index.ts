/**
 * @noidea/shared — tipos de dominio, contratos de la API y protocolo del dispositivo.
 * Un solo archivo a propósito: sin imports relativos funciona igual en Metro, Node/tsx y Vercel.
 * TypeScript puro: sin APIs de Node ni de React Native.
 */

// ===== Dominio =============================================================

export type Role = "family" | "admin" | "municipal";
export type FamilyStatus = "pending" | "approved" | "rejected" | "suspended";

export interface Profile {
  id: string;
  fullName: string;
  role: Role;
  familyId: number | null;
}

export interface Family {
  id: number;
  name: string;
  sector: string;
  members: number;
  status: FamilyStatus;
  createdAt: string;
}

export interface QuotaBalance {
  familyId: number;
  periodStart: string;
  periodEnd: string;
  allocatedL: number;
  usedL: number;
  reservedL: number;
  availableL: number;
}

export type TankStatus = "available" | "dispensing" | "maintenance" | "offline";

/** Ubicación marcada con el GPS del teléfono del administrador al escanear la etiqueta NFC. */
export interface TankLocation {
  latitude: number;
  longitude: number;
  /** Precisión horizontal informada por el GPS (m). */
  accuracyM: number | null;
  markedAt: string;
}

export interface TankLevel {
  /** Volumen estimado a partir de la distancia del HC-SR04. */
  volumeL: number | null;
  percent: number | null;
  distanceMm: number | null;
  backupLow: boolean | null;
  sensorError: string | null;
  measuredAt: string | null;
}

export interface Tank {
  id: number;
  name: string;
  nfcTagUid: string;
  capacityL: number;
  criticalPercent: number;
  status: TankStatus;
  location: TankLocation | null;
  level: TankLevel;
  /** Última telemetría del ESP32 (para saber si está en línea). */
  deviceLastSeenAt: string | null;
  /** true si los datos vienen del simulador (nunca presentar como medición real). */
  simulated: boolean;
}

export type WithdrawalStatus = "authorized" | "dispensing" | "completed" | "failed" | "cancelled";

/**
 * - estimated_time: tiempo de apertura x caudal calibrado (sin caudalímetro).
 * - flowmeter: medido con caudalímetro (PENDIENTE: no hay sensor).
 */
export type MeasurementMethod = "estimated_time" | "flowmeter";

export interface Withdrawal {
  id: number;
  familyId: number;
  tankId: number;
  requestedL: number;
  /** Tiempo de apertura ordenado al dispensador (litros / caudal calibrado; tope 60 s). */
  targetMs: number;
  deliveredL: number | null;
  measurementMethod: MeasurementMethod;
  levelDeltaL: number | null;
  progressMs: number | null;
  status: WithdrawalStatus;
  closeReason: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export type AlertType = "critical_level" | "sensor_error" | "device_offline" | "dispense_failed";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface Alert {
  id: number;
  tankId: number | null;
  type: AlertType;
  status: AlertStatus;
  message: string;
  createdAt: string;
}

export type RefillStatus = "requested" | "scheduled" | "in_transit" | "delivered" | "cancelled";

/** Estados en que la recarga sigue abierta (hay a lo más una por estanque). */
export const OPEN_REFILL_STATUSES: readonly RefillStatus[] = ["requested", "scheduled", "in_transit"];

/** Posición del municipal mientras va en camino (se borra al llegar). */
export interface RefillPosition {
  latitude: number;
  longitude: number;
  at: string;
}

/**
 * Recarga por camión aljibe (docs/recargas.md). El volumen entregado es una estimación por diferencia
 * de nivel (`measurementMethod: "estimated_level"`): mostrar siempre "≈ X L (estimado)".
 */
export interface RefillRequest {
  id: number;
  tankId: number;
  status: RefillStatus;
  source: "auto" | "manual";
  requestedVolumeL: number | null;
  notes: string | null;
  /** Municipal que tomó la recarga. */
  assignedTo: string | null;
  /** Nombre corto visible para las familias, p. ej. "Juan P.". */
  assignedName: string | null;
  acceptedAt: string | null;
  departedAt: string | null;
  arrivedAt: string | null;
  deliveredAt: string | null;
  levelBeforeL: number | null;
  levelAfterL: number | null;
  deliveredEstimatedL: number | null;
  measurementMethod: "estimated_level" | null;
  position: RefillPosition | null;
  /** Tiempo estimado de llegada en segundos (línea recta, velocidad supuesta). */
  etaS: number | null;
  createdAt: string;
  updatedAt: string;
}

// ===== API HTTP ============================================================

/** Contratos de la API HTTP en Vercel (app -> API). Errores: { error: { code, message } }. */

export interface ApiErrorBody {
  error: { code: string; message: string };
}

/** POST /api/tanks/locate (solo admin): fija la ubicación del estanque cuya etiqueta se escaneó. */
export interface LocateTankRequest {
  tagUid: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  /** Requerido si la etiqueta aún no está registrada: crea el estanque con calibración por defecto. */
  name?: string;
}
export type LocateTankResponse = Tank;

/**
 * POST /api/tanks/remove (solo admin): proceso inverso a «ubicar». El admin escanea la etiqueta junto
 * al estanque y confirma; `tankId` debe coincidir con el estanque de esa etiqueta (lo que vio en la
 * confirmación). Borrado lógico: el historial se conserva y la etiqueta queda libre.
 */
export interface RemoveTankRequest {
  tagUid: string;
  tankId: number;
}
export interface RemoveTankResponse {
  id: number;
  name: string;
  deletedAt: string;
}

/** POST /api/withdrawals (familia): pide un retiro en el estanque escaneado. */
export interface CreateWithdrawalRequest {
  tagUid: string;
  liters: number;
}
export type CreateWithdrawalResponse = Withdrawal;

/**
 * Recargas (admin/municipal). Todas responden `RefillRequest` salvo GET /api/refills.
 * POST /api/refills                 { tankId, volumeL?, notes? }  solicitud manual
 * POST /api/refills/:id/claim       «Tomar recarga»
 * POST /api/refills/:id/release     «Soltar» (vuelve a requested)
 * POST /api/refills/:id/start       «Salir» (in_transit)
 * POST /api/refills/:id/position    { latitude, longitude, accuracyM } cada ~10 s en camino
 * POST /api/refills/:id/arrive      { tagUid } etiqueta NFC del estanque
 * POST /api/refills/:id/deliver     «Terminé»
 * POST /api/refills/:id/cancel
 */
export interface CreateRefillRequest {
  tankId: number;
  volumeL?: number;
  notes?: string;
}
export interface RefillPositionRequest {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}
export interface ArriveRefillRequest {
  tagUid: string;
}

/** GET /api/refills (admin/municipal): abiertas por prioridad + entregadas en las últimas 24 h. */
export interface RefillListItem {
  refill: RefillRequest;
  tank: { id: number; name: string; location: TankLocation | null; level: TankLevel; capacityL: number };
  /** ≈ horas hasta vaciarse según el consumo reciente; null si no hay consumo medible. */
  hoursToEmpty: number | null;
  /** Familias con retiros en este estanque en los últimos 30 días. */
  families: number;
  /** Mayor = más urgente. */
  priority: number;
}
export interface RefillListResponse {
  items: RefillListItem[];
}

/** Velocidad media supuesta del camión para la ETA (sin rutas reales). */
export const REFILL_ASSUMED_SPEED_KMH = 30;
/** Cada cuánto la app del municipal envía su posición mientras va en camino. */
export const REFILL_POSITION_INTERVAL_MS = 10_000;

/** Distancia en metros entre dos puntos (haversine). */
export function distanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** ETA aproximada en segundos: línea recta × 1,3 (calles) a la velocidad supuesta. */
export function refillEtaSeconds(distance: number, speedKmh = REFILL_ASSUMED_SPEED_KMH): number {
  return Math.round(((distance * 1.3) / 1000 / speedKmh) * 3600);
}

/**
 * ≈ horas hasta vaciarse a partir de lecturas (volumen estimado) ordenadas o no por fecha.
 * Usa la caída entre la primera y la última lectura válidas; null si el nivel no baja.
 */
export function estimateHoursToEmpty(readings: { volumeL: number | null; at: string }[]): number | null {
  const valid = readings
    .filter((r): r is { volumeL: number; at: string } => r.volumeL !== null)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (valid.length < 2) return null;
  const first = valid[0]!;
  const last = valid[valid.length - 1]!;
  const hours = (Date.parse(last.at) - Date.parse(first.at)) / 3_600_000;
  const drop = first.volumeL - last.volumeL;
  if (hours <= 0 || drop <= 0) return null;
  return Math.round((last.volumeL / (drop / hours)) * 10) / 10;
}

/**
 * Prioridad de una recarga: más urgente si se vacía pronto, si el nivel ya es bajo y si atiende a más familias.
 * Puramente orientativa (las entradas son estimaciones).
 */
export function refillPriority(input: { hoursToEmpty: number | null; percent: number | null; families: number }): number {
  const urgency = input.hoursToEmpty === null ? 0 : 100 / Math.max(1, input.hoursToEmpty);
  const emptiness = input.percent === null ? 0 : Math.max(0, 100 - input.percent) / 2;
  return Math.round((urgency + emptiness + input.families * 5) * 10) / 10;
}

/** "Juan Pérez Soto" -> "Juan P.". Nombre corto del municipal para las familias. */
export function shortDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Municipal";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[1]![0]!.toUpperCase()}.`;
}

/** Tablas de Supabase que la app escucha con Realtime (postgres_changes). */
export const REALTIME_TABLES = ["tanks", "withdrawals", "alerts", "refill_requests"] as const;

/** Normaliza el UID leído por NFC: hex en mayúsculas sin separadores. */
export function normalizeTagUid(raw: string): string {
  return raw.replace(/[^0-9a-f]/gi, "").toUpperCase();
}

// ===== Protocolo del dispositivo ===========================================
/**
 * Protocolo de dispositivo NoIdea v2 (ESP32 <-> nube). Fuente de verdad del contrato;
 * el firmware (firmware/noidea_esp32) y docs/protocolo-dispositivo.md deben coincidir.
 *
 * Nube -> ESP32: Supabase Realtime Broadcast, canal `device:<deviceId>`, evento `cmd`.
 *   Cada orden va firmada: sig = HMAC-SHA256(secreto del dispositivo, commandSigningString(orden)) en hex.
 *   El ESP32 descarta órdenes con firma inválida, con `ts` a más de COMMAND_MAX_AGE_S de su reloj (NTP)
 *   o con un `id` de OPEN que no sea mayor que el último ejecutado (anti-repetición).
 *
 * ESP32 -> nube: HTTPS a la API en Vercel (`/api/device/*`) con cabeceras
 *   X-Device-Id, X-Timestamp (segundos Unix) y X-Signature = HMAC(secreto, requestSigningString(ts, body)).
 *   El secreto nunca viaja por la red.
 */

export const PROTOCOL_VERSION = 2;

/** Nombre del canal Realtime de un dispositivo. */
export const deviceTopic = (deviceId: string) => `device:${deviceId}`;
export const DEVICE_COMMAND_EVENT = "cmd";

/** Tope absoluto de apertura que acepta el firmware. */
export const MAX_OPEN_MS = 60_000;
/** Antigüedad máxima de una orden o petición firmada. */
export const COMMAND_MAX_AGE_S = 30;
/** Si el WebSocket con Supabase se corta este tiempo con la válvula abierta, el ESP32 la cierra. */
export const LINK_TIMEOUT_MS = 3_000;
/** Cada cuánto el ESP32 envía telemetría de nivel. */
export const TELEMETRY_INTERVAL_MS = 10_000;
/** Cada cuánto el ESP32 informa progreso (RUN) durante una entrega. */
export const RUN_REPORT_MS = 2_000;
/** El dispositivo se considera desconectado si no envía telemetría en este tiempo. */
export const DEVICE_OFFLINE_AFTER_MS = 35_000;
export const LCD_COLUMNS = 16;

// ---------------------------------------------------------------------------
// Nube -> ESP32
// ---------------------------------------------------------------------------

export type DeviceCommand =
  | { cmd: "OPEN"; id: number; ms: number; ts: number }
  | { cmd: "STOP"; id: number; ts: number }
  | { cmd: "LCD"; row: 0 | 1; text: string; ts: number };

export type SignedDeviceCommand = DeviceCommand & { sig: string };

/** Texto exacto que se firma. Cambiarlo rompe la compatibilidad con el firmware. */
export function commandSigningString(c: DeviceCommand): string {
  switch (c.cmd) {
    case "OPEN":
      return `OPEN|${c.id}|${c.ms}|${c.ts}`;
    case "STOP":
      return `STOP|${c.id}|${c.ts}`;
    case "LCD":
      return `LCD|${c.row}|${c.text}|${c.ts}`;
  }
}

/** Texto que firma el ESP32 en cada petición HTTP. */
export function requestSigningString(ts: number, body: string): string {
  return `${ts}\n${body}`;
}

/** ASCII imprimible, sin acentos, recortado a 16 columnas. */
export function sanitizeLcdText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas diacríticas combinantes (acentos)
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\|/g, "/") // el separador de la firma no puede aparecer en el texto
    .slice(0, LCD_COLUMNS);
}

// ---------------------------------------------------------------------------
// ESP32 -> nube
// ---------------------------------------------------------------------------

/** POST /api/device/telemetry */
export interface DeviceTelemetry {
  fw: string;
  proto: number;
  /** Distancia sensor->agua en mm (mediana del HC-SR04); null si no hubo eco válido. */
  distanceMm: number | null;
  error: string | null;
  /** Lectura cruda del sensor resistivo de respaldo (ADC 0-4095 del ESP32). */
  backupRaw: number;
  /** true si el respaldo está bajo el umbral de fondo seco (umbral en el firmware). */
  backupLow: boolean;
  /** Intensidad Wi-Fi en dBm (diagnóstico). */
  rssi: number;
}

export type CloseReason = "TARGET" | "STOP" | "LINK_LOST" | "LOW_LEVEL" | "MAX_MS";
export type NakReason = "BUSY" | "BAD_ARGS" | "MAX_MS" | "LOW_LEVEL" | "NOT_ACTIVE" | "BAD_SIG" | "STALE";

/** POST /api/device/events */
export type DeviceEvent =
  | { type: "ACK"; cmd: "OPEN" | "STOP"; id: number }
  | { type: "NAK"; cmd: "OPEN" | "STOP"; id: number; reason: NakReason }
  | { type: "RUN"; id: number; elapsedMs: number }
  | { type: "DONE"; id: number; openMs: number; reason: CloseReason };

// ===== Filas de Supabase -> tipos de dominio (usadas por API y app) =========
/** Columnas de public.tanks (sin datos del dispositivo). */
export const TANK_COLUMNS =
  "id, name, nfc_tag_uid, capacity_l, empty_distance_mm, full_distance_mm, flow_lps, critical_percent, status, " +
  "latitude, longitude, location_accuracy_m, location_marked_at, level_volume_l, level_percent, level_distance_mm, " +
  "level_backup_low, level_error, level_measured_at, level_simulated, device_last_seen_at";

export interface TankRow {
  id: number;
  name: string;
  nfc_tag_uid: string;
  capacity_l: number;
  empty_distance_mm: number;
  full_distance_mm: number;
  flow_lps: number;
  critical_percent: number;
  status: Tank["status"];
  latitude: number | null;
  longitude: number | null;
  location_accuracy_m: number | null;
  location_marked_at: string | null;
  level_volume_l: number | null;
  level_percent: number | null;
  level_distance_mm: number | null;
  level_backup_low: boolean | null;
  level_error: string | null;
  level_measured_at: string | null;
  level_simulated: boolean;
  device_last_seen_at: string | null;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

/** numeric de Postgres llega como string o number según el driver: siempre se normaliza. */
export function toTank(r: TankRow): Tank {
  return {
    id: r.id,
    name: r.name,
    nfcTagUid: r.nfc_tag_uid,
    capacityL: Number(r.capacity_l),
    criticalPercent: Number(r.critical_percent),
    status: r.status,
    location:
      r.latitude !== null && r.longitude !== null
        ? {
            latitude: r.latitude,
            longitude: r.longitude,
            accuracyM: num(r.location_accuracy_m),
            markedAt: r.location_marked_at ?? "",
          }
        : null,
    level: {
      volumeL: num(r.level_volume_l),
      percent: num(r.level_percent),
      distanceMm: r.level_distance_mm,
      backupLow: r.level_backup_low,
      sensorError: r.level_error,
      measuredAt: r.level_measured_at,
    },
    deviceLastSeenAt: r.device_last_seen_at,
    simulated: r.level_simulated,
  };
}

export interface WithdrawalRow {
  id: number;
  family_id: number;
  tank_id: number;
  requested_l: number;
  target_ms: number;
  delivered_l: number | null;
  measurement_method: Withdrawal["measurementMethod"];
  level_delta_l: number | null;
  progress_ms: number | null;
  status: Withdrawal["status"];
  close_reason: string | null;
  created_at: string;
  finished_at: string | null;
}

export function toWithdrawal(r: WithdrawalRow): Withdrawal {
  return {
    id: r.id,
    familyId: r.family_id,
    tankId: r.tank_id,
    requestedL: Number(r.requested_l),
    targetMs: r.target_ms,
    deliveredL: num(r.delivered_l),
    measurementMethod: r.measurement_method,
    levelDeltaL: num(r.level_delta_l),
    progressMs: r.progress_ms,
    status: r.status,
    closeReason: r.close_reason,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  };
}

/** Columnas de public.refill_requests que lee la app y la API. */
export const REFILL_COLUMNS =
  "id, tank_id, status, source, requested_volume_l, notes, assigned_to, assigned_name, accepted_at, departed_at, " +
  "arrived_at, delivered_at, level_before_l, level_after_l, delivered_estimated_l, measurement_method, " +
  "last_latitude, last_longitude, last_position_at, eta_s, created_at, updated_at";

export interface RefillRow {
  id: number;
  tank_id: number;
  status: RefillStatus;
  source: RefillRequest["source"];
  requested_volume_l: number | string | null;
  notes: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  accepted_at: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  level_before_l: number | string | null;
  level_after_l: number | string | null;
  delivered_estimated_l: number | string | null;
  measurement_method: RefillRequest["measurementMethod"];
  last_latitude: number | null;
  last_longitude: number | null;
  last_position_at: string | null;
  eta_s: number | null;
  created_at: string;
  updated_at: string;
}

export function toRefill(r: RefillRow): RefillRequest {
  return {
    id: r.id,
    tankId: r.tank_id,
    status: r.status,
    source: r.source,
    requestedVolumeL: num(r.requested_volume_l),
    notes: r.notes,
    assignedTo: r.assigned_to,
    assignedName: r.assigned_name,
    acceptedAt: r.accepted_at,
    departedAt: r.departed_at,
    arrivedAt: r.arrived_at,
    deliveredAt: r.delivered_at,
    levelBeforeL: num(r.level_before_l),
    levelAfterL: num(r.level_after_l),
    deliveredEstimatedL: num(r.delivered_estimated_l),
    measurementMethod: r.measurement_method,
    position:
      r.last_latitude !== null && r.last_longitude !== null
        ? { latitude: r.last_latitude, longitude: r.last_longitude, at: r.last_position_at ?? "" }
        : null,
    etaS: r.eta_s,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Columnas de public.quotas. */
export const QUOTA_COLUMNS = "family_id, period_start, period_end, allocated_l, used_l, reserved_l";

export interface QuotaRow {
  family_id: number;
  period_start: string;
  period_end: string;
  allocated_l: number | string;
  used_l: number | string;
  reserved_l: number | string;
}

/** Disponible = asignado − usado − reservado (nunca negativo). `used_l` suma volúmenes estimados. */
export function toQuotaBalance(r: QuotaRow): QuotaBalance {
  const allocatedL = Number(r.allocated_l);
  const usedL = Number(r.used_l);
  const reservedL = Number(r.reserved_l);
  return {
    familyId: r.family_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    allocatedL,
    usedL,
    reservedL,
    availableL: Math.max(0, allocatedL - usedL - reservedL),
  };
}
