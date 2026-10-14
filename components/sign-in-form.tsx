"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { sendEmailCode, signInWithPasskey, signInWithProvider, verifyEmailCode } from "@/lib/auth-actions";
import { useOAuthSearch } from "@/lib/use-oauth-search";
import { ProviderButtons } from "./provider-buttons";
import { VerifyStep } from "./verify-step";

export function SignInForm() {
  const search = useOAuthSearch();
  const [step, setStep] = useState<"start" | "verify">("start");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Passkey autofill: browsers that support it offer saved passkeys in the email field.
  useEffect(() => {
    if (typeof PublicKeyCredential === "undefined" || !PublicKeyCredential.isConditionalMediationAvailable) return;
    PublicKeyCredential.isConditionalMediationAvailable().then(available => { if (available) void signInWithPasskey(true).catch(() => {}); }).catch(() => {});
  }, []);

  async function run(task: () => Promise<string | null>) {
    setBusy(true);
    setError("");
    const message = await task();
    if (message) setError(message);
    setBusy(false);
    return !message;
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (await run(() => sendEmailCode(email.trim()))) setStep("verify");
  }

  if (step === "verify") {
    return (
      <VerifyStep
        email={email.trim()}
        submitLabel="Verify and sign in"
        busy={busy}
        error={error}
        onBack={() => { setStep("start"); setError(""); }}
        onVerify={otp => void run(() => verifyEmailCode({ email: email.trim(), otp }))}
        onResend={() => void run(() => sendEmailCode(email.trim()))}
      />
    );
  }

  return (
    <div className="au-form">
      <div>
        <h1>Sign in to Meshscale</h1>
        <p className="au-sub">Welcome back. Choose how you would like to continue.</p>
      </div>

      <ProviderButtons disabled={busy} onSelect={provider => void run(() => signInWithProvider(provider))} />

      <button type="button" className="au-btn au-btn-outline" disabled={busy} onClick={() => void run(() => signInWithPasskey())}>
        <span className="au-btn-icon"><KeyRound size={17} strokeWidth={1.8} /></span>
        Sign in with a passkey
      </button>

      <div className="au-divider"><span>or continue with email</span></div>

      <form onSubmit={submitEmail} className="au-fields">
        <div className="au-field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username webauthn" placeholder="you@company.com" value={email} onChange={event => setEmail(event.target.value)} required />
        </div>
        <button type="submit" className="au-btn au-btn-primary" disabled={busy}>{busy ? "Sending code…" : <>Continue with email <ArrowRight size={15} /></>}</button>
      </form>

      {error && <p className="au-error" role="alert">{error}</p>}

      <p className="au-switch">New to Meshscale? <Link href={`/sign-up${search}`}>Create an account</Link></p>
    </div>
  );
}
