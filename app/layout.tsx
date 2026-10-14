import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sign in — Meshscale", template: "%s — Meshscale" },
  description: "Sign in to Meshscale Connect.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#fbfaf8",
};

// Applies the saved or system theme before first paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('ms-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
