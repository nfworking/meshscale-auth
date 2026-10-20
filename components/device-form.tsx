"use client";

import { useEffect, useState } from "react";
import { Check, Terminal } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Pending, Spinner } from "./spinner";

const scopeText: Record<string, string> = {
  openid: "Verify your identity",
  email: "See your email address",
  offline_access: "Stay signed in on that machine",
  "tunnel:connect": "Open tunnels from that machine",
  "tunnel:read": "See your teams and tunnels",
  "tunnel:manage": "Change and stop tunnels",
};

type Request = { code: string; client: string; scopes: string[]; email: string };

/**
 * Approval screen for the CLI's device login (RFC 8628). It is reached from the platform's /device page, so the
 * person is already signed in here. Without a session it hands back to the platform, which signs them in and returns.
 */
export function DeviceForm() {
  const [request, setRequest] = useState<Request | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "approved" | "denied" | "invalid">("loading");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("user_code") ?? "";
    const platform = process.env.NEXT_PUBLIC_PLATFORM_URL!;
    async function load() {
      if (!code) return setState("invalid");
      const session = await authClient.getSession();
      if (!session.data) {
        window.location.replace(`${platform}/device?user_code=${encodeURIComponent(code)}`);
        return;
      }
      // Asking for the code binds it to this signed-in person; only they can then approve it.
      const response = await fetch(`/api/auth/device?user_code=${encodeURIComponent(code)}`, { credentials: "same-origin" });
      const body = (await response.json().catch(() => ({}))) as { client_id?: string; scope?: string; status?: string; client_name?: string };
      if (!response.ok || !body.client_id || body.status !== "pending") return setState(body.status === "approved" ? "approved" : "invalid");
      const client = await authClient.oauth2.publicClient({ query: { client_id: body.client_id } });
      setRequest({
        code,
        client: (client.data as { client_name?: string } | null)?.client_name ?? "Meshscale CLI",
        scopes: (body.scope ?? "").split(" ").filter(Boolean),
        email: session.data.user.email,
      });
      setState("ready");
    }
    void load();
  }, []);

  async function decide(approve: boolean) {
    if (!request) return;
    setBusy(approve ? "approve" : "deny");
    setError("");
    const response = await fetch(`/api/auth/device/${approve ? "approve" : "deny"}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userCode: request.code }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error_description?: string; message?: string };
      setBusy("");
      return setError(body.error_description ?? body.message ?? "Could not record your choice.");
    }
    setState(approve ? "approved" : "denied");
  }

  if (state === "loading") return <div className="au-form au-loading"><Spinner size={24} label="Checking the code" /></div>;

  if (state === "invalid") {
    return (
      <div className="au-form">
        <div><h1>This code does not work</h1><p className="au-sub">It may have expired, been used already, or belong to someone else. Run <code>tunnel login</code> again to get a new one.</p></div>
      </div>
    );
  }

  if (state === "approved" || state === "denied") {
    return (
      <div className="au-form">
        <div className="au-verify-icon"><Check size={22} strokeWidth={1.6} /></div>
        <div>
          <h1>{state === "approved" ? "You are signed in" : "Request denied"}</h1>
          <p className="au-sub">{state === "approved" ? "Return to your terminal. You can close this tab." : "Nothing was shared with that device. You can close this tab."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="au-form">
      <div className="au-verify-icon"><Terminal size={22} strokeWidth={1.6} /></div>
      <div>
        <h1>Sign in {request!.client}</h1>
        <p className="au-sub">Only continue if you started this on your own machine. Signed in as <strong>{request!.email}</strong>.</p>
      </div>
      <p className="au-sub">Code <strong>{request!.code}</strong> will be able to:</p>
      <ul className="au-scopes">
        {request!.scopes.map(scope => (
          <li key={scope}><Check size={15} />{scopeText[scope] ?? scope}</li>
        ))}
      </ul>
      <div className="au-actions">
        <button type="button" className="au-btn au-btn-outline" disabled={!!busy} onClick={() => void decide(false)}><Pending busy={busy === "deny"}>Deny</Pending></button>
        <button type="button" className="au-btn au-btn-primary" disabled={!!busy} onClick={() => void decide(true)}><Pending busy={busy === "approve"}>Approve</Pending></button>
      </div>
      {error && <p className="au-error" role="alert">{error}</p>}
    </div>
  );
}
