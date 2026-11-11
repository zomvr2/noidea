import type { DeviceMessage, DeviceStatus, HostCommand } from "@noidea/shared";

/** Enlace con el controlador físico (Arduino real o simulador). */
export interface DeviceLink {
  readonly mode: "serial" | "simulator";
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): DeviceStatus;
  /** Devuelve false si no hay enlace listo; el comando no se envía. */
  send(cmd: HostCommand): boolean;
  onMessage(fn: (msg: DeviceMessage) => void): () => void;
  onStatus(fn: (status: DeviceStatus) => void): () => void;
}

/** Utilidad para manejar suscriptores sin depender de EventEmitter. */
export class Listeners<T> {
  private fns = new Set<(v: T) => void>();

  add(fn: (v: T) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }

  emit(v: T) {
    for (const fn of this.fns) {
      try {
        fn(v);
      } catch (err) {
        console.error("[device] error en listener:", err);
      }
    }
  }
}
