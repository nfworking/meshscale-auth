import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Adds an entry to a person's account activity (shown in the platform under Account > Activity). The table is the platform's,
 * in the shared database, so it is written with plain SQL here. Failures are logged and never thrown: sign-in must not
 * fail because the activity log did.
 */
export async function recordAccountEvent(input: { userId: string; action: string; details?: Record<string, unknown>; headers?: Headers | null }) {
  try {
    const ip = (input.headers?.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const userAgent = input.headers?.get("user-agent") ?? null;
    await db.execute(sql`
      insert into platform_account_event (id, user_id, action, details, ip, user_agent)
      values (${crypto.randomUUID()}, ${input.userId}, ${input.action}, ${input.details ? JSON.stringify(input.details) : null}::jsonb, ${ip}, ${userAgent})
    `);
  } catch (error) {
    console.error("[auth] could not write the account activity:", error instanceof Error ? error.message : error);
  }
}
