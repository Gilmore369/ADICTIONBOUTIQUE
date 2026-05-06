import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/lib/react-query-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adiction Boutique Suite",
  description: "Business operations management system",
};

/**
 * Inline script that runs BEFORE React hydrates. Reads the persisted
 * `theme-mode` and `theme-color` from localStorage and applies them to
 * <html> so there's no flash-of-light-theme when the user has dark mode
 * enabled. Without this, every full reload paints the light theme for
 * ~200ms before the ThemeSettings effect runs and toggles the class.
 *
 * Safe: only touches documentElement.classList and CSS custom properties.
 * Falls through quietly if localStorage is unavailable (private mode).
 */
const themeBootstrap = `
(function () {
  try {
    var mode = localStorage.getItem('theme-mode');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = mode === 'dark' || (mode === 'auto' && prefersDark);
    if (dark) document.documentElement.classList.add('dark');

    var color = localStorage.getItem('theme-color');
    if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
      document.documentElement.style.setProperty('--color-primary', color);
      document.documentElement.style.setProperty('--primary', color);
    }
  } catch (e) { /* localStorage blocked — accept the FOUC */ }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          {children}
          <Toaster />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
