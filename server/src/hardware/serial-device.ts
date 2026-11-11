import {
  type DeviceMessage,
  type DeviceStatus,
  encodeHostCommand,
  HOST_PING_INTERVAL_MS,
  type HostCommand,
  parseDeviceLine,
  PROTOCOL_VERSION,
  SERIAL_BAUD_RATE,
} from "@noidea/shared";
import { ReadlineParser } from "@serialport/parser-readline";
import { SerialPort } from "serialport";
import { type DeviceLink, Listeners } from "./device";

/** VID USB de Arduino oficial y de clones comunes (CH340, FTDI). */
const KNOWN_VENDOR_IDS = ["2341", "2a03", "1a86", "0403"];
const RECONNECT_MS = 3000;
const BOOT_WAIT_MS = 3000;

/**
 * Enlace serial con el Arduino Uno. Se reconecta solo y mantiene el enlace con PING.
 * Al abrir el puerto el Uno se reinicia: se espera BOOT (o PONG) antes de marcarlo listo.
 */
export class SerialDevice implements DeviceLink {
  readonly mode = "serial" as const;
  private port: SerialPort | null = null;
  private ready = false;
  private firmware: string | null = null;
  private portPath: string | null = null;
  private lastMessageAt: string | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private messages = new Listeners<DeviceMessage>();
  private statuses = new Listeners<DeviceStatus>();

  constructor(private readonly configuredPath: string) {}

  async start() {
    this.stopped = false;
    await this.connect();
  }

  async stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.clearPing();
    if (this.port?.isOpen) await new Promise<void>((r) => this.port!.close(() => r()));
  }

  status(): DeviceStatus {
    return {
      link: this.ready ? "connected" : "disconnected",
      firmware: this.firmware,
      port: this.portPath,
      lastMessageAt: this.lastMessageAt,
    };
  }

  send(cmd: HostCommand): boolean {
    if (!this.port?.isOpen || !this.ready) return false;
    this.port.write(encodeHostCommand(cmd));
    return true;
  }

  onMessage(fn: (msg: DeviceMessage) => void) {
    return this.messages.add(fn);
  }

  onStatus(fn: (s: DeviceStatus) => void) {
    return this.statuses.add(fn);
  }

  private async resolvePath(): Promise<string | null> {
    if (this.configuredPath) return this.configuredPath;
    const ports = await SerialPort.list();
    const match = ports.find((p) => p.vendorId && KNOWN_VENDOR_IDS.includes(p.vendorId.toLowerCase()));
    return match?.path ?? null;
  }

  private async connect() {
    if (this.stopped) return;
    const path = await this.resolvePath().catch(() => null);
    if (!path) {
      console.warn("[serial] no se encontró un Arduino; reintentando...");
      return this.scheduleReconnect();
    }

    this.portPath = path;
    const port = new SerialPort({ path, baudRate: SERIAL_BAUD_RATE, autoOpen: false });
    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
    parser.on("data", (line: string) => this.handleLine(line));
    port.on("close", () => this.handleDisconnect("puerto cerrado"));
    port.on("error", (err) => console.error("[serial] error:", err.message));

    port.open((err) => {
      if (err) {
        console.error(`[serial] no se pudo abrir ${path}: ${err.message}`);
        return this.scheduleReconnect();
      }
      console.log(`[serial] puerto ${path} abierto, esperando BOOT...`);
      this.port = port;
      // Si el firmware ya estaba corriendo (sin auto-reset), un PING lo despierta.
      setTimeout(() => {
        if (!this.ready && port.isOpen) port.write(encodeHostCommand({ cmd: "PING" }));
      }, BOOT_WAIT_MS);
    });
  }

  private handleLine(line: string) {
    const msg = parseDeviceLine(line);
    this.lastMessageAt = new Date().toISOString();

    if (msg.type === "BOOT" || msg.type === "PONG") {
      if (msg.proto !== PROTOCOL_VERSION) {
        console.error(`[serial] firmware con protocolo v${msg.proto}; se esperaba v${PROTOCOL_VERSION}.`);
        return;
      }
      if (!this.ready || msg.type === "BOOT") {
        this.ready = true;
        this.firmware = msg.fw;
        console.log(`[serial] Arduino listo (fw ${msg.fw})`);
        this.startPing();
        this.statuses.emit(this.status());
      }
    } else if (msg.type === "UNKNOWN") {
      console.warn(`[serial] línea no reconocida: ${msg.raw}`);
    }
    this.messages.emit(msg);
  }

  private startPing() {
    this.clearPing();
    this.pingTimer = setInterval(() => this.send({ cmd: "PING" }), HOST_PING_INTERVAL_MS);
  }

  private clearPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private handleDisconnect(reason: string) {
    console.warn(`[serial] desconectado: ${reason}`);
    this.clearPing();
    this.port = null;
    if (this.ready) {
      this.ready = false;
      this.statuses.emit(this.status());
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_MS);
  }
}
