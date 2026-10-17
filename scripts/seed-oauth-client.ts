/**
 * Registers the first-party OAuth clients (auth spec section 6): the platform (confidential) and the CLI (public, device flow).
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

/** Signs in the system user that owns first-party clients. The client endpoints need a real session, so the script
 * stores a one-time code for it and signs in through the email OTP plugin itself. */
async function systemSession(auth: Awaited<typeof import("../lib/auth")>["auth"]) {
  const ctx = await auth.$context;
  const systemEmail = "system@meshscale.cloud";
  const otp = String(randomInt(100000, 1000000));
  await ctx.internalAdapter.createVerificationValue({
    identifier: `sign-in-otp-${systemEmail}`,
    value: `${otp}:0`,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const signedIn = await auth.api.signInEmailOTP({ body: { email: systemEmail, otp, name: "Meshscale System" }, returnHeaders: true });
  return new Headers({ cookie: signedIn.headers.getSetCookie().map(value => value.split(";")[0]).join("; ") });
}

async function main() {
  // Imported after the environment is loaded, because the auth config reads it at import time.
  const { auth } = await import("../lib/auth");
  const { db, schema } = await import("../lib/db");

  const platformURL = process.env.PLATFORM_URL!;
  const callback = `${platformURL}/api/auth/callback/meshscale`;
  const clients = await db.select({ id: schema.oauthClient.clientId, name: schema.oauthClient.name, redirectUris: schema.oauthClient.redirectUris }).from(schema.oauthClient);
  const platformClient = clients.find(client => client.redirectUris.includes(callback));
  const cliClient = clients.find(client => client.name === "Meshscale CLI");
  const headers = await systemSession(auth);
  if (platformClient && cliClient) {
    console.log(`The clients already exist (platform ${platformClient.id}, CLI ${cliClient.id}).`);
    await linkResource(auth, headers, cliClient.id);
    await auth.api.signOut({ headers });
    writeEnv(platformClient.id, undefined, cliClient.id);
    return;
  }
  let platformSecret: string | undefined;
  let platformId = platformClient?.id;
  let cliId = cliClient?.id;

  if (!platformClient) {
    const client = await auth.api.adminCreateOAuthClient({
      headers,
      body: {
        client_name: "Meshscale Platform",
        redirect_uris: [callback],
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
    platformId = client.client_id;
    platformSecret = client.client_secret ?? "";
    console.log(`Created the platform client ${platformId}.`);
  }

  if (!cliClient) {
    // A public native client: no secret, device authorization grant (auth spec section 6). The redirect URI is required
    // by the registration schema but never used by the device flow.
    const client = await auth.api.adminCreateOAuthClient({
      headers,
      body: {
        client_name: "Meshscale CLI",
        redirect_uris: ["http://127.0.0.1/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
        response_types: [],
        scope: "openid email offline_access tunnel:connect tunnel:read",
        application_type: "native",
        skip_consent: true,
      },
    });
    cliId = client.client_id;
    console.log(`Created the CLI client ${cliId}.`);
  }
  await linkResource(auth, headers, cliId!);
  await auth.api.signOut({ headers });

  writeEnv(platformId!, platformSecret, cliId!);
  console.log("Restart the servers so they pick the values up.");
}

/** Access tokens are issued for a protected resource only to clients linked to it. The CLI needs the platform API. */
async function linkResource(auth: Awaited<typeof import("../lib/auth")>["auth"], headers: Headers, clientId: string) {
  const { platformApiResource } = await import("../lib/auth");
  try {
    await auth.api.adminLinkClientResource({ headers, params: { identifier: encodeURIComponent(platformApiResource), client_id: clientId } });
    console.log(`Linked the CLI client to ${platformApiResource}.`);
  } catch (error) {
    // Already linked is fine; anything else is worth seeing.
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|exists|unique/i.test(message)) throw error;
  }
}

function writeEnv(platformId: string, platformSecret: string | undefined, cliId: string) {
  // SEED_ENV_OUT: write the platform's variables to that file instead of the local .env.local files. Used to prepare
  // a deployment (the secret goes to a file, never to the terminal) without disturbing local development.
  const out = process.env.SEED_ENV_OUT;
  if (out) {
    setEnv(out, {
      AUTH_URL: process.env.BETTER_AUTH_URL!,
      PLATFORM_URL: process.env.PLATFORM_URL!,
      AUTH_CLIENT_ID: platformId,
      ...(platformSecret ? { AUTH_CLIENT_SECRET: platformSecret } : {}),
      CLI_CLIENT_ID: cliId,
    });
    console.log(`Wrote the platform variables for ${process.env.PLATFORM_URL} to ${out}.`);
    return;
  }
  const platformEnv = resolve(process.cwd(), "..", "platform", ".env.local");
  const existing = existsSync(platformEnv) ? readFileSync(platformEnv, "utf8") : "";
  setEnv(resolve(process.cwd(), ".env.local"), { PLATFORM_CLIENT_ID: platformId, CLI_CLIENT_ID: cliId });
  setEnv(platformEnv, {
    AUTH_URL: process.env.BETTER_AUTH_URL!,
    PLATFORM_URL: process.env.PLATFORM_URL!,
    AUTH_CLIENT_ID: platformId,
    ...(platformSecret ? { AUTH_CLIENT_SECRET: platformSecret } : {}),
    CLI_CLIENT_ID: cliId,
    BETTER_AUTH_SECRET: /^BETTER_AUTH_SECRET=.+$/m.test(existing) ? existing.match(/^BETTER_AUTH_SECRET=(.+)$/m)![1] : randomBytes(32).toString("base64"),
  });
}

main().then(() => process.exit(0), error => {
  console.error(error);
  process.exit(1);
});
