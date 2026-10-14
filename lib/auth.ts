import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP, jwt, organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { oauthProvider } from "@better-auth/oauth-provider";
import { passkey } from "@better-auth/passkey";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "./db";
import { sendOtpEmail } from "./email";

const baseURL = process.env.BETTER_AUTH_URL!;
const platformURL = process.env.PLATFORM_URL!;

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
  disabledPaths: ["/token"],

  rateLimit: { enabled: true },

  socialProviders: {
    github: social(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET),
    google: social(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET),
    cloudflare: social(process.env.CLOUDFLARE_CLIENT_ID, process.env.CLOUDFLARE_CLIENT_SECRET),
  },

  // Sessions are tagged with the app that created them, so the account page can tell sign-in sessions from dashboard ones.
  session: { additionalFields: { client: { type: "string", required: false, input: false } } },

  databaseHooks: {
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
      cachedTrustedClients: trustedClients,
      scopes: ["openid", "profile", "email", "offline_access", "tunnel:connect", "tunnel:read", "tunnel:manage"],
      // Namespaced claim carrying the active organization (auth spec 7).
      customAccessTokenClaims: ({ referenceId }) => ({ "https://meshscale.cloud/org": referenceId }),
    }),
    emailOTP({
      // Not awaited on purpose: awaiting the send leaks timing information (Better Auth docs).
      sendVerificationOTP: async ({ email, otp, type }) => {
        void sendOtpEmail({ to: email, otp, type });
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
