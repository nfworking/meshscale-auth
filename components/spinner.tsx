/** A small ring that spins. It replaces "Loading…" style text; screen readers still hear that something is happening. */
export function Spinner({ size = 16, label = "Loading" }: { size?: number; label?: string }) {
  return <span className="au-spinner" role="status" aria-label={label} style={{ width: size, height: size }} />;
}

/**
 * The label of a button that can be busy. While busy the label stays in place but is hidden, and a spinner sits on top of
 * it, so the button never changes size or shifts the layout.
 */
export function Pending({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <span className="au-pending" data-busy={busy}>
      <span className="au-pending-label">{children}</span>
      {busy && <Spinner />}
    </span>
  );
}
