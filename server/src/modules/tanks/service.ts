import type { DeviceMessage, Tank, TankLevel } from "@noidea/shared";
import type { DeviceLink } from "../../hardware/device";
import type { RealtimeHub } from "../../realtime/hub";
import { distanceToLevel, median } from "./level-math";
import type { TankRepo, TankRow } from "./repo";

const MEDIAN_WINDOW = 5;
const PERSIST_EVERY_MS = 30_000;

const EMPTY_LEVEL: TankLevel = {
  volumeL: null,
  percent: null,
  distanceMm: null,
  backupCritical: null,
  measuredAt: null,
  sensorError: null,
};

/**
 * Procesa las lecturas de nivel del dispositivo: suaviza, convierte a litros,
 * guarda muestras periódicas y emite `tank.level` por WebSocket.
 * Prototipo: un único Arduino asociado a `deviceTankId`.
 */
export class TankService {
  private levels = new Map<number, TankLevel>();
  private window: number[] = [];
  private lastPersistAt = 0;

  constructor(
    private readonly repo: TankRepo,
    private readonly device: DeviceLink,
    private readonly hub: RealtimeHub,
    private readonly deviceTankId: number,
  ) {
    device.onMessage((m) => this.onDeviceMessage(m));
  }

  list(): Tank[] {
    return this.repo.list().map((row) => this.toTank(row));
  }

  get(id: number): Tank | undefined {
    const row = this.repo.get(id);
    return row && this.toTank(row);
  }

  private toTank(row: TankRow): Tank {
    return {
      id: row.id,
      name: row.name,
      nfcTagUid: row.nfcTagUid,
      capacityL: row.capacityL,
      criticalPercent: row.criticalPercent,
      status: row.status,
      level: this.levels.get(row.id) ?? EMPTY_LEVEL,
    };
  }

  private onDeviceMessage(msg: DeviceMessage) {
    if (msg.type !== "LVL") return;
    const tank = this.repo.get(this.deviceTankId);
    if (!tank) {
      console.warn(`[tanks] llegan lecturas pero no existe el estanque ${this.deviceTankId}. ¿Corriste db:seed?`);
      return;
    }

    let level: TankLevel;
    if (msg.distanceMm === null) {
      level = {
        ...(this.levels.get(tank.id) ?? EMPTY_LEVEL),
        backupCritical: msg.backupLow,
        sensorError: msg.error ?? "INVALID",
        measuredAt: new Date().toISOString(),
      };
    } else {
      this.window.push(msg.distanceMm);
      if (this.window.length > MEDIAN_WINDOW) this.window.shift();
      const distanceMm = Math.round(median(this.window));
      const { volumeL, percent } = distanceToLevel(distanceMm, tank);
      level = {
        volumeL,
        percent,
        distanceMm,
        backupCritical: msg.backupLow,
        measuredAt: new Date().toISOString(),
        sensorError: null,
      };
    }

    this.levels.set(tank.id, level);
    this.hub.broadcast({ type: "tank.level", tankId: tank.id, level });

    const now = Date.now();
    if (now - this.lastPersistAt >= PERSIST_EVERY_MS) {
      this.lastPersistAt = now;
      this.repo.insertReading({
        tankId: tank.id,
        distanceMm: level.distanceMm,
        volumeL: level.volumeL,
        percent: level.percent,
        backupRaw: msg.backupRaw,
        error: level.sensorError,
        source: this.device.mode === "simulator" ? "simulator" : "device",
      });
    }
    // TODO(hito 1): crear alerta critical_level cuando percent < criticalPercent o backupCritical.
  }
}
