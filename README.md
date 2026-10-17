# Meshscale auth server

A standalone [Better Auth](https://better-auth.com/docs) service. It owns identity and is the single sign-on provider for the platform (and later the CLI and relay). See `../auth-server-spec.md` and `../platform-spec.md`.

People never come here directly. The platform starts a sign-in, the OAuth provider signs the request, and the login pages here only render for a request with a valid signature. Anything else is redirected to the platform (`proxy.ts`).

## What is implemented

| Area | How |
| --- | --- |
| Database | Neon Postgres, Drizzle ORM (`lib/db`), neon-http driver |
| Sign-in | Email code (Resend), passkey sign-in, GitHub / Google / Cloudflare when credentials are set |
| OAuth 2.1 / OIDC provider | `@better-auth/oauth-provider` with `jwt()`: authorization code + PKCE, refresh tokens, JWKS, discovery, userinfo, end-session |
| Organizations | `organization()`; a user with one org lands in it, otherwise `/select-org` (post-login step) |
| Hosted pages | `/sign-in`, `/sign-up`, `/select-org`, `/consent` |
| Invited people | A pending invitation skips `/select-org`; they accept it on the platform. With exactly one team, `/select-org` is skipped too |
| Shared database | The platform runs its own Better Auth against this database for organizations and passkey management (see `../platform/README.md`). Sessions carry a `client` tag (`sso` here) |
| First-party clients | `platform` (confidential) and `tunnel-cli` (public, device flow), registered by `pnpm db:seed`; both skip the consent screen |
| CLI login | `oauthDeviceAuthorization()`: the CLI asks for a code, people approve it at `/device` (reached through the platform), and the token is a JWT for the platform API resource (`PLATFORM_API_RESOURCE`) |
| Direct-access gate | `proxy.ts` verifies the signed OAuth query with `verifyOAuthQueryParams` |

Not built yet (in the spec): two-factor, dynamic base URL. Passkeys are registered and managed on the platform account page and used for sign-in here, so `PASSKEY_RP_ID` must be the same in both apps.

## Running it locally

```bash
pnpm install
cp .env.example .env.local     # fill in DATABASE_URL and BETTER_AUTH_SECRET
pnpm db:migrate                # applies ./drizzle to Neon
pnpm db:seed                   # registers the platform client, writes ../platform/.env.local
pnpm dev --port 3001
```

Start this server first, then the platform (`pnpm dev` in `../platform`, port 3000). The platform retries until it can reach this server, so the order is not strict.

Without `RESEND_API_KEY`, one-time codes are printed in this server's log in development.

## Database changes

Better Auth generates the Drizzle schema from the plugins in `lib/auth.ts`:

```bash
pnpm auth:schema     # rewrites lib/db/schema.ts
pnpm db:generate     # creates a migration
pnpm db:migrate      # applies it
```

## Decisions worth knowing

- **The platform is an OIDC client, not a cookie proxy.** This follows the "platform as OIDC client" alternative in auth spec section 10, so the dynamic base URL and proxy setup from section 2.1 are not used.
- **`localhost` clients are registered as `native`.** The provider only allows `http` loopback redirect URIs for native clients. With an `https` platform URL, `pnpm db:seed` registers a normal `web` client.
- **Distinct cookie prefixes** (`meshscale-auth`, `meshscale-platform`) because cookies are shared across ports on `localhost`.
- **Versions are pinned** (Better Auth 1.7.7) because the spec warns that the docs and APIs differ between releases.
- The OAuth option is `signup`, not `signUp` (checked against the installed 1.7.7 types).
