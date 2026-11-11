/** Servidor local para desarrollo (equivalente a `vercel dev`, sin necesitar la CLI de Vercel). */
import { serve } from "@hono/node-server";
import app from "../src/index.js";

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`API local en http://localhost:${port}/api/health`));
