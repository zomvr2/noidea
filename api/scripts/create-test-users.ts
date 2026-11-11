/**
 * Crea usuarios de prueba en Supabase Auth y los asocia a perfiles/familias del seed.
 * Uso: npm run users:create -w api   (requiere api/.env.local con SUPABASE_URL y SUPABASE_SECRET_KEY)
 *
 * Cuentas ficticias (contraseña común de prueba: NoIdea-prueba-2026):
 *   admin@noidea.test      admin comunitario
 *   municipio@noidea.test  municipal
 *   rojas@noidea.test      Familia Rojas (aprobada)
 *   araya@noidea.test      Familia Araya (aprobada)
 *   tapia@noidea.test      Familia Tapia (pendiente)
 */
import { db } from "../src/lib/supabase.js";

const PASSWORD = "NoIdea-prueba-2026";

const users = [
  { email: "admin@noidea.test", name: "Admin Comunitario", role: "admin", family: null },
  { email: "municipio@noidea.test", name: "Encargado Municipal", role: "municipal", family: null },
  { email: "rojas@noidea.test", name: "Jefa de hogar Rojas", role: "family", family: "Familia Rojas" },
  { email: "araya@noidea.test", name: "Jefe de hogar Araya", role: "family", family: "Familia Araya" },
  { email: "tapia@noidea.test", name: "Jefa de hogar Tapia", role: "family", family: "Familia Tapia" },
] as const;

for (const u of users) {
  const { data, error } = await db().auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.name },
  });
  if (error && !/already/i.test(error.message)) throw error;

  const userId =
    data.user?.id ?? (await db().auth.admin.listUsers()).data.users.find((x) => x.email === u.email)?.id;
  if (!userId) throw new Error(`No se encontró el usuario ${u.email}`);

  let familyId: number | null = null;
  if (u.family) {
    const { data: fam } = await db().from("families").select("id").eq("name", u.family).single();
    familyId = fam?.id ?? null;
  }
  const { error: profErr } = await db()
    .from("profiles")
    .update({ role: u.role, family_id: familyId, full_name: u.name })
    .eq("id", userId);
  if (profErr) throw profErr;
  console.log(`✓ ${u.email} (${u.role}${u.family ? `, ${u.family}` : ""})`);
}
