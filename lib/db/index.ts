import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon over HTTP: stateless, works in serverless and edge-style runtimes.
 * The Better Auth Drizzle adapter runs without interactive transactions (its default),
 * which is what the HTTP driver supports.
 */
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql, schema });
export { schema };
