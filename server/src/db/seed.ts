/**
 * Datos ficticios para el prototipo. Uso: npm run db:seed -w server
 * Borra y recrea familias, usuarios, cuotas y estanque. NO usar con datos reales.
 *
 * Credenciales de prueba (teléfono / PIN):
 *   Admin comunitario  +56900000001 / 1234
 *   Municipal          +56900000002 / 1234
 *   Familia Rojas      +56900000011 / 1111
 *   Familia Araya      +56900000012 / 2222
 *   Familia Tapia      +56900000013 / 3333  (pendiente de validación)
 */
import { config } from "../config";
import { hashPin } from "../modules/auth/pin";
import { openDatabase, transaction } from "./database";

const db = openDatabase(config.dbFile);

const now = new Date();
const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

transaction(db, () => {
  for (const table of [
    "audit_log", "refill_requests", "alerts", "withdrawals", "level_readings",
    "quotas", "sessions", "users", "families", "tanks",
  ]) {
    db.exec(`DELETE FROM ${table}`);
  }

  db.prepare(
    `INSERT INTO tanks (id, name, nfc_tag_uid, capacity_l, empty_distance_mm, full_distance_mm, flow_lps, critical_percent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    config.DEVICE_TANK_ID, config.TANK_NAME, config.TANK_NFC_UID.toUpperCase(), config.TANK_CAPACITY_L,
    config.TANK_EMPTY_DISTANCE_MM, config.TANK_FULL_DISTANCE_MM, config.VALVE_FLOW_LPS, config.TANK_CRITICAL_PERCENT,
  );

  const insertFamily = db.prepare(
    "INSERT INTO families (name, sector, members, status) VALUES (?, ?, ?, ?)",
  );
  const insertUser = db.prepare(
    "INSERT INTO users (name, phone, pin_hash, role, family_id) VALUES (?, ?, ?, ?, ?)",
  );
  const insertQuota = db.prepare(
    "INSERT INTO quotas (family_id, period_start, period_end, allocated_l) VALUES (?, ?, ?, ?)",
  );

  insertUser.run("Admin Comunitario", "+56900000001", hashPin("1234"), "admin", null);
  insertUser.run("Encargado Municipal", "+56900000002", hashPin("1234"), "municipal", null);

  // Cuotas pequeñas a escala del prototipo (litros).
  const families = [
    { name: "Familia Rojas", sector: "Sector Norte", members: 4, status: "approved", phone: "+56900000011", pin: "1111", quota: 3 },
    { name: "Familia Araya", sector: "Sector Sur", members: 2, status: "approved", phone: "+56900000012", pin: "2222", quota: 1.5 },
    { name: "Familia Tapia", sector: "Sector Norte", members: 5, status: "pending", phone: "+56900000013", pin: "3333", quota: 0 },
  ] as const;

  for (const f of families) {
    const { lastInsertRowid } = insertFamily.run(f.name, f.sector, f.members, f.status);
    const familyId = Number(lastInsertRowid);
    insertUser.run(`Jefe/a de hogar ${f.name}`, f.phone, hashPin(f.pin), "family", familyId);
    if (f.status === "approved") insertQuota.run(familyId, periodStart, periodEnd, f.quota);
  }
});

console.log(`[seed] datos ficticios cargados en ${config.dbFile}`);
db.close();
