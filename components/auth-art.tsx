import { Building2, KeyRound, Terminal } from "lucide-react";

const points = [
  { icon: KeyRound, title: "Passkeys and two-factor", text: "Phishing-resistant sign-in, with a second factor when you want one." },
  { icon: Building2, title: "Organizations and roles", text: "Invite your team and decide who can manage tunnels." },
  { icon: Terminal, title: "Sign in from the CLI", text: "Approve a device with a short code. No tokens to paste." },
];

/** Right-hand panel: a dotted grid with a short message. Purely decorative, so it is hidden from assistive tech. */
export function AuthArt() {
  return (
    <aside className="au-art" aria-hidden="true">
      <div className="au-art-grid" />

      <div className="au-art-top">
        <span className="au-status"><i />All systems operational</span>
      </div>

      <div className="au-art-copy">
        <p className="au-eyebrow"><span />Meshscale Connect</p>
        <h2>One account for every tunnel.</h2>
        <p className="au-art-lead">Sign in once. Open tunnels from your terminal, watch them in the dashboard and share access with your organization.</p>
        <ul>
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="au-art-icon"><Icon size={16} strokeWidth={1.6} /></span>
              <span><strong>{title}</strong><small>{text}</small></span>
            </li>
          ))}
        </ul>
      </div>

      <div className="au-art-terminal">
        <div className="au-art-terminal-head"><span /><span /><span /><em>terminal</em></div>
        <pre><span className="au-dim">$</span> tunnel login{"\n"}<span className="au-dim">Open</span> auth.meshscale.cloud/device{"\n"}<span className="au-dim">Code</span> <b>WDJB-MJHT</b></pre>
      </div>
    </aside>
  );
}
