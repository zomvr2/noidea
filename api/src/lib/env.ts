import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
});

let cached: z.infer<typeof schema> | null = null;

/** Variables de entorno validadas (se leen al primer uso para que los tests no las necesiten). */
export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) throw new Error(`Variables de entorno inválidas: ${z.prettifyError(parsed.error)}`);
    cached = parsed.data;
  }
  return cached;
}
