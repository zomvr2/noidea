import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Códigos que lanzan las funciones SQL (RAISE EXCEPTION '<CODIGO>') y su traducción HTTP. */
const DB_ERRORS: Record<string, [ContentfulStatusCode, string]> = {
  BAD_LITERS: [400, "La cantidad debe ser mayor a cero."],
  FAMILY_NOT_APPROVED: [403, "La familia no está validada por el administrador."],
  TANK_NOT_FOUND: [404, "Estanque no encontrado."],
  TANK_UNAVAILABLE: [409, "El estanque no está disponible."],
  DEVICE_OFFLINE: [409, "El dispensador no está conectado."],
  TANK_CRITICAL: [409, "El estanque está en nivel crítico."],
  INSUFFICIENT_TANK_LEVEL: [409, "El estanque no tiene agua suficiente para ese retiro."],
  TANK_BUSY: [409, "Hay otro retiro en curso en este estanque."],
  NO_ACTIVE_QUOTA: [409, "La familia no tiene cuota asignada para este período."],
  INSUFFICIENT_BALANCE: [409, "Saldo insuficiente."],
  WITHDRAWAL_NOT_FOUND: [404, "Retiro no encontrado."],
  REFILL_NOT_FOUND: [404, "Recarga no encontrada."],
  REFILL_ALREADY_OPEN: [409, "Este estanque ya tiene una recarga abierta."],
  REFILL_TAKEN: [409, "Otro municipal ya tomó esta recarga."],
  REFILL_ALREADY_ACTIVE: [409, "Ya tienes una recarga en curso."],
  INVALID_REFILL_STATE: [409, "La recarga no está en un estado que permita esta acción."],
  NOT_ASSIGNED: [403, "Esta recarga está asignada a otra persona."],
};

/** Convierte un error de Supabase/PostgREST en ApiError. */
export function fromDbError(err: { message: string } | null): ApiError {
  const code = err?.message?.trim() ?? "";
  const known = DB_ERRORS[code];
  if (known) return new ApiError(known[0], code, known[1]);
  console.error("[db]", err);
  return new ApiError(500, "DB_ERROR", "Error de base de datos.");
}
