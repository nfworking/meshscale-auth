"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { OtpInput } from "./otp-input";

const RESEND_SECONDS = 30;

/** Second step of email sign-in and sign-up: enter the six-digit code that was emailed. */
export function VerifyStep({ email, submitLabel, busy, error, onBack, onVerify, onResend }: {
  email: string;
  submitLabel: string;
  busy: boolean;
  error: string;
  onBack: () => void;
  onVerify: (code: string) => void;
  onResend: () => void;
}) {
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  // A wrong code clears the boxes so the next attempt starts fresh.
  useEffect(() => { if (error) setCode(""); }, [error]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (code.length === 6 && !busy) onVerify(code);
  }

  function resend() {
    setCode("");
    setWait(RESEND_SECONDS);
    onResend();
  }

  return (
    <form onSubmit={submit} className="au-form" noValidate>
      <button type="button" className="au-back" onClick={onBack}><ArrowLeft size={14} />Back</button>
      <div className="au-verify-icon"><MailCheck size={22} strokeWidth={1.6} /></div>
      <div>
        <h1>Check your email</h1>
        <p className="au-sub">We sent a six-digit code to <strong>{email}</strong>. It expires in 5 minutes.</p>
      </div>
      <OtpInput value={code} onChange={setCode} disabled={busy} />
      {error && <p className="au-error" role="alert">{error}</p>}
      <button type="submit" className="au-btn au-btn-primary" disabled={code.length < 6 || busy}>{busy ? "Verifying…" : submitLabel}</button>
      <p className="au-resend">
        Didn&apos;t get it?{" "}
        {wait > 0 ? <span>Resend in {wait}s</span> : <button type="button" onClick={resend}>Resend code</button>}
      </p>
    </form>
  );
}
