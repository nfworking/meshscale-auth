"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { oauthDeviceAuthorizationClient, oauthProviderClient } from "@better-auth/oauth-provider/client";
import { passkeyClient } from "@better-auth/passkey/client";

/**
 * Browser client for the sign-in pages. It talks to this server's own origin.
 * `oauthProviderClient` adds the signed OAuth query from the page URL to every sign-in request,
 * which is how an in-progress authorization continues after the user signs in.
 */
export const authClient = createAuthClient({
  plugins: [oauthProviderClient(), oauthDeviceAuthorizationClient(), emailOTPClient(), organizationClient(), passkeyClient()],
});
