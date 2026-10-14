"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { sendEmailCode, signInWithProvider, verifyEmailCode } from "@/lib/auth-actions";
import { useOAuthSearch } from "@/lib/use-oauth-search";
import { ProviderButtons } from "./provider-buttons";
import { VerifyStep } from "./verify-step";

/**
 * Email-OTP sign-in creates the account on first use (auth spec section 4), so sign-up only collects a name
 * and an email and then reuses the same code step. The name is stored when the code is verified.
 */
export function SignUpForm() {
  const search = useOAuthSearch();
  const [step, setStep] = useState<"start" | "verify">("start");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(task: () => Promise<string | null>) {
    setBusy(true);
    setError("");
    const message = await task();
    if (message) setError(message);
    setBusy(false);
    return !message;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!agreed) { setError("Please accept the terms to continue."); return; }
    if (await run(() => sendEmailCode(email.trim()))) setStep("verify");
  }

  if (step === "verify") {
    return (
      <VerifyStep
        email={email.trim()}
        submitLabel="Verify and create account"
        busy={busy}
        error={error}
        onBack={() => { setStep("start"); setError(""); }}
        onVerify={otp => void run(() => verifyEmailCode({ email: email.trim(), otp, name: name.trim() }))}
        onResend={() => void run(() => sendEmailCode(email.trim()))}
      />
    );
  }

  return (
    <div className="au-form">
      <div>
        <h1>Create your account</h1>
        <p className="au-sub">Start tunneling in under a minute. No credit card needed.</p>
      </div>

      <ProviderButtons disabled={busy} onSelect={provider => void run(() => signInWithProvider(provider))} />

      <div className="au-divider"><span>or sign up with email</span></div>

      <form onSubmit={submit} className="au-fields">
        <div className="au-field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" type="text" autoComplete="name" placeholder="Alex Kim" value={name} onChange={event => setName(event.target.value)} required />
        </div>
        <div className="au-field">
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={event => setEmail(event.target.value)} required />
        </div>
        <label className="au-check">
          <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        <button type="submit" className="au-btn au-btn-primary" disabled={busy}>{busy ? "Sending code…" : <>Create account <ArrowRight size={15} /></>}</button>
      </form>

      {error && <p className="au-error" role="alert">{error}</p>}

      <p className="au-switch">Already have an account? <Link href={`/sign-in${search}`}>Sign in</Link></p>
    </div>
  );
}
