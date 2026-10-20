"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { sendEmailCode, signInWithPasskey, signInWithPassword, signInWithProvider, verifyEmailCode } from "@/lib/auth-actions";
import { useOAuthSearch } from "@/lib/use-oauth-search";
import { PasswordInput } from "./password-input";
import { ProviderButtons } from "./provider-buttons";
import { Pending } from "./spinner";
import { VerifyStep } from "./verify-step";

/** Sign in with email and password, a passkey, a social account, or a code sent by email. */
export function SignInForm() {
  const search = useOAuthSearch();
  const [step, setStep] = useState<"start" | "verify">("start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Passkey autofill: browsers that support it offer saved passkeys in the email field.
  useEffect(() => {
    if (typeof PublicKeyCredential === "undefined" || !PublicKeyCredential.isConditionalMediationAvailable) return;
    PublicKeyCredential.isConditionalMediationAvailable().then(available => { if (available) void signInWithPasskey(true).catch(() => {}); }).catch(() => {});
  }, []);

  async function run(name: string, task: () => Promise<string | null>) {
    setBusy(name);
    setError("");
    const message = await task();
    if (message) setError(message);
    setBusy("");
    return !message;
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    void run("password", () => signInWithPassword(email.trim(), password));
  }

  async function emailMeACode() {
    if (!email.trim()) return setError("Enter your email address first.");
    if (await run("code", () => sendEmailCode(email.trim()))) setStep("verify");
  }

  if (step === "verify") {
    return (
      <VerifyStep
        key="verify"
        email={email.trim()}
        submitLabel="Verify and sign in"
        busy={!!busy}
        error={error}
        onBack={() => { setStep("start"); setError(""); }}
        onVerify={otp => void run("verify", () => verifyEmailCode({ email: email.trim(), otp }))}
        onResend={() => void run("resend", () => sendEmailCode(email.trim()))}
      />
    );
  }

  return (
    <div className="au-form au-step" key="start">
      <div>
        <h1>Sign in to Meshscale</h1>
        <p className="au-sub">Welcome back. Choose how you would like to continue.</p>
      </div>

      <ProviderButtons disabled={!!busy} onSelect={provider => void run(provider, () => signInWithProvider(provider))} />

      <button type="button" className="au-btn au-btn-outline" disabled={!!busy} onClick={() => void run("passkey", () => signInWithPasskey())}>
        <span className="au-btn-icon"><KeyRound size={17} strokeWidth={1.8} /></span>
        <Pending busy={busy === "passkey"}>Sign in with a passkey</Pending>
      </button>

      <div className="au-divider"><span>or use your email</span></div>

      <form onSubmit={submitPassword} className="au-fields">
        <div className="au-field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username webauthn" placeholder="you@company.com" value={email} onChange={event => setEmail(event.target.value)} disabled={!!busy} required />
        </div>
        <div className="au-field-stack">
          <PasswordInput label="Password" value={password} onChange={setPassword} autoComplete="current-password" disabled={!!busy} />
          <Link href={`/forgot-password${search}`} className="au-forgot">Forgot password?</Link>
        </div>
        <button type="submit" className="au-btn au-btn-primary" disabled={!!busy}>
          <Pending busy={busy === "password"}>Sign in <ArrowRight size={15} /></Pending>
        </button>
        <button type="button" className="au-btn au-btn-outline" disabled={!!busy} onClick={() => void emailMeACode()}>
          <span className="au-btn-icon"><Mail size={16} strokeWidth={1.8} /></span>
          <Pending busy={busy === "code"}>Email me a code instead</Pending>
        </button>
      </form>

      {error && <p className="au-error" role="alert">{error}</p>}

      <p className="au-switch">New to Meshscale? <Link href={`/sign-up${search}`}>Create an account</Link></p>
    </div>
  );
}
