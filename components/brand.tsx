import Link from "next/link";
import { Network } from "lucide-react";

export function Brand() {
  return (
    <Link href="/sign-in" className="au-brand" aria-label="Meshscale">
      <span className="au-brand-mark"><Network size={16} strokeWidth={2} aria-hidden="true" /></span>
      <span>meshscale</span>
    </Link>
  );
}
