"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Building2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Org = { id: string; name: string; slug: string };

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/**
 * Shown by the OAuth provider's post-login step (auth spec 5.1) when the session has no active organization.
 * Picking or creating one sets it on the session, then the authorization request continues.
 */
export function SelectOrgForm() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    authClient.organization.list().then(({ data }) => setOrgs((data as Org[] | null) ?? []));
  }, []);

  async function proceed() {
    const { data, error: failure } = await authClient.oauth2.continue({ postLogin: true });
    if (failure) { setError(failure.message ?? "Could not continue. Try again."); setBusy(""); return; }
    const url = (data as { url?: string } | null)?.url;
    if (url) window.location.assign(url);
  }

  async function choose(organizationId: string) {
    setBusy(organizationId);
    setError("");
    const { error: failure } = await authClient.organization.setActive({ organizationId });
    if (failure) { setError(failure.message ?? "Could not select that organization."); setBusy(""); return; }
    await proceed();
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const base = slugify(trimmed) || "workspace";
    setBusy("create");
    setError("");
    // Slugs are unique, so a taken one gets a short suffix.
    let slug = base;
    const taken = await authClient.organization.checkSlug({ slug });
    if (taken.error) slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error: failure } = await authClient.organization.create({ name: trimmed, slug });
    if (failure) { setError(failure.message ?? "Could not create the workspace."); setBusy(""); return; }
    await proceed();
  }

  if (!orgs) return <div className="au-form"><p className="au-sub">Loading your workspaces…</p></div>;

  return (
    <div className="au-form">
      <div>
        <h1>{orgs.length ? "Choose a workspace" : "Create your workspace"}</h1>
        <p className="au-sub">{orgs.length ? "Tunnels belong to a workspace. Pick the one to continue with." : "Tunnels belong to a workspace. Name yours to get started. You can invite teammates later."}</p>
      </div>

      {orgs.length > 0 && (
        <ul className="au-orgs">
          {orgs.map(org => (
            <li key={org.id}>
              <button type="button" disabled={!!busy} onClick={() => void choose(org.id)}>
                <span className="au-org-icon"><Building2 size={16} strokeWidth={1.6} /></span>
                <span><strong>{org.name}</strong><small>{org.slug}</small></span>
                {busy === org.id ? <em>Opening…</em> : <ArrowRight size={15} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {orgs.length > 0 && <div className="au-divider"><span>or create a new one</span></div>}

      <form onSubmit={create} className="au-fields">
        <div className="au-field">
          <label htmlFor="org-name">Workspace name</label>
          <input id="org-name" name="name" type="text" placeholder="Acme Inc." value={name} onChange={event => setName(event.target.value)} required maxLength={60} />
        </div>
        <button type="submit" className="au-btn au-btn-primary" disabled={!!busy}>{busy === "create" ? "Creating…" : <>Create workspace <ArrowRight size={15} /></>}</button>
      </form>

      {error && <p className="au-error" role="alert">{error}</p>}
    </div>
  );
}
