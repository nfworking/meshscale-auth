import Link from "next/link";
import { AuthArt } from "@/components/auth-art";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import "./auth.css";

/** Shared frame for sign-in and sign-up: the form on one side, a dotted grid with a short message on the other. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="au">
      <main className="au-form-side">
        <header className="au-top">
          <Brand />
          <ThemeToggle />
        </header>
        <div className="au-center">{children}</div>
        <footer className="au-legal">
          <span>© 2026 Meshscale</span>
          <nav aria-label="Legal">
            <Link href="/sign-in">Terms</Link>
            <Link href="/sign-in">Privacy</Link>
            <a href="https://connect.meshscale.cloud/status">Status</a>
          </nav>
        </footer>
      </main>
      <AuthArt />
    </div>
  );
}
