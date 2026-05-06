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
 * `theme-mode` from localStorage and applies it to <html> before React
 * hydrates. Without this, every full reload paints the light theme for a
 * moment before ThemeSettings toggles the class.
 *
 * Safe: only touches documentElement.classList.
 * Falls through quietly if localStorage is unavailable (private mode).
 */
const themeBootstrap = `
(function () {
  try {
    var mode = localStorage.getItem('theme-mode');
    if (mode === 'dark') document.documentElement.classList.add('dark');
  } catch (e) { /* localStorage blocked; accept the FOUC */ }
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
