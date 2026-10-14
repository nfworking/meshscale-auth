import path from "node:path";
import type { NextConfig } from "next";

// A social provider is shown on the sign-in pages only when its id and secret are both set.
// This is derived from the same variables lib/auth.ts reads, so there is one source of truth.
const providerVars: [string, string, string][] = [
  ["github", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  ["google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  ["cloudflare", "CLOUDFLARE_CLIENT_ID", "CLOUDFLARE_CLIENT_SECRET"],
];
const enabledProviders = providerVars.filter(([, id, secret]) => process.env[id] && process.env[secret]).map(([name]) => name);

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  env: { NEXT_PUBLIC_AUTH_PROVIDERS: enabledProviders.join(",") },
  // Each app is its own project. Without this, Turbopack infers the shared parent folder as the root and
  // reloads whenever a sibling app's dev server writes files.
  turbopack: {
    root: path.resolve(import.meta.dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
