"use client";

import { Moon, Sun } from "lucide-react";

/** Toggles light and dark. The icon swaps with CSS, so there is no hydration mismatch. */
export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("ms-theme", next); } catch {}
  }

  return (
    <button type="button" className="au-theme" onClick={toggle} aria-label="Toggle light and dark theme">
      <Sun size={16} className="au-icon-sun" aria-hidden="true" />
      <Moon size={16} className="au-icon-moon" aria-hidden="true" />
    </button>
  );
}
