import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { REALTIME_PATH } from "@noidea/shared";
import Fastify from "fastify";
import type { Config } from "./config";
import type { Db } from "./db/database";
import type { DeviceLink } from "./hardware/device";
import { SerialDevice } from "./hardware/serial-device";
import { SimulatedDevice } from "./hardware/simulated-device";
import { TankRepo } from "./modules/tanks/repo";
import { registerTankRoutes } from "./modules/tanks/routes";
import { TankService } from "./modules/tanks/service";
import { RealtimeHub } from "./realtime/hub";

export function createDevice(config: Config): DeviceLink {
  if (config.HARDWARE_MODE === "serial") return new SerialDevice(config.SERIAL_PORT);
  return new SimulatedDevice({
    capacityL: config.TANK_CAPACITY_L,
    emptyDistanceMm: config.TANK_EMPTY_DISTANCE_MM,
    fullDistanceMm: config.TANK_FULL_DISTANCE_MM,
    flowLps: config.VALVE_FLOW_LPS,
  });
}

/** Arma la aplicación Fastify con todos los módulos. No abre el puerto ni arranca el dispositivo. */
export async function buildApp(deps: { config: Config; db: Db; device: DeviceLink }) {
  const { config, db, device } = deps;
  const app = Fastify({ logger: { level: "info" } });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  const hub = new RealtimeHub();
  device.onStatus((status) => hub.broadcast({ type: "device.status", device: status }));

  const tanks = new TankService(new TankRepo(db), device, hub, config.DEVICE_TANK_ID);

  app.get("/api/health", async () => ({
    ok: true,
    serverTime: new Date().toISOString(),
    hardwareMode: config.HARDWARE_MODE,
    device: device.status(),
    realtimeClients: hub.size,
  }));

  app.get(REALTIME_PATH, { websocket: true }, (socket) => {
    hub.add(socket, { type: "hello", serverTime: new Date().toISOString(), device: device.status() });
  });

  registerTankRoutes(app, tanks);
  // Próximos módulos (ver docs/roadmap.md): auth, families, quotas, withdrawals, alerts, refills.

  return app;
}
