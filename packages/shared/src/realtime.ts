import type { Alert, DeviceStatus, RefillRequest, TankLevel, TankStatus, Withdrawal } from "./domain";

/** Ruta del WebSocket en el servidor. */
export const REALTIME_PATH = "/ws";

/** Eventos que el servidor empuja a la app. Siempre JSON con campo `type`. */
export type ServerEvent =
  | { type: "hello"; serverTime: string; device: DeviceStatus }
  | { type: "device.status"; device: DeviceStatus }
  | { type: "tank.level"; tankId: number; level: TankLevel }
  | { type: "tank.status"; tankId: number; status: TankStatus }
  | { type: "withdrawal.updated"; withdrawal: Withdrawal; progressMs?: number }
  | { type: "alert.created"; alert: Alert }
  | { type: "refill.updated"; refill: RefillRequest };

export type ServerEventType = ServerEvent["type"];
