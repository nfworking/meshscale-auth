"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { sendSignUpCode, signInWithPassword, signInWithProvider } from "@/lib/auth-actions";
import { finishSignUp } from "@/lib/signup-action";
import { useOAuthSearch } from "@/lib/use-oauth-search";
import { MIN_PASSWORD, PasswordInput } from "./password-input";
import { ProviderButtons } from "./provider-buttons";
import { Pending } from "./spinner";
import { VerifyStep } from "./verify-step";

/**
 * Create an account with a name, an email address and a password. An address that already has an account is refused
 * (nothing is merged and nobody is signed in). The email is proven with a code before the account exists, so an account
 * with a password is never created for an address nobody has shown they own.
 */
export function SignUpForm() {
  const search = useOAuthSearch();
  const [step, setStep] = useState<"start" | "verify">("start");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [exists, setExists] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setExists(false);
    if (!agreed) return setError("Please accept the terms to continue.");
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
    setBusy("start");
    const problem = await sendSignUpCode(email.trim());
    setBusy("");
    if (problem) {
      setError(problem.error);
      setExists(!!problem.exists);
      return;
    }
    setStep("verify");
  }

  async function verify(otp: string) {
    setBusy("verify");
    setError("");
    const result = await finishSignUp({ name: name.trim(), email: email.trim(), otp, password });
    if (!result.ok) {
      setBusy("");
      setError(result.error);
      if (result.code === "exists") setExists(true);
      if (result.code === "exists" || result.code === "password") setStep("start");
      return;
    }
    // The account exists now. Signing in with the new password also continues the sign-in that started at the platform.
    const message = await signInWithPassword(email.trim(), password);
    if (message) {
      setBusy("");
      setError(message);
    }
  }

  async function resend() {
    setError("");
    const problem = await sendSignUpCode(email.trim());
    if (problem) setError(problem.error);
  }

  if (step === "verify") {
    return (
      <VerifyStep
        key="verify"
        email={email.trim()}
        submitLabel="Verify and create account"
        busy={!!busy}
        error={error}
        onBack={() => { setStep("start"); setError(""); }}
        onVerify={otp => void verify(otp)}
        onResend={() => void resend()}
      />
    );
  }

  return (
    <div className="au-form au-step" key="start">
      <div>
        <h1>Create your account</h1>
        <p className="au-sub">Start tunneling in under a minute. No credit card needed.</p>
      </div>

      <ProviderButtons disabled={!!busy} onSelect={provider => { setBusy(provider); void signInWithProvider(provider).then(message => { if (message) setError(message); setBusy(""); }); }} />

      <div className="au-divider"><span>or sign up with email</span></div>

      <form onSubmit={submit} className="au-fields">
        <div className="au-field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" type="text" autoComplete="name" placeholder="Alex Kim" value={name} onChange={event => setName(event.target.value)} disabled={!!busy} required maxLength={100} />
        </div>
        <div className="au-field">
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={event => { setEmail(event.target.value); setExists(false); }} disabled={!!busy} required />
        </div>
        <PasswordInput label="Password" value={password} onChange={setPassword} autoComplete="new-password" disabled={!!busy} showStrength />
        <label className="au-check">
          <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        <button type="submit" className="au-btn au-btn-primary" disabled={!!busy}>
          <Pending busy={busy === "start"}>Create account <ArrowRight size={15} /></Pending>
        </button>
      </form>

      {error && (
        <p className="au-error" role="alert">
          {error}
          {exists && <> <Link href={`/sign-in${search}`}>Sign in</Link> or <Link href={`/forgot-password${search}`}>reset your password</Link>.</>}
        </p>
      )}

      <p className="au-switch">Already have an account? <Link href={`/sign-in${search}`}>Sign in</Link></p>
    </div>
  );
}
