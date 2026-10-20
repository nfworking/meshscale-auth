"use server";

import { headers } from "next/headers";
import { auth } from "./auth";
import { MAX_PASSWORD, passwordProblem } from "./password";
import { bump } from "./rate-limit";

export type SignUpResult = { ok: true } | { ok: false; error: string; code?: "exists" | "code" | "password" | "limit" };

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The second half of creating an account with a password.
 *
 * The first half (the sign-up form) asked for a code to be emailed, and refused an address that already has an account.
 * Here the code is checked, the account is created already verified, and the password is set. Doing it in this order
 * means an account with a password never exists for an address nobody has proved they own, so nobody can register
 * someone else's address with their own password and wait for the owner to arrive.
 *
 * The browser then signs in with the new password, which also continues the OAuth sign-in it came from. The temporary
 * session made here is discarded.
 */
export async function finishSignUp(input: { name: string; email: string; otp: string; password: string }): Promise<SignUpResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const otp = input.otp.trim();
  if (name.length < 1 || name.length > 100) return { ok: false, error: "Enter your name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!/^\d{6}$/.test(otp)) return { ok: false, error: "Enter the six-digit code.", code: "code" };
  if (input.password.length > MAX_PASSWORD) return { ok: false, error: `Use at most ${MAX_PASSWORD} characters.`, code: "password" };

  const requestHeaders = await headers();
  const ip = (requestHeaders.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if ((await bump(`signup:ip:${ip}`, 3600)) > 20 || (await bump(`signup:email:${email}`, 900)) > 8) {
    return { ok: false, error: "Too many attempts. Wait a few minutes and try again.", code: "limit" };
  }

  const context = await auth.$context;
  if (await context.internalAdapter.findUserByEmail(email)) {
    return { ok: false, error: "An account with this email already exists. Sign in instead.", code: "exists" };
  }
  const problem = await passwordProblem(input.password);
  if (problem) return { ok: false, error: problem, code: "password" };

  // Proving the code creates the (verified) account. The code is used up here, so it cannot be tried again.
  let session: Headers;
  try {
    // The headers carry the visitor's address and device into the account's activity; the marker keeps this temporary session out of it.
    const internal = new Headers(requestHeaders);
    internal.set("x-meshscale-internal", "1");
    const result = await auth.api.signInEmailOTP({ body: { email, otp, name }, headers: internal, returnHeaders: true });
    session = new Headers({ cookie: result.headers.getSetCookie().map(value => value.split(";")[0]).join("; ") });
  } catch {
    return { ok: false, error: "That code did not work, or it has expired. Check it and try again.", code: "code" };
  }

  try {
    await auth.api.setPassword({ body: { newPassword: input.password }, headers: session });
  } catch (error) {
    console.error("[auth] could not set the password for a new account:", error instanceof Error ? error.message : error);
    await auth.api.signOut({ headers: session }).catch(() => {});
    return { ok: false, error: "Your account was created, but the password could not be saved. Sign in with an email code, then set a password with “Forgot password”.", code: "password" };
  }
  await auth.api.signOut({ headers: session }).catch(() => {});
  return { ok: true };
}
