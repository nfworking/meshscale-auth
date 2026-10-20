import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP, jwt, organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { oauthDeviceAuthorization, oauthProvider } from "@better-auth/oauth-provider";
import { passkey } from "@better-auth/passkey";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "./db";
import { recordAccountEvent } from "./account-events";
import { sendOtpEmail } from "./email";
import { MAX_PASSWORD, MIN_PASSWORD, passwordProblem } from "./password";
import { bump, clearAttempts, redisRateLimit } from "./rate-limit";

const baseURL = process.env.BETTER_AUTH_URL!;
const platformURL = process.env.PLATFORM_URL!;

/** The platform's API is the protected resource CLI access tokens are issued for. Setting it makes them JWTs the platform can verify. */
export const platformApiResource = process.env.PLATFORM_API_RESOURCE ?? `${platformURL}/api`;

/**
 * Passkeys are bound to a relying party id. The platform manages them (it is the only place people go), while sign-in
 * happens here, so the id must be valid for both origins. Locally that is `localhost`; in production set it to the
 * shared parent domain, for example `meshscale.cloud`.
 */
const passkeyRpId = process.env.PASSKEY_RP_ID ?? new URL(baseURL).hostname;

/** First-party clients skip the consent screen. They are also listed here so lookups never hit the database. */
const trustedClients = new Set([process.env.PLATFORM_CLIENT_ID].filter((id): id is string => !!id));

/** A social provider is enabled only when both its id and secret are present. */
const social = (id?: string, secret?: string) => (id && secret ? { clientId: id, clientSecret: secret } : undefined);

/** The one team a person belongs to, if they belong to exactly one. */
async function soleOrganization(userId: string) {
  const memberships = await db.select({ organizationId: schema.member.organizationId }).from(schema.member).where(eq(schema.member.userId, userId)).limit(2);
  return memberships.length === 1 ? memberships[0].organizationId : undefined;
}

