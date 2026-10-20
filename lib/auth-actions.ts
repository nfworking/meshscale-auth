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

/** Why a sign-in failed, in words fit to show. Wrong email and wrong password look the same on purpose. */
function signInMessage(error: { message?: string; code?: string; status?: number }) {
  if (error.status === 429) return error.message ?? "Too many attempts. Wait a moment and try again.";
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "Incorrect email or password.";
  if (error.code === "EMAIL_NOT_VERIFIED") return "Verify your email first: choose Email me a code instead.";
  return error.message ?? "We could not sign you in. Try again.";
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await authClient.signIn.email({ email, password });
  if (error) return signInMessage(error);
  follow(data as Redirecting);
  return null;
}

/** Starts sign-up: emails a code, but refuses an address that already has an account. */
export async function sendSignUpCode(email: string): Promise<{ error: string; exists?: boolean } | null> {
  const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in", fetchOptions: { headers: { "x-meshscale-signup": "1" } } });
  if (!error) return null;
  return { error: error.message ?? "We could not send the code. Try again.", exists: (error as { code?: string }).code === "EMAIL_ALREADY_REGISTERED" };
}

/** Starts a password reset (or setting a first password): emails a code. Says the same thing whether or not the address has an account. */
export async function requestPasswordReset(email: string) {
  const { error } = await authClient.emailOtp.requestPasswordReset({ email });
  return error ? error.message ?? "We could not send the code. Try again." : null;
}

export async function resetPasswordWithCode({ email, otp, password }: { email: string; otp: string; password: string }) {
  const { error } = await authClient.emailOtp.resetPassword({ email, otp, password });
  if (!error) return null;
  if (error.status === 429) return error.message ?? "Too many attempts. Wait a moment and try again.";
  if ((error as { code?: string }).code === "WEAK_PASSWORD") return error.message ?? "Choose a stronger password.";
  return error.message ?? "That code did not work, or it has expired.";
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
