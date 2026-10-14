"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

/** Six single-digit boxes with auto-advance, backspace, arrow keys, paste and one-time-code autofill. */
export function OtpInput({ value, onChange, length = 6, disabled = false }: { value: string; onChange: (value: string) => void; length?: number; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  function focus(index: number) {
    refs.current[Math.max(0, Math.min(index, length - 1))]?.focus();
  }

  function set(index: number, raw: string) {
    const entered = raw.replace(/\D/g, "");
    if (!entered) {
      onChange(digits.map((digit, i) => (i === index ? "" : digit)).join("").trimEnd());
      return;
    }
    // Several digits at once means paste or autofill: spread them from this box onward.
    const next = digits.slice();
    entered.split("").slice(0, length - index).forEach((digit, offset) => { next[index + offset] = digit; });
    onChange(next.join("").slice(0, length));
    focus(index + entered.length);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index]) {
      event.preventDefault();
      onChange(digits.slice(0, Math.max(0, index - 1)).join(""));
      focus(index - 1);
    } else if (event.key === "ArrowLeft") { event.preventDefault(); focus(index - 1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); focus(index + 1); }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  }

  return (
    <div className="au-otp" role="group" aria-label="One-time code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={el => { refs.current[index] = el; }}
          className="au-otp-box"
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          onChange={event => set(index, event.target.value)}
          onKeyDown={event => onKeyDown(index, event)}
          onPaste={onPaste}
          onFocus={event => event.target.select()}
        />
      ))}
    </div>
  );
}
