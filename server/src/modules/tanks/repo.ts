import type { TankStatus } from "@noidea/shared";
import type { Db } from "../../db/database";

export interface TankRow {
  id: number;
  name: string;
  nfcTagUid: string;
  capacityL: number;
  emptyDistanceMm: number;
  fullDistanceMm: number;
  flowLps: number;
  criticalPercent: number;
  status: TankStatus;
}

const SELECT_TANK = `SELECT id, name, nfc_tag_uid AS nfcTagUid, capacity_l AS capacityL,
  empty_distance_mm AS emptyDistanceMm, full_distance_mm AS fullDistanceMm, flow_lps AS flowLps,
  critical_percent AS criticalPercent, status FROM tanks`;

export class TankRepo {
  constructor(private readonly db: Db) {}

  list(): TankRow[] {
    return this.db.prepare(`${SELECT_TANK} ORDER BY id`).all() as unknown as TankRow[];
  }

  get(id: number): TankRow | undefined {
    return this.db.prepare(`${SELECT_TANK} WHERE id = ?`).get(id) as unknown as TankRow | undefined;
  }

  insertReading(r: {
    tankId: number;
    distanceMm: number | null;
    volumeL: number | null;
    percent: number | null;
    backupRaw: number | null;
    error: string | null;
    source: "device" | "simulator";
  }) {
    this.db
      .prepare(
        `INSERT INTO level_readings (tank_id, distance_mm, volume_l, percent, backup_raw, error, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(r.tankId, r.distanceMm, r.volumeL, r.percent, r.backupRaw, r.error, r.source);
  }
}
