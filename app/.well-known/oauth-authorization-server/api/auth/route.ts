import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

// RFC 8414 metadata for the issuer https://<host>/api/auth. The OpenID configuration is served by the auth handler itself.
export const GET = oauthProviderAuthServerMetadata(auth);
