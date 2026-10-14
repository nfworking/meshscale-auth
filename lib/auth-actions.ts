"use client";

import { authClient } from "./auth-client";
import type { Provider } from "./providers";

/**
 * Thin wrappers around the Better Auth client for the sign-in and sign-up pages. Each returns an error message
 * (or null). When the call succeeds the browser is already on its way back to the platform: the OAuth provider
 * plugin resumes the authorization request that started at the platform and replies with a redirect.
 */

type Redirecting = { url?: string; redirect?: boolean } | null | undefined;

function follow(data: Redirecting) {
  // The client's redirect plugin normally navigates on its own; this covers a response it did not act on.
  if (data?.url && data.redirect) window.location.assign(data.url);
}

export async function sendEmailCode(email: string) {
  const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
  return error ? error.message ?? "We could not send the code. Try again." : null;
}

/** Verifies the code. A first-time email creates the account; `name` is stored then. */
export async function verifyEmailCode({ email, otp, name }: { email: string; otp: string; name?: string }) {
  const { data, error } = await authClient.signIn.emailOtp({ email, otp, ...(name ? { name } : {}) });
  if (error) return error.message ?? "That code did not work. Try again.";
  follow(data as Redirecting);
  return null;
}

export async function signInWithProvider(provider: Provider) {
  const { data, error } = await authClient.signIn.social({ provider });
  if (error) return error.message ?? "We could not start that sign-in.";
  follow(data as Redirecting);
  return null;
}

export async function signInWithPasskey(autoFill = false) {
  const { data, error } = await authClient.signIn.passkey({ autoFill });
  if (error) return error.message ?? "Passkey sign-in did not complete.";
  follow(data as Redirecting);
  return null;
}
