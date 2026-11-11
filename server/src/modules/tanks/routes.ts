import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendError } from "../../http/errors";
import type { TankService } from "./service";

const idParams = z.object({ id: z.coerce.number().int().positive() });

export function registerTankRoutes(app: FastifyInstance, tanks: TankService) {
  // TODO(hito 3): exigir sesión cuando exista el módulo auth.
  app.get("/api/tanks", async () => tanks.list());

  app.get("/api/tanks/:id", async (req, reply) => {
    const params = idParams.safeParse(req.params);
    if (!params.success) return sendError(reply, 400, "BAD_REQUEST", "id inválido");
    const tank = tanks.get(params.data.id);
    if (!tank) return sendError(reply, 404, "TANK_NOT_FOUND", "Estanque no encontrado");
    return tank;
  });
}
