import {
  type DeviceMessage,
  type DeviceStatus,
  type HostCommand,
  MAX_OPEN_MS,
  parseDeviceLine,
  PROTOCOL_VERSION,
} from "@noidea/shared";
import { type DeviceLink, Listeners } from "./device";

export interface SimulatorTank {
  capacityL: number;
  emptyDistanceMm: number;
  fullDistanceMm: number;
  flowLps: number;
}

const FW = "sim-0.1.0";
const LEVEL_INTERVAL_MS = 2000;
const RUN_INTERVAL_MS = 500;

/**
 * Simulador del Arduino para desarrollar sin hardware. Habla el mismo protocolo
 * (genera líneas de texto y las pasa por parseDeviceLine).
 * SOLO DESARROLLO: sus datos no son mediciones y la app debe mostrarlos como simulados.
 */
export class SimulatedDevice implements DeviceLink {
  readonly mode = "simulator" as const;
  private volumeL: number;
  private active: { id: number; ms: number; startedAt: number; timer: NodeJS.Timeout } | null = null;
  private levelTimer: NodeJS.Timeout | null = null;
  private lastMessageAt: string | null = null;
  private messages = new Listeners<DeviceMessage>();
  private statuses = new Listeners<DeviceStatus>();

  constructor(private readonly tank: SimulatorTank) {
    this.volumeL = tank.capacityL * 0.75;
  }

  async start() {
    this.emitLine(`BOOT fw=${FW} proto=${PROTOCOL_VERSION}`);
    this.statuses.emit(this.status());
    this.emitLevel();
    this.levelTimer = setInterval(() => this.emitLevel(), LEVEL_INTERVAL_MS);
  }

  async stop() {
    if (this.levelTimer) clearInterval(this.levelTimer);
    if (this.active) clearInterval(this.active.timer);
  }

  status(): DeviceStatus {
    return { link: "simulated", firmware: FW, port: null, lastMessageAt: this.lastMessageAt };
  }

  onMessage(fn: (msg: DeviceMessage) => void) {
    return this.messages.add(fn);
  }

  onStatus(fn: (s: DeviceStatus) => void) {
    return this.statuses.add(fn);
  }

  /** Rellena el estanque simulado (útil para probar recargas). */
  refill(liters: number) {
    this.volumeL = Math.min(this.tank.capacityL, this.volumeL + liters);
  }

  send(cmd: HostCommand): boolean {
    // Respuesta asíncrona, como un dispositivo real.
    setTimeout(() => this.handle(cmd), 20);
    return true;
  }

  private handle(cmd: HostCommand) {
    switch (cmd.cmd) {
      case "PING":
        return this.emitLine(`PONG fw=${FW} proto=${PROTOCOL_VERSION}`);
      case "LEVEL":
        return this.emitLevel();
      case "LCD":
        return this.emitLine("ACK cmd=LCD");
      case "OPEN":
        if (this.active) return this.emitLine(`NAK cmd=OPEN id=${cmd.id} r=BUSY`);
        if (cmd.ms > MAX_OPEN_MS) return this.emitLine(`NAK cmd=OPEN id=${cmd.id} r=MAX_MS`);
        if (this.volumeL <= 0) return this.emitLine(`NAK cmd=OPEN id=${cmd.id} r=LOW_LEVEL`);
        this.emitLine(`ACK cmd=OPEN id=${cmd.id}`);
        this.active = {
          id: cmd.id,
          ms: cmd.ms,
          startedAt: Date.now(),
          timer: setInterval(() => this.tick(), RUN_INTERVAL_MS),
        };
        return;
      case "STOP":
        if (!this.active || this.active.id !== cmd.id) {
          return this.emitLine(`NAK cmd=STOP id=${cmd.id} r=NOT_ACTIVE`);
        }
        this.emitLine(`ACK cmd=STOP id=${cmd.id}`);
        return this.close("STOP");
    }
  }

  private tick() {
    if (!this.active) return;
    const elapsed = Date.now() - this.active.startedAt;
    this.volumeL = Math.max(0, this.volumeL - this.tank.flowLps * (RUN_INTERVAL_MS / 1000));
    if (this.volumeL <= 0) return this.close("LOW_LEVEL");
    if (elapsed >= this.active.ms) return this.close("TARGET");
    this.emitLine(`RUN id=${this.active.id} ms=${elapsed}`);
  }

  private close(reason: string) {
    if (!this.active) return;
    clearInterval(this.active.timer);
    const ms = Math.min(Date.now() - this.active.startedAt, this.active.ms);
    this.emitLine(`DONE id=${this.active.id} ms=${ms} r=${reason}`);
    this.active = null;
    this.emitLevel();
  }

  private emitLevel() {
    const { emptyDistanceMm, fullDistanceMm, capacityL } = this.tank;
    const d = Math.round(emptyDistanceMm - (this.volumeL / capacityL) * (emptyDistanceMm - fullDistanceMm));
    const low = this.volumeL / capacityL <= 0.05;
    this.emitLine(`LVL d=${d} b=${low ? 20 : 650} low=${low ? 1 : 0}`);
  }

  private emitLine(line: string) {
    this.lastMessageAt = new Date().toISOString();
    this.messages.emit(parseDeviceLine(line));
  }
}
