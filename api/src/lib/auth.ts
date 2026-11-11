import type { Role } from "@noidea/shared";
import { createMiddleware } from "hono/factory";
import { ApiError } from "./errors.js";
import { db } from "./supabase.js";

export interface AuthUser {
  id: string;
  role: Role;
  familyId: number | null;
}

export type AuthEnv = { Variables: { user: AuthUser } };

/** Exige un JWT de Supabase Auth válido (Authorization: Bearer) y, opcionalmente, un rol. */
export function requireUser(...roles: Role[]) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Falta iniciar sesión.");

    const { data, error } = await db().auth.getClaims(token);
    const userId = data?.claims?.sub;
    if (error || !userId) throw new ApiError(401, "UNAUTHENTICATED", "Sesión inválida o expirada.");

    const { data: profile } = await db()
      .from("profiles")
      .select("role, family_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new ApiError(403, "NO_PROFILE", "El usuario no tiene perfil.");
    if (roles.length && !roles.includes(profile.role)) {
      throw new ApiError(403, "FORBIDDEN", "No tienes permiso para esta acción.");
    }

    c.set("user", { id: userId, role: profile.role, familyId: profile.family_id });
    await next();
  });
}
