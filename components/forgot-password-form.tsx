"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { requestPasswordReset, resetPasswordWithCode } from "@/lib/auth-actions";
import { useOAuthSearch } from "@/lib/use-oauth-search";
import { MIN_PASSWORD, PasswordInput } from "./password-input";
import { OtpInput } from "./otp-input";
import { Pending } from "./spinner";

/**
 * Forgot your password, or never set one. A code is emailed, and entering it lets you choose a new password. People who
 * signed up with an email code and have no password yet use the same page to set their first one.
 */
export function ForgotPasswordForm() {
  const search = useOAuthSearch();
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Back to the app they came from: the sign-in page when its signed link is still here, otherwise the platform.
  const signedIn = search.includes("sig=") ? `/sign-in${search}` : process.env.NEXT_PUBLIC_PLATFORM_URL || "/";

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    const message = await requestPasswordReset(email.trim());
    setBusy(false);
    if (message) return setError(message);
    setStep("reset");
  }

  async function reset(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return setError("Enter the six-digit code.");
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    setBusy(true);
    setError("");
    const message = await resetPasswordWithCode({ email: email.trim(), otp: code, password });
    setBusy(false);
    if (message) {
      setCode("");
      return setError(message);
    }
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="au-form au-step" key="done">
        <div className="au-verify-icon au-success"><CheckCircle2 size={22} strokeWidth={1.6} /></div>
        <div>
          <h1>Password updated</h1>
          <p className="au-sub">You can now sign in with <strong>{email.trim()}</strong> and your new password. Other devices have been signed out.</p>
        </div>
        <a className="au-btn au-btn-primary" href={signedIn}>Continue to sign in <ArrowRight size={15} /></a>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <form onSubmit={reset} className="au-form au-step" key="reset" noValidate>
        <button type="button" className="au-back" onClick={() => { setStep("email"); setError(""); setCode(""); }}><ArrowLeft size={14} />Back</button>
        <div>
          <h1>Choose a new password</h1>
          <p className="au-sub">If <strong>{email.trim()}</strong> has an account, we sent it a six-digit code. It expires in 5 minutes.</p>
        </div>
        <OtpInput value={code} onChange={setCode} disabled={busy} />
        <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" disabled={busy} showStrength />
        {error && <p className="au-error" role="alert">{error}</p>}
        <button type="submit" className="au-btn au-btn-primary" disabled={busy || code.length < 6 || password.length < MIN_PASSWORD}>
          <Pending busy={busy}>Update password</Pending>
        </button>
        <p className="au-resend">Didn&apos;t get it? <button type="button" onClick={() => void sendCode()} disabled={busy}>Send a new code</button></p>
      </form>
    );
  }

  return (
    <div className="au-form au-step" key="email">
      <div>
        <h1>Reset your password</h1>
        <p className="au-sub">Enter your email address and we will send you a code. This also works if you signed up with a code and have not set a password yet.</p>
      </div>
      <form onSubmit={sendCode} className="au-fields">
        <div className="au-field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} required autoFocus />
        </div>
        <button type="submit" className="au-btn au-btn-primary" disabled={busy}>
          <Pending busy={busy}>Send code <ArrowRight size={15} /></Pending>
        </button>
      </form>
      {error && <p className="au-error" role="alert">{error}</p>}
      <p className="au-switch"><Link href={search.includes("sig=") ? `/sign-in${search}` : signedIn}>Back to sign in</Link></p>
    </div>
  );
}
