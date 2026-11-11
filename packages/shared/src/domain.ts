/**
 * Tipos de dominio compartidos entre servidor y app.
 * Las reglas de negocio viven SOLO en el servidor; aquí solo hay formas de datos.
 * Volúmenes en litros (number con decimales), fechas en ISO 8601 (UTC).
 */

export type Role = "family" | "admin" | "municipal";

export type FamilyStatus = "pending" | "approved" | "rejected" | "suspended";

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
  /** allocated - used - reserved */
  availableL: number;
}

export type TankStatus = "available" | "dispensing" | "maintenance" | "offline";

export interface TankLevel {
  /** Volumen estimado a partir de la distancia medida por el HC-SR04. */
  volumeL: number | null;
  percent: number | null;
  distanceMm: number | null;
  /** true si el sensor resistivo de respaldo indica nivel crítico. */
  backupCritical: boolean | null;
  measuredAt: string | null;
  sensorError: string | null;
}

export interface Tank {
  id: number;
  name: string;
  /** UID de la etiqueta NFC del dispensador (hex en mayúsculas, sin separadores). */
  nfcTagUid: string;
  capacityL: number;
  criticalPercent: number;
  status: TankStatus;
  level: TankLevel;
}

export type WithdrawalStatus =
  | "authorized" // saldo reservado, aún no se abre la válvula
  | "dispensing" // válvula abierta
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Cómo se obtuvo el volumen entregado. Nunca se debe presentar una estimación
 * como medición exacta.
 * - estimated_time: tiempo de apertura x caudal calibrado (sin caudalímetro).
 * - flowmeter: medido con caudalímetro (pendiente: no hay sensor en el kit).
 */
export type MeasurementMethod = "estimated_time" | "flowmeter";

export interface Withdrawal {
  id: number;
  familyId: number;
  tankId: number;
  requestedL: number;
  deliveredL: number | null;
  measurementMethod: MeasurementMethod;
  /** Diferencia de nivel antes/después según el HC-SR04, como verificación cruzada. */
  levelDeltaL: number | null;
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

export interface RefillRequest {
  id: number;
  tankId: number;
  status: RefillStatus;
  requestedVolumeL: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DeviceLinkState = "connected" | "disconnected" | "simulated";

export interface DeviceStatus {
  link: DeviceLinkState;
  firmware: string | null;
  port: string | null;
  lastMessageAt: string | null;
}
