export type Provider = "github" | "google" | "cloudflare";

/** Providers that have credentials configured. Set at build and start time by next.config.ts. */
export const enabledProviders = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
  .split(",")
  .filter((name): name is Provider => name === "github" || name === "google" || name === "cloudflare");
