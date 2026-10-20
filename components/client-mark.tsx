"use client";

import { useState, type ReactNode } from "react";

const hueOf = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % 360;
};

/**
 * The picture of the application asking for access. It fades in when loaded; with no picture, or one that fails to load,
 * the badge shows the given icon (or initials) on a colour taken from the name, never a broken-image icon.
 */
export function ClientMark({ name, logo, icon }: { name: string; logo?: string | null; icon?: ReactNode }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">(logo ? "loading" : "failed");
  const initials = name.split(/\s+/).filter(Boolean).map(word => word[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div className="au-client-mark" data-state={state} style={{ ["--hue" as string]: hueOf(name) }}>
      <span className="au-client-fallback">{icon ?? initials}</span>
      {logo && state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element -- client logos are arbitrary URLs, so they cannot use the image optimiser
        <img src={logo} alt="" referrerPolicy="no-referrer" decoding="async" onLoad={() => setState("loaded")} onError={() => setState("failed")} />
      )}
    </div>
  );
}
