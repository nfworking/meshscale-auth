"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export const MIN_PASSWORD = 10;

/** 0 to 4. Length is what counts; mixing character kinds adds a little. This guides people; the server decides what is allowed. */
export function strengthOf(value: string) {
  if (!value) return 0;
  if (value.length < MIN_PASSWORD) return 1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(value)).length;
  if (value.length >= 16 || (value.length >= 12 && kinds >= 3)) return 4;
  return kinds >= 3 ? 3 : 2;
}

const labels = ["", "Too short", "Okay", "Good", "Strong"];

export function PasswordInput({ label, value, onChange, autoComplete, disabled, showStrength = false, hint, id: givenId }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  showStrength?: boolean;
  hint?: string;
  id?: string;
}) {
  const generated = useId();
  const id = givenId ?? generated;
  const [shown, setShown] = useState(false);
  const score = strengthOf(value);
  return (
    <div className="au-field">
      <label htmlFor={id}>{label}</label>
      <div className="au-password">
        <input id={id} name="password" type={shown ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required minLength={showStrength ? MIN_PASSWORD : undefined} maxLength={128} spellCheck={false} autoCapitalize="none" />
        <button type="button" className="au-password-toggle" onClick={() => setShown(current => !current)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} tabIndex={-1}>
          {shown ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
        </button>
      </div>
      {showStrength && (
        <div className="au-strength" data-score={score} aria-live="polite">
          <span className="au-strength-bars" aria-hidden="true"><i /><i /><i /><i /></span>
          <small>{value ? labels[score] : hint ?? `At least ${MIN_PASSWORD} characters`}</small>
        </div>
      )}
    </div>
  );
}
