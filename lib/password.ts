import { createHash } from "node:crypto";

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;

/**
 * Has this password appeared in a known data breach? Uses the Have I Been Pwned range API, which only ever sees the first
 * five characters of the password's SHA-1 hash, so the password itself never leaves this server. If the service cannot be
 * reached the check passes (and says so in the log): people must still be able to sign up when a third party is down.
 */
export async function isBreached(password: string) {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "meshscale-auth" },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const text = await response.text();
    return text.split("\n").some(line => {
      const [candidate, count] = line.trim().split(":");
      return candidate === suffix && Number(count) > 0; // padded entries have a count of 0
    });
  } catch (error) {
    console.warn("[auth] breached-password check skipped:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** The message shown when a password is too weak, or null when it is acceptable. Shared by sign-up and reset. */
export async function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters.`;
  if (/^(.)\1+$/.test(password)) return "That password is too easy to guess.";
  if (await isBreached(password)) return "That password has appeared in a data breach. Choose a different one.";
  return null;
}
