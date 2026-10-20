"use client";

import { useEffect, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ClientMark } from "./client-mark";
import { Pending, Spinner } from "./spinner";

const scopeText: Record<string, string> = {
  openid: "Verify your identity",
  profile: "See your name and profile picture",
  email: "See your email address",
  offline_access: "Stay connected when you are not using the app",
  "tunnel:connect": "Open tunnels from your machine",
  "tunnel:read": "See your tunnels and their status",
  "tunnel:manage": "Change access rules and stop tunnels",
};

/** Consent screen for third-party clients. First-party clients such as the platform skip it entirely. */
export function ConsentForm() {
  const [client, setClient] = useState<{ name: string; scopes: string[]; logo: string | null } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("client_id") ?? "";
    const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean);
    authClient.oauth2.publicClient({ query: { client_id: clientId } }).then(({ data }) => {
      const found = data as { client_name?: string; logo_uri?: string; icon?: string } | null;
      setClient({ name: found?.client_name ?? "An application", scopes, logo: found?.logo_uri ?? found?.icon ?? null });
    });
  }, []);

  async function decide(accept: boolean) {
    setBusy(accept ? "allow" : "deny");
    setError("");
    const { data, error: failure } = await authClient.oauth2.consent({ accept });
    if (failure) { setError(failure.message ?? "Could not record your choice."); setBusy(""); return; }
    const url = (data as { url?: string } | null)?.url;
    if (url) window.location.assign(url);
  }

  if (!client) return <div className="au-form au-loading"><Spinner size={24} label="Loading" /></div>;

  return (
    <div className="au-form">
      <ClientMark name={client.name} logo={client.logo} icon={<ShieldCheck size={22} strokeWidth={1.6} />} />
      <div>
        <h1>Authorize {client.name}</h1>
        <p className="au-sub"><strong>{client.name}</strong> is asking to use your Meshscale account. It will be able to:</p>
      </div>
      <ul className="au-scopes">
        {client.scopes.map(scope => (
          <li key={scope}><Check size={15} />{scopeText[scope] ?? scope}</li>
        ))}
      </ul>
      <div className="au-actions">
        <button type="button" className="au-btn au-btn-outline" disabled={!!busy} onClick={() => void decide(false)}><Pending busy={busy === "deny"}>Deny</Pending></button>
        <button type="button" className="au-btn au-btn-primary" disabled={!!busy} onClick={() => void decide(true)}><Pending busy={busy === "allow"}>Allow</Pending></button>
      </div>
      {error && <p className="au-error" role="alert">{error}</p>}
    </div>
  );
}
