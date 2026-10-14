"use client";

import { enabledProviders, type Provider } from "@/lib/providers";
import { CloudflareIcon, GitHubIcon, GoogleIcon } from "./icons";

const labels: Record<Provider, { label: string; icon: React.ReactNode }> = {
  github: { label: "Continue with GitHub", icon: <GitHubIcon /> },
  google: { label: "Continue with Google", icon: <GoogleIcon /> },
  cloudflare: { label: "Continue with Cloudflare", icon: <CloudflareIcon /> },
};

/** Social sign-in buttons. Only providers with credentials configured on the server are shown. */
export function ProviderButtons({ onSelect, disabled }: { onSelect: (provider: Provider) => void; disabled?: boolean }) {
  if (!enabledProviders.length) return null;
  return (
    <div className="au-providers">
      {enabledProviders.map(provider => (
        <button key={provider} type="button" className="au-btn au-btn-outline" disabled={disabled} onClick={() => onSelect(provider)}>
          <span className="au-btn-icon">{labels[provider].icon}</span>
          {labels[provider].label}
        </button>
      ))}
    </div>
  );
}
