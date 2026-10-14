/**
 * Registers the platform as a first-party OAuth client of this auth server (auth spec section 6).
 *
 *   pnpm db:seed
 *
 * It uses Better Auth's server-only `adminCreateOAuthClient`, then writes the generated client id and secret into
 * auth/.env.local and platform/.env.local. Running it again does nothing once the client exists.
 */
import { randomBytes, randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: resolve(process.cwd(), ".env.local") });

function setEnv(file: string, values: Record<string, string>) {
  let text = existsSync(file) ? readFileSync(file, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    text = new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
  }
  writeFileSync(file, text);
}

async function main() {
  // Imported after the environment is loaded, because the auth config reads it at import time.
  const { auth } = await import("../lib/auth");
  const { db, schema } = await import("../lib/db");

  const platformURL = process.env.PLATFORM_URL!;
  const existingId = process.env.PLATFORM_CLIENT_ID;
  if (existingId) {
    const found = await db.select({ id: schema.oauthClient.clientId }).from(schema.oauthClient).where(eq(schema.oauthClient.clientId, existingId)).limit(1);
    if (found.length) {
      console.log(`The platform client already exists (${existingId}). Nothing to do.`);
      return;
    }
  }

  // The client endpoints need a real session. A dedicated system user owns first-party clients: the script
  // stores a one-time code for it and signs in through the email OTP plugin itself.
  const ctx = await auth.$context;
  const systemEmail = "system@meshscale.cloud";
  const otp = String(randomInt(100000, 1000000));
  await ctx.internalAdapter.createVerificationValue({
    identifier: `sign-in-otp-${systemEmail}`,
    value: `${otp}:0`,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const signedIn = await auth.api.signInEmailOTP({ body: { email: systemEmail, otp, name: "Meshscale System" }, returnHeaders: true });
  const cookie = signedIn.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");

  const client = await auth.api.adminCreateOAuthClient({
    headers: new Headers({ cookie }),
    body: {
      client_name: "Meshscale Platform",
      redirect_uris: [`${platformURL}/api/auth/callback/meshscale`],
      post_logout_redirect_uris: [platformURL],
      token_endpoint_auth_method: "client_secret_basic",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid profile email offline_access",
      // The provider allows http loopback redirects (local development) only for native clients.
      // With an https platform URL it is registered as a regular web client.
      application_type: platformURL.startsWith("https://") ? "web" : "native",
      require_pkce: true,
      skip_consent: true, // first-party: no consent screen
      enable_end_session: true, // lets the platform sign the user out of SSO too
      client_secret_expires_at: 0,
    },
  });
  await auth.api.signOut({ headers: new Headers({ cookie }) });

  const platformEnv = resolve(process.cwd(), "..", "platform", ".env.local");
  setEnv(resolve(process.cwd(), ".env.local"), { PLATFORM_CLIENT_ID: client.client_id });
  setEnv(platformEnv, {
    AUTH_URL: process.env.BETTER_AUTH_URL!,
    PLATFORM_URL: platformURL,
    AUTH_CLIENT_ID: client.client_id,
    AUTH_CLIENT_SECRET: client.client_secret ?? "",
    BETTER_AUTH_SECRET: existsSync(platformEnv) && /^BETTER_AUTH_SECRET=.+$/m.test(readFileSync(platformEnv, "utf8")) ? readFileSync(platformEnv, "utf8").match(/^BETTER_AUTH_SECRET=(.+)$/m)![1] : randomBytes(32).toString("base64"),
  });
  console.log(`Created the platform client ${client.client_id}.`);
  console.log("Wrote PLATFORM_CLIENT_ID to auth/.env.local and the client credentials to platform/.env.local.");
  console.log("Restart both dev servers so they pick the values up.");
}

main().then(() => process.exit(0), error => {
  console.error(error);
  process.exit(1);
});
