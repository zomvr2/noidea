import { networkInterfaces } from "node:os";
import { buildApp, createDevice } from "./app";
import { config } from "./config";
import { openDatabase } from "./db/database";

const db = openDatabase(config.dbFile);
const device = createDevice(config);
const app = await buildApp({ config, db, device });

await app.listen({ host: config.HOST, port: config.PORT });
await device.start();

if (device.mode === "simulator") {
  app.log.warn("HARDWARE_MODE=simulator: los datos de nivel y entrega son SIMULADOS.");
}

// Muestra las IP de la red local para configurar EXPO_PUBLIC_SERVER_URL en la app.
for (const addrs of Object.values(networkInterfaces())) {
  for (const a of addrs ?? []) {
    if (a.family === "IPv4" && !a.internal) app.log.info(`App: EXPO_PUBLIC_SERVER_URL=http://${a.address}:${config.PORT}`);
  }
}

const shutdown = async () => {
  await device.stop();
  await app.close();
  db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