export const auth = betterAuth({
  appName: "Meshscale",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: [platformURL],

  // The platform and this server both run on `localhost`, and cookies are shared across ports.
  // A distinct prefix keeps the two sessions from overwriting each other.
  advanced: { cookiePrefix: "meshscale-auth" },

  // The OAuth provider serves the token endpoint at /oauth2/token. Better Auth's own /token is turned off.
  // /sign-up/email is closed to the public: an account with a password is only created by our own sign-up step, after the
  // email address has been proven with a code (lib/signup-action.ts). Otherwise anyone could register somebody else's address
  // with a password of their own and wait for the owner to arrive.
  disabledPaths: ["/token", "/sign-up/email"],

  // Email addresses are unique. Better Auth stores them lower-case and the database enforces it (also case-insensitively),
  // so one address is one account: signing up with an address that already has an account is refused, not merged.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD,
    maxPasswordLength: MAX_PASSWORD,
    requireEmailVerification: true,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
  },

  hooks: {
    before: createAuthMiddleware(async ctx => {
      // Starting a sign-up with an address that already has an account is an error, not a silent sign-in.
      if (ctx.path === "/email-otp/send-verification-otp" && ctx.headers?.get("x-meshscale-signup") === "1") {
        const email = String((ctx.body as { email?: string } | undefined)?.email ?? "").trim().toLowerCase();
        if (email && (await ctx.context.internalAdapter.findUserByEmail(email))) {
          throw new APIError("BAD_REQUEST", { message: "An account with this email already exists. Sign in instead.", code: "EMAIL_ALREADY_REGISTERED" });
        }
      }
      // Choosing a new password through the email code gets the same checks as signing up.
      if (ctx.path === "/email-otp/reset-password") {
        const problem = await passwordProblem(String((ctx.body as { password?: string } | undefined)?.password ?? ""));
        if (problem) throw new APIError("BAD_REQUEST", { message: problem, code: "WEAK_PASSWORD" });
      }
      // Failed password attempts are counted per email address across every IP, so a botnet cannot go around the per-IP limit.
      if (ctx.path === "/sign-in/email") {
        const email = String((ctx.body as { email?: string } | undefined)?.email ?? "").trim().toLowerCase();
        if (email && (await bump(`pw:${email}`, 15 * 60)) > 10) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "Too many sign-in attempts for this account. Wait 15 minutes, or use an email code instead." });
        }
      }
    }),
    after: createAuthMiddleware(async ctx => {
      const body = (ctx.body ?? {}) as { email?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      // Our own server-side calls (the sign-up step) set this header; their temporary session is not a real sign-in.
      const internal = ctx.headers?.get("x-meshscale-internal") === "1";

      if (ctx.path === "/sign-in/email" && ctx.context.newSession && email) await clearAttempts(`pw:${email}`);

      // A sign-in, and how it was done.
      const session = ctx.context.newSession;
      if (session && !internal) {
        const method =
          ctx.path === "/sign-in/email" ? "password" :
          ctx.path === "/sign-in/email-otp" ? "email_code" :
          ctx.path === "/passkey/verify-authentication" ? "passkey" :
          ctx.path.startsWith("/callback/") ? `social:${ctx.path.split("/")[2]}` : null;
        if (method) await recordAccountEvent({ userId: session.user.id, action: "sign_in", details: { method }, headers: ctx.headers });
      }

      // A wrong password for a real account. Recorded at most once every five minutes, so nobody can flood someone's activity.
      if (ctx.path === "/sign-in/email" && email && isAPIError(ctx.context.returned)) {
        const found = await ctx.context.internalAdapter.findUserByEmail(email);
        if (found && (await bump(`failevt:${found.user.id}`, 300)) === 1) {
          await recordAccountEvent({ userId: found.user.id, action: "sign_in_failed", details: { method: "password" }, headers: ctx.headers });
        }
      }

      // A password chosen with the emailed code.
      if (ctx.path === "/email-otp/reset-password" && email && !isAPIError(ctx.context.returned)) {
        const found = await ctx.context.internalAdapter.findUserByEmail(email);
        if (found) await recordAccountEvent({ userId: found.user.id, action: "password_changed", details: { via: "email_code" }, headers: ctx.headers });
      }
    }),
  },

  // In production (Vercel) the counters live in Redis so limits hold across instances.
  rateLimit: {
    enabled: true,
    ...(process.env.REDIS_URL ? { customStorage: redisRateLimit } : {}),
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/email-otp/request-password-reset": { window: 60, max: 3 },
      "/email-otp/reset-password": { window: 60, max: 5 },
    },
  },

  socialProviders: {
    github: social(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET),
    google: social(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET),
    cloudflare: social(process.env.CLOUDFLARE_CLIENT_ID, process.env.CLOUDFLARE_CLIENT_SECRET),
  },

  // Sessions are tagged with the app that created them, so the account page can tell sign-in sessions from dashboard ones.
  session: { additionalFields: { client: { type: "string", required: false, input: false } } },

  databaseHooks: {
    user: {
      create: {
        after: async (created, context) => {
          await recordAccountEvent({ userId: created.id, action: "account_created", headers: context?.headers ?? null });
        },
      },
    },
    session: {
      create: {
        // Users with exactly one organization land in it automatically. Everyone else picks one at /select-org.
        before: async session => {
          const memberships = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .limit(2);
          return { data: { ...session, client: "sso", activeOrganizationId: memberships.length === 1 ? memberships[0].organizationId : undefined } };
        },
      },
    },
  },

  plugins: [
    jwt(),
    organization({ allowUserToCreateOrganization: true }),
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      signup: { page: "/sign-up" },
      // Before tokens are issued, the user must have an active organization (auth spec 5.1).
      postLogin: {
        page: "/select-org",
        shouldRedirect: async ({ user, session }) => {
          if (session.activeOrganizationId) return false;
          // Joined a team after signing in (an accepted invitation, say): with exactly one team there is nothing to choose.
          const only = await soleOrganization(user.id);
          if (only) {
            await db.update(schema.session).set({ activeOrganizationId: only }).where(eq(schema.session.id, session.id));
            return false;
          }
          // Someone who was invited to a team joins it from the invite link, so they are not asked to create one first.
          const pending = await db
            .select({ id: schema.invitation.id })
            .from(schema.invitation)
            .where(and(eq(schema.invitation.email, user.email.toLowerCase()), eq(schema.invitation.status, "pending"), gt(schema.invitation.expiresAt, new Date())))
            .limit(1);
          return pending.length === 0;
        },
        consentReferenceId: async ({ user, session }) => (session.activeOrganizationId as string | null | undefined) ?? (await soleOrganization(user.id)),
      },
      // A CLI waiting for approval polls the token endpoint every few seconds (RFC 8628), which the default of 20 a minute would trip.
      rateLimit: { token: { window: 60, max: 60 } },
      cachedTrustedClients: trustedClients,
      scopes: ["openid", "profile", "email", "offline_access", "tunnel:connect", "tunnel:read", "tunnel:manage"],
      resources: [{ identifier: platformApiResource, name: "Meshscale platform API", allowedScopes: ["tunnel:connect", "tunnel:read", "tunnel:manage"] }],
      // Namespaced claim carrying the active organization (auth spec 7).
      customAccessTokenClaims: ({ referenceId }) => ({ "https://meshscale.cloud/org": referenceId }),
    }),
    // CLI login (RFC 8628). People start at the platform's /device page, which sends them through single sign-on and on to this server's /device page.
    oauthDeviceAuthorization({ verificationUri: `${platformURL}/device`, expiresIn: "10m", interval: "5s", userCodeLength: 8 }),
    emailOTP({
      // Not awaited, because awaiting the send leaks timing information (Better Auth docs). On serverless the function
      // is frozen once the response is sent, which would cut the send off, so `after` keeps it alive until it finishes.
      sendVerificationOTP: async ({ email, otp, type }) => {
        const send = sendOtpEmail({ to: email, otp, type });
        try {
          after(send);
        } catch {
          void send; // outside a request (scripts): nothing to keep alive
        }
      },
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
    }),
    passkey({
      rpID: passkeyRpId,
      rpName: "Meshscale",
      origin: [baseURL, platformURL],
    }),
    // Must stay last so cookies set inside Server Actions and Route Handlers are applied.
    nextCookies(),
  ],
});
